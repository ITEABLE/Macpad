//
//  MenuBar.swift
//  Status item, QR code window, and the Accessibility permission state.
//

import AppKit
import CoreImage
import ApplicationServices

func qrImage(for string: String, pixels: CGFloat) -> NSImage? {
    guard let data = string.data(using: .utf8),
          let filter = CIFilter(name: "CIQRCodeGenerator") else { return nil }
    filter.setValue(data, forKey: "inputMessage")
    filter.setValue("M", forKey: "inputCorrectionLevel")
    guard let out = filter.outputImage else { return nil }
    let scale = pixels / out.extent.width
    let scaled = out.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
    let rep = NSCIImageRep(ciImage: scaled)
    let img = NSImage(size: rep.size)
    img.addRepresentation(rep)
    return img
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    private var statusItem: NSStatusItem!
    private var server: Server!
    private var qrWindow: NSWindow?
    private var connected = false
    private var urls: [String] = []

    func applicationDidFinishLaunching(_ n: Notification) {
        let token = Self.loadOrCreateToken()
        server = Server(token: token)
        server.onConnectionChange = { [weak self] v in
            self?.connected = v
            self?.refreshStatusIcon()
            self?.rebuildMenu()
        }

        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        refreshStatusIcon()

        do { try server.start() } catch {
            let a = NSAlert()
            a.messageText = "MacPad couldn't start"
            a.informativeText = "Port \(Config.port) is busy or blocked.\n\n\(error.localizedDescription)"
            a.runModal()
            NSApp.terminate(nil)
            return
        }

        urls = localIPv4Addresses().map { "http://\($0.ip):\(Config.port)/?k=\(token)" }
        rebuildMenu()

        if !AXIsProcessTrusted() {
            // This system prompt adds MacPad to the Accessibility list itself,
            // so the only step left is flipping its switch. No extra dialog.
            let key = kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String
            _ = AXIsProcessTrustedWithOptions([key: true] as CFDictionary)
        }
        showQR()

        // The LAN address changes with the network, and the Accessibility grant
        // can be revoked at any time (a rebuild resets it). Poll for both.
        var lastAX = AXIsProcessTrusted()
        Timer.scheduledTimer(withTimeInterval: 2, repeats: true) { [weak self] _ in
            guard let self else { return }
            let fresh = localIPv4Addresses().map { "http://\($0.ip):\(Config.port)/?k=\(token)" }
            self.server.sweep()
            let ax = AXIsProcessTrusted()
            if fresh != self.urls || ax != lastAX {
                self.urls = fresh
                self.rebuildMenu()
                if ax != lastAX {
                    lastAX = ax
                    self.server.broadcast("{\"t\":\"ax\",\"ax\":\(ax)}")
                }
            }
        }
    }

    private func refreshStatusIcon() {
        statusItem.button?.title = connected ? "🖱️" : "⚪️"
        statusItem.button?.toolTip = connected ? "MacPad: phone connected" : "MacPad: waiting for phone"
    }

    private static func loadOrCreateToken() -> String {
        let path = ("~/.macpad-token" as NSString).expandingTildeInPath
        if let s = try? String(contentsOfFile: path, encoding: .utf8) {
            let t = s.trimmingCharacters(in: .whitespacesAndNewlines)
            if t.count >= 6 { return t }
        }
        let chars = Array("abcdefghijkmnpqrstuvwxyz23456789")
        let t = String((0..<8).map { _ in chars.randomElement()! })
        try? t.write(toFile: path, atomically: true, encoding: .utf8)
        return t
    }

    private func rebuildMenu() {
        let menu = NSMenu()

        let header = NSMenuItem(title: connected ? "Phone connected" : "Waiting for phone…",
                                action: nil, keyEquivalent: "")
        header.isEnabled = false
        menu.addItem(header)
        menu.addItem(.separator())

        let qr = NSMenuItem(title: "Show QR code", action: #selector(showQR), keyEquivalent: "q")
        qr.target = self
        menu.addItem(qr)

        if urls.isEmpty {
            let none = NSMenuItem(title: "No network address. Join a Wi-Fi network.", action: nil, keyEquivalent: "")
            none.isEnabled = false
            menu.addItem(none)
        } else {
            let label = NSMenuItem(title: "Copy address:", action: nil, keyEquivalent: "")
            label.isEnabled = false
            menu.addItem(label)
            for u in urls {
                let item = NSMenuItem(title: "   " + u, action: #selector(copyURL(_:)), keyEquivalent: "")
                item.target = self
                item.representedObject = u
                menu.addItem(item)
            }
        }

        menu.addItem(.separator())
        if !AXIsProcessTrusted() {
            let ax = NSMenuItem(title: "⚠️  Grant Accessibility permission…",
                                action: #selector(promptForAccessibility), keyEquivalent: "")
            ax.target = self
            menu.addItem(ax)
        } else {
            let ok = NSMenuItem(title: "✓ Accessibility granted", action: nil, keyEquivalent: "")
            ok.isEnabled = false
            menu.addItem(ok)
        }

        menu.addItem(.separator())
        let quit = NSMenuItem(title: "Quit MacPad", action: #selector(NSApplication.terminate(_:)),
                              keyEquivalent: "")
        menu.addItem(quit)
        statusItem.menu = menu
    }

    @objc private func copyURL(_ sender: NSMenuItem) {
        guard let u = sender.representedObject as? String else { return }
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(u, forType: .string)
    }

    @objc private func promptForAccessibility() {
        let key = kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String
        _ = AXIsProcessTrustedWithOptions([key: true] as CFDictionary)
        let a = NSAlert()
        a.messageText = "Enable Accessibility for MacPad"
        a.informativeText = """
        macOS requires this before any app can move the pointer.

        Open System Settings > Privacy & Security > Accessibility and \
        switch MacPad on.
        """
        a.addButton(withTitle: "Open System Settings")
        a.addButton(withTitle: "Later")
        if a.runModal() == .alertFirstButtonReturn,
           let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility") {
            NSWorkspace.shared.open(url)
        }
        rebuildMenu()
    }

    @objc private func showQR() {
        guard let url = urls.first else {
            let a = NSAlert()
            a.messageText = "No network address"
            a.informativeText = "Join a Wi-Fi network (or turn on Personal Hotspot and connect this Mac to it), then try again."
            a.runModal()
            return
        }

        if let w = qrWindow { w.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps: true); return }

        let w = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 360, height: 470),
                         styleMask: [.titled, .closable], backing: .buffered, defer: false)
        w.title = "Scan with iPhone Camera"
        w.isReleasedWhenClosed = false
        w.center()

        let root = NSView(frame: w.contentLayoutRect)
        root.autoresizingMask = [.width, .height]

        if let img = qrImage(for: url, pixels: 280) {
            let iv = NSImageView(frame: NSRect(x: 40, y: 150, width: 280, height: 280))
            iv.image = img
            iv.imageScaling = .scaleProportionallyUpOrDown
            iv.wantsLayer = true
            iv.layer?.backgroundColor = NSColor.white.cgColor
            root.addSubview(iv)
        }

        let text = NSTextField(wrappingLabelWithString: """
        Scan with the iPhone Camera, open the link, then tap Share → Add to Home Screen for a full-screen trackpad.

        \(url)
        """)
        text.frame = NSRect(x: 24, y: 24, width: 312, height: 110)
        text.alignment = .center
        text.font = .systemFont(ofSize: 11)
        text.textColor = .secondaryLabelColor
        text.isSelectable = true
        root.addSubview(text)

        w.contentView = root
        w.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        qrWindow = w
    }
}
