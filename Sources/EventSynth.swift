//
//  EventSynth.swift
//  Turns touch input from the phone into real macOS input events.
//

import AppKit
import CoreGraphics
import Foundation

final class MacController {
    private let src = CGEventSource(stateID: .hidSystemState)
    private var leftDown = false
    private var rightDown = false
    private var cachedBounds = CGRect.zero
    private var boundsStamp = Date.distantPast
    private let q = DispatchQueue(label: "macpad.events")

    private var screenBounds: CGRect {
        if Date().timeIntervalSince(boundsStamp) < 2.0, !cachedBounds.isEmpty { return cachedBounds }
        var count: UInt32 = 0
        CGGetActiveDisplayList(0, nil, &count)
        var ids = [CGDirectDisplayID](repeating: 0, count: Int(count))
        CGGetActiveDisplayList(count, &ids, &count)
        var r = CGRect.null
        for id in ids { r = r.union(CGDisplayBounds(id)) }
        if r.isNull || r.isEmpty { r = CGRect(x: 0, y: 0, width: 1440, height: 900) }
        cachedBounds = r
        boundsStamp = Date()
        return r
    }

    private var cursor: CGPoint {
        CGEvent(source: nil)?.location ?? CGPoint(x: screenBounds.midX, y: screenBounds.midY)
    }

    private func post(_ e: CGEvent?) { e?.post(tap: .cghidEventTap) }

    func move(dx: CGFloat, dy: CGFloat) {
        q.async {
            let b = self.screenBounds
            var p = self.cursor
            p.x = min(max(p.x + dx, b.minX), b.maxX - 1)
            p.y = min(max(p.y + dy, b.minY), b.maxY - 1)
            let type: CGEventType = self.leftDown ? .leftMouseDragged
                                  : (self.rightDown ? .rightMouseDragged : .mouseMoved)
            let btn: CGMouseButton = self.rightDown ? .right : .left
            self.post(CGEvent(mouseEventSource: self.src, mouseType: type,
                              mouseCursorPosition: p, mouseButton: btn))
        }
    }

    /// (button, down event, up event) for button index 0=left, 1=right, 2=middle.
    private func kinds(_ button: Int) -> (CGMouseButton, CGEventType, CGEventType) {
        switch button {
        case 1:  return (.right,  .rightMouseDown, .rightMouseUp)
        case 2:  return (.center, .otherMouseDown, .otherMouseUp)
        default: return (.left,   .leftMouseDown,  .leftMouseUp)
        }
    }

    func mouseDown(button: Int) {
        q.async {
            let (btn, downType, _) = self.kinds(button)
            if button == 1 { self.rightDown = true } else if button == 0 { self.leftDown = true }
            self.post(CGEvent(mouseEventSource: self.src, mouseType: downType,
                              mouseCursorPosition: self.cursor, mouseButton: btn))
        }
    }

    func mouseUp(button: Int) {
        q.async {
            let (btn, _, upType) = self.kinds(button)
            if button == 1 { self.rightDown = false } else if button == 0 { self.leftDown = false }
            self.post(CGEvent(mouseEventSource: self.src, mouseType: upType,
                              mouseCursorPosition: self.cursor, mouseButton: btn))
        }
    }

    func click(button: Int, count: Int) {
        q.async {
            let (btn, downType, upType) = self.kinds(button)
            let p = self.cursor
            for i in 1...max(1, min(count, 3)) {
                for type in [downType, upType] {
                    guard let e = CGEvent(mouseEventSource: self.src, mouseType: type,
                                          mouseCursorPosition: p, mouseButton: btn) else { continue }
                    e.setIntegerValueField(.mouseEventClickState, value: Int64(i))
                    e.post(tap: .cghidEventTap)
                }
            }
        }
    }

    func scroll(dy: Int32, dx: Int32) {
        q.async {
            self.post(CGEvent(scrollWheelEvent2Source: self.src, units: .pixel,
                              wheelCount: 2, wheel1: dy, wheel2: dx, wheel3: 0))
        }
    }

