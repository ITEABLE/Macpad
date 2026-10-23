//
//  WebSocketConnection.swift
//  One phone connection: HTTP upgrade, then RFC 6455 framing.
//

import Foundation
import Network
import CryptoKit
import ApplicationServices

final class Client {
    let conn: NWConnection
    private var buffer = Data()
    private var upgraded = false
    private weak var server: Server?
    private var authorized = false

    init(conn: NWConnection, server: Server) {
        self.conn = conn
        self.server = server
    }

    func start(on queue: DispatchQueue) {
        conn.stateUpdateHandler = { [weak self] st in
            switch st {
            case .failed, .cancelled: self?.server?.remove(self)
            default: break
            }
        }
        conn.start(queue: queue)
        receive()
    }

    private func receive() {
        conn.receive(minimumIncompleteLength: 1, maximumLength: 64 * 1024) { [weak self] data, _, done, err in
            guard let self else { return }
            if let data, !data.isEmpty {
                self.buffer.append(data)
                if self.upgraded { self.drainFrames() } else { self.tryHTTP() }
            }
            if done || err != nil {
                self.conn.cancel()
                self.server?.remove(self)
                return
            }
            self.receive()
        }
    }

    private func send(_ data: Data) {
        conn.send(content: data, completion: .contentProcessed { _ in })
    }

    private func close() {
        conn.send(content: nil, isComplete: true, completion: .contentProcessed { _ in
            self.conn.cancel()
        })
    }

    // MARK: HTTP

    private func tryHTTP() {
        guard let headEnd = buffer.range(of: Data("\r\n\r\n".utf8)) else {
            if buffer.count > 32 * 1024 { conn.cancel() }
            return
        }
        let head = String(decoding: buffer[buffer.startIndex..<headEnd.lowerBound], as: UTF8.self)
        buffer.removeSubrange(buffer.startIndex..<headEnd.upperBound)

        let lines = head.split(separator: "\r\n", omittingEmptySubsequences: true).map(String.init)
        guard let requestLine = lines.first else { conn.cancel(); return }
        let parts = requestLine.split(separator: " ").map(String.init)
        guard parts.count >= 2 else { conn.cancel(); return }
        let target = parts[1]

        var headers: [String: String] = [:]
        for line in lines.dropFirst() {
            guard let i = line.firstIndex(of: ":") else { continue }
            let k = line[line.startIndex..<i].trimmingCharacters(in: .whitespaces).lowercased()
            let v = line[line.index(after: i)...].trimmingCharacters(in: .whitespaces)
            headers[k] = v
        }

        let pathOnly = target.split(separator: "?").first.map(String.init) ?? "/"
        let query = target.contains("?") ? String(target[target.index(after: target.firstIndex(of: "?")!)...]) : ""
        var params: [String: String] = [:]
        for pair in query.split(separator: "&") {
            let kv = pair.split(separator: "=", maxSplits: 1).map(String.init)
            if kv.count == 2 { params[kv[0]] = kv[1] }
        }

        let wantsUpgrade = (headers["upgrade"]?.lowercased().contains("websocket") ?? false)

        if wantsUpgrade {
            guard params["k"] == server?.token, let key = headers["sec-websocket-key"] else {
                httpRespond(status: "403 Forbidden", body: Data("bad token".utf8), type: "text/plain")
                return
            }
            let accept = Data(Insecure.SHA1.hash(data: Data((key + Config.webSocketGUID).utf8))).base64EncodedString()
            let resp = """
            HTTP/1.1 101 Switching Protocols\r
            Upgrade: websocket\r
            Connection: Upgrade\r
            Sec-WebSocket-Accept: \(accept)\r
            \r

            """
            send(Data(resp.utf8))
            upgraded = true
            authorized = true
            server?.setConnected(true)
            sendText("{\"t\":\"hello\",\"ax\":\(AXIsProcessTrusted())}")
            drainFrames()
            return
        }

        switch pathOnly {
        case "/", "/index.html":
            guard var html = loadWebAsset("index.html") else {
                httpRespond(status: "500 Internal Server Error",
                            body: Data("web/index.html not found".utf8), type: "text/plain")
                return
            }
            // The page reads its session token from a meta tag.
            if let token = server?.token, let text = String(data: html, encoding: .utf8) {
                html = Data(text.replacingOccurrences(of: "__MACPAD_TOKEN__", with: token).utf8)
            }
            httpRespond(status: "200 OK", body: html, type: "text/html; charset=utf-8")
        case "/manifest.webmanifest":
            let tok = server?.token ?? ""
            let m = """
            {"name":"MacPad","short_name":"MacPad","start_url":"/?k=\(tok)",\
            "display":"standalone","orientation":"any","background_color":"#0b0d10",\
            "theme_color":"#0b0d10","icons":[]}
            """
            httpRespond(status: "200 OK", body: Data(m.utf8), type: "application/manifest+json")
        case "/health":
            httpRespond(status: "200 OK", body: Data("ok".utf8), type: "text/plain")
        default:
            serveStaticFile(pathOnly)
        }
    }

