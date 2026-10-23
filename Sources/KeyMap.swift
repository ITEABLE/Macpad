//
//  KeyMap.swift
//  Virtual keycodes, media keys, and the shortcuts gestures map onto.
//

import AppKit
import CoreGraphics

enum MediaKey {
    static let soundUp: Int32 = 0
    static let soundDown: Int32 = 1
    static let mute: Int32 = 7
    static let play: Int32 = 16
    static let next: Int32 = 17
    static let prev: Int32 = 18
}

enum KeyCode {
    /// Virtual keycodes for the US ANSI layout. Names match what the phone sends.
    static let map: [String: CGKeyCode] = [
        // letters
        "a": 0, "b": 11, "c": 8, "d": 2, "e": 14, "f": 3, "g": 5, "h": 4, "i": 34,
        "j": 38, "k": 40, "l": 37, "m": 46, "n": 45, "o": 31, "p": 35, "q": 12,
        "r": 15, "s": 1, "t": 17, "u": 32, "v": 9, "w": 13, "x": 7, "y": 16, "z": 6,
        // digits
        "0": 29, "1": 18, "2": 19, "3": 20, "4": 21,
        "5": 23, "6": 22, "7": 26, "8": 28, "9": 25,
        // punctuation
        "-": 27, "=": 24, "[": 33, "]": 30, "\\": 42, ";": 41, "'": 39,
        ",": 43, ".": 47, "/": 44, "`": 50,
        // editing & navigation
        "space": 49, "return": 36, "tab": 48, "delete": 51, "forwarddelete": 117,
        "esc": 53, "home": 115, "end": 119, "pageup": 116, "pagedown": 121,
        "left": 123, "right": 124, "down": 125, "up": 126, "help": 114,
        // function row
        "f1": 122, "f2": 120, "f3": 99, "f4": 118, "f5": 96, "f6": 97,
        "f7": 98, "f8": 100, "f9": 101, "f10": 109, "f11": 103, "f12": 111,
    ]
}

/// System shortcuts that multi-finger gestures map onto.
///
/// macOS exposes no API for synthesising a real trackpad gesture, so each
/// gesture fires the shortcut that gesture would trigger. Same visible result,
/// and it honours the user's own remappings in System Settings.
enum SystemAction {
    /// Press the modifier for real, send the key, release it.
    ///
    /// Setting a modifier flag on the key event is enough for ordinary app
    /// shortcuts but is silently ignored by the system hotkeys these actions
    /// target: measured against Mission Control, Spaces and the app switcher,
    /// the flags-only form fired nothing while this form fires every time.
    private static func chord(_ c: MacController, _ code: CGKeyCode, _ mods: [String] = []) {
        for m in mods { c.modifier(m, down: true) }
        c.key(code)
        for m in mods.reversed() { c.modifier(m, down: false) }
    }

    static func perform(_ name: String, _ c: MacController) {
        switch name {
        case "mission":     chord(c, 126, ["ctrl"])            // Ctrl+Up
        case "appexpose":   chord(c, 125, ["ctrl"])            // Ctrl+Down
        case "spaceleft":   chord(c, 123, ["ctrl"])            // Ctrl+Left
        case "spaceright":  chord(c, 124, ["ctrl"])            // Ctrl+Right
        case "showdesktop": chord(c, 103)                      // F11
        case "spotlight":   chord(c, 49, ["cmd"])              // Cmd+Space
        case "switchapp":   chord(c, 48, ["cmd"])              // Cmd+Tab
        case "closewin":    chord(c, 13, ["cmd"])              // Cmd+W
        case "fullscreen":  chord(c, 3, ["cmd", "ctrl"])       // Ctrl+Cmd+F
        default: break
        }
    }
}
