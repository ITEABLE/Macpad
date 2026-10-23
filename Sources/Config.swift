//
//  Config.swift
//  Tunables shared across the app.
//

import Foundation

enum Config {
    /// Fixed so the QR code and any bookmarked URL stay valid between launches.
    static let port: UInt16 = 8765

    /// RFC 6455 handshake constant.
    static let webSocketGUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"

    /// Release held modifiers if the phone goes quiet for this long. Guards
    /// against a dropped connection leaving Command stuck down on the Mac.
    static let stuckModifierTimeout: TimeInterval = 20
}