    private static let contentTypes = [
        "css": "text/css; charset=utf-8",
        "js": "text/javascript; charset=utf-8",
        "json": "application/json",
        "svg": "image/svg+xml",
        "png": "image/png",
        "ico": "image/x-icon",
    ]

    private func serveStaticFile(_ path: String) {
        let name = String(path.dropFirst())
        // Nothing nested is served, so any separator or traversal is a probe.
        guard !name.isEmpty, !name.contains(".."), !name.contains("/") else {
            httpRespond(status: "404 Not Found", body: Data("not found".utf8), type: "text/plain")
            return
        }
        let ext = (name as NSString).pathExtension.lowercased()
        guard let type = Self.contentTypes[ext], let body = loadWebAsset(name) else {
            httpRespond(status: "404 Not Found", body: Data("not found".utf8), type: "text/plain")
            return
        }
        httpRespond(status: "200 OK", body: body, type: type)
    }

    private func httpRespond(status: String, body: Data, type: String) {
        var head = "HTTP/1.1 \(status)\r\n"
        head += "Content-Type: \(type)\r\n"
        head += "Content-Length: \(body.count)\r\n"
        head += "Cache-Control: no-store\r\n"
        head += "Connection: close\r\n\r\n"
        var out = Data(head.utf8)
        out.append(body)
        send(out)
        close()
    }

    // MARK: WebSocket frames

    func sendText(_ s: String) {
        let payload = Array(s.utf8)
        var frame: [UInt8] = [0x81]
        if payload.count < 126 {
            frame.append(UInt8(payload.count))
        } else if payload.count < 65536 {
            frame.append(126)
            frame.append(UInt8((payload.count >> 8) & 0xFF))
            frame.append(UInt8(payload.count & 0xFF))
        } else {
            frame.append(127)
            for shift in stride(from: 56, through: 0, by: -8) {
                frame.append(UInt8((payload.count >> shift) & 0xFF))
            }
        }
        frame.append(contentsOf: payload)
        send(Data(frame))
    }

    private func sendPong(_ payload: [UInt8]) {
        var frame: [UInt8] = [0x8A, UInt8(min(payload.count, 125))]
        frame.append(contentsOf: payload.prefix(125))
        send(Data(frame))
    }

    private func drainFrames() {
        while true {
            let base = buffer.startIndex
            guard buffer.count >= 2 else { return }
            let b0 = buffer[base]
            let b1 = buffer[base + 1]
            let opcode = b0 & 0x0F
            let masked = (b1 & 0x80) != 0
            var len = Int(b1 & 0x7F)
            var idx = 2
            if len == 126 {
                guard buffer.count >= 4 else { return }
                len = (Int(buffer[base + 2]) << 8) | Int(buffer[base + 3])
                idx = 4
            } else if len == 127 {
                guard buffer.count >= 10 else { return }
                len = 0
                for i in 2..<10 { len = (len << 8) | Int(buffer[base + i]) }
                idx = 10
            }
            var mask = [UInt8](repeating: 0, count: 4)
            if masked {
                guard buffer.count >= idx + 4 else { return }
                for i in 0..<4 { mask[i] = buffer[base + idx + i] }
                idx += 4
            }
            guard buffer.count >= idx + len else { return }
            var payload = [UInt8](buffer[(base + idx)..<(base + idx + len)])
            if masked { for i in 0..<len { payload[i] ^= mask[i % 4] } }
            buffer.removeSubrange(base..<(base + idx + len))

            switch opcode {
            case 0x1:
                if let text = String(bytes: payload, encoding: .utf8) {
                    server?.handle(text, from: self)
                }
            case 0x8:
                close()
                server?.setConnected(false)
                return
            case 0x9:
                sendPong(payload)
            default:
                break
            }
        }
    }
}
