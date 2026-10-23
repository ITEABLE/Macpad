//
//  Diagnostics.swift
//  stderr logging; visible with `log stream` or when run from a terminal.
//

import Foundation

func log(_ s: String) {
    let t = ISO8601DateFormatter().string(from: Date())
    FileHandle.standardError.write("[\(t)] \(s)\n".data(using: .utf8)!)
}
