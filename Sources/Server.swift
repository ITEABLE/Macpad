//
//  Server.swift
//  Listener, request routing, and the running-app list sent to the phone.
//

import AppKit
import Foundation
import Network

final class Server {
    let token: String
    private let controller = MacController()
    private var listener: NWListener?
    private var clients: [Client] = []
    private let queue = DispatchQueue(label: "macpad.net")
    var onConnectionChange: ((Bool) -> Void)?

    init(token: String) { self.token = token }

    func start() throws {
        let params = NWParameters.tcp
        params.allowLocalEndpointReuse = true
        if let tcp = params.defaultProtocolStack.internetProtocol as? NWProtocolTCP.Options {
            tcp.noDelay = true          // critical: no Nagle buffering, keeps the pad snappy
            tcp.enableKeepalive = true
            tcp.keepaliveIdle = 10
        }
        let l = try NWListener(using: params, on: NWEndpoint.Port(rawValue: Config.port)!)
        l.newConnectionHandler = { [weak self] conn in
            guard let self else { return }
            let c = Client(conn: conn, server: self)
            self.queue.async { self.clients.append(c) }
            c.start(on: self.queue)
        }
        l.stateUpdateHandler = { st in
            if case .failed(let e) = st { log("listener failed: \(e)") }
        }
        l.start(queue: queue)
        listener = l
        log("MacPad listening on port \(Config.port)")
    }

    func remove(_ c: Client?) {
        guard let c else { return }
        queue.async {
            self.clients.removeAll { $0 === c }
            if self.clients.isEmpty {
                // Dropping mid-app-switch must not leave Command held.
                self.controller.releaseAll()
                self.setConnected(false)
            }
        }
    }

    func sweep() { controller.sweepStuckModifiers() }

    /// Push a message to every connected phone.
    func broadcast(_ text: String) {
        queue.async { for c in self.clients { c.sendText(text) } }
    }

    /// Names and icons of Dock-visible apps, so the phone can show a tappable
    /// grid instead of blind Command-Tabbing.
    private func sendAppList(to client: Client?) {
        guard let client else { return }
        DispatchQueue.main.async {
            let apps = NSWorkspace.shared.runningApplications
                .filter { $0.activationPolicy == .regular }
                .sorted { ($0.localizedName ?? "").localizedCaseInsensitiveCompare($1.localizedName ?? "")
                          == .orderedAscending }
            var items: [[String: Any]] = []
            for a in apps {
                guard let name = a.localizedName, let bid = a.bundleIdentifier else { continue }
                var d: [String: Any] = ["name": name, "id": bid, "front": a.isActive]
                if let icon = Self.pngBase64(a.icon, side: 44) { d["icon"] = icon }
                items.append(d)
            }
            guard let data = try? JSONSerialization.data(withJSONObject: ["t": "apps", "apps": items]),
                  let text = String(data: data, encoding: .utf8) else { return }
            client.sendText(text)
        }
    }

    private static func pngBase64(_ image: NSImage?, side: CGFloat) -> String? {
        guard let image else { return nil }
        let target = NSSize(width: side, height: side)
        let out = NSImage(size: target)
        out.lockFocus()
        image.draw(in: NSRect(origin: .zero, size: target),
                   from: .zero, operation: .sourceOver, fraction: 1.0)
        out.unlockFocus()
        guard let tiff = out.tiffRepresentation,
              let rep = NSBitmapImageRep(data: tiff),
              let png = rep.representation(using: .png, properties: [:]) else { return nil }
        return png.base64EncodedString()
    }

    private func activateApp(_ bundleID: String) {
        DispatchQueue.main.async {
            NSRunningApplication.runningApplications(withBundleIdentifier: bundleID)
                .first?.activate(options: [.activateAllWindows])
        }
    }

    func setConnected(_ v: Bool) {
        DispatchQueue.main.async { self.onConnectionChange?(v) }
    }

    func handle(_ text: String, from client: Client? = nil) {
        guard let data = text.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let t = obj["t"] as? String else { return }

        func num(_ k: String) -> CGFloat { CGFloat((obj[k] as? NSNumber)?.doubleValue ?? 0) }
        func int(_ k: String, _ d: Int = 0) -> Int { (obj[k] as? NSNumber)?.intValue ?? d }

        switch t {
        case "m": controller.move(dx: num("x"), dy: num("y"))
        case "d": controller.mouseDown(button: int("b"))
        case "u": controller.mouseUp(button: int("b"))
        case "c": controller.click(button: int("b"), count: int("n", 1))
        case "s": controller.scroll(dy: Int32(num("y")), dx: Int32(num("x")))
        case "k":
            guard let name = obj["key"] as? String, let code = KeyCode.map[name] else { return }
            var flags: CGEventFlags = []
            if let mods = obj["mod"] as? [String] {
                if mods.contains("cmd") { flags.insert(.maskCommand) }
                if mods.contains("shift") { flags.insert(.maskShift) }
                if mods.contains("opt") { flags.insert(.maskAlternate) }
                if mods.contains("ctrl") { flags.insert(.maskControl) }
            }
            controller.key(code, flags: flags)
        case "med":
            guard let k = obj["k"] as? String else { return }
            let m: Int32? = [
                "play": MediaKey.play, "next": MediaKey.next, "prev": MediaKey.prev,
                "volup": MediaKey.soundUp, "voldown": MediaKey.soundDown, "mute": MediaKey.mute,
            ][k]
            if let m { controller.mediaKey(m) }
        case "sys":
            if let a = obj["a"] as? String { SystemAction.perform(a, controller) }
        case "mod":
            if let m = obj["m"] as? String {
                controller.modifier(m, down: (obj["down"] as? NSNumber)?.boolValue ?? false)
            }
        case "release":
            controller.releaseAll()
        case "apps":
            sendAppList(to: client)
        case "activate":
            if let b = obj["b"] as? String { activateApp(b) }
        case "txt":
            if let s = obj["s"] as? String { controller.typeText(s) }
        default: break
        }
    }
}