    func key(_ code: CGKeyCode, flags: CGEventFlags = []) {
        q.async {
            // Modifiers the phone is holding must ride along with each keystroke.
            let all = flags.union(self.heldFlags)
            if let d = CGEvent(keyboardEventSource: self.src, virtualKey: code, keyDown: true) {
                d.flags = all; d.post(tap: .cghidEventTap)
            }
            if let u = CGEvent(keyboardEventSource: self.src, virtualKey: code, keyDown: false) {
                u.flags = all; u.post(tap: .cghidEventTap)
            }
            self.lastActivity = Date()
        }
    }

    // MARK: Held modifiers
    //
    // Holding Command down is what makes Command-Tab an app switcher rather
    // than a one-shot toggle: the panel stays up while the key is held.

    private static let modifierKeys: [String: (CGKeyCode, CGEventFlags)] = [
        "cmd":   (55, .maskCommand),
        "shift": (56, .maskShift),
        "opt":   (58, .maskAlternate),
        "ctrl":  (59, .maskControl),
    ]
    private var heldFlags: CGEventFlags = []
    private var lastActivity = Date()

    func modifier(_ name: String, down: Bool) {
        guard let (code, flag) = Self.modifierKeys[name] else { return }
        q.async {
            if down { self.heldFlags.insert(flag) } else { self.heldFlags.remove(flag) }
            // Modifiers post as flagsChanged, not as a keypress.
            if let e = CGEvent(keyboardEventSource: self.src, virtualKey: code, keyDown: down) {
                e.type = .flagsChanged
                e.flags = self.heldFlags
                e.post(tap: .cghidEventTap)
            }
            self.lastActivity = Date()
        }
    }

    /// Release every held modifier and button. Called on disconnect and by the
    /// watchdog so a dropped connection can't leave Command stuck down.
    func releaseAll() {
        q.async {
            for (name, pair) in Self.modifierKeys where self.heldFlags.contains(pair.1) {
                self.heldFlags.remove(pair.1)
                if let e = CGEvent(keyboardEventSource: self.src, virtualKey: pair.0, keyDown: false) {
                    e.type = .flagsChanged
                    e.flags = self.heldFlags
                    e.post(tap: .cghidEventTap)
                }
                _ = name
            }
            if self.leftDown { self.leftDown = false; self.postUp(.left, .leftMouseUp) }
            if self.rightDown { self.rightDown = false; self.postUp(.right, .rightMouseUp) }
        }
    }

    private func postUp(_ btn: CGMouseButton, _ type: CGEventType) {
        post(CGEvent(mouseEventSource: src, mouseType: type,
                     mouseCursorPosition: cursor, mouseButton: btn))
    }

    /// A long silence with a modifier still held means the phone went away.
    func sweepStuckModifiers() {
        q.async {
            if !self.heldFlags.isEmpty,
               Date().timeIntervalSince(self.lastActivity) > Config.stuckModifierTimeout {
                self.releaseAll()
            }
        }
    }

    func typeText(_ s: String) {
        q.async {
            let chunk = Array(s.utf16)
            guard !chunk.isEmpty else { return }
            for scalarChunk in stride(from: 0, to: chunk.count, by: 16).map({
                Array(chunk[$0..<min($0 + 16, chunk.count)])
            }) {
                var units = scalarChunk
                if let d = CGEvent(keyboardEventSource: self.src, virtualKey: 0, keyDown: true) {
                    d.keyboardSetUnicodeString(stringLength: units.count, unicodeString: &units)
                    d.post(tap: .cghidEventTap)
                }
                if let u = CGEvent(keyboardEventSource: self.src, virtualKey: 0, keyDown: false) {
                    u.keyboardSetUnicodeString(stringLength: units.count, unicodeString: &units)
                    u.post(tap: .cghidEventTap)
                }
            }
        }
    }

    // System media keys (play/pause, volume, track) via NSEvent systemDefined.
    func mediaKey(_ key: Int32) {
        q.async {
            for isDown in [true, false] {
                let state = isDown ? 0xA : 0xB
                let flags = NSEvent.ModifierFlags(rawValue: UInt(state << 8))
                let data1 = Int((key << 16) | Int32(state << 8))
                guard let ev = NSEvent.otherEvent(with: .systemDefined,
                                                  location: .zero,
                                                  modifierFlags: flags,
                                                  timestamp: 0,
                                                  windowNumber: 0,
                                                  context: nil,
                                                  subtype: 8,
                                                  data1: data1,
                                                  data2: -1) else { continue }
                ev.cgEvent?.post(tap: .cghidEventTap)
            }
        }
    }
}
