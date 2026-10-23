//
//  NetworkInterfaces.swift
//  Finds the LAN addresses the phone can reach this Mac on.
//

import Darwin
import Foundation

func localIPv4Addresses() -> [(iface: String, ip: String)] {
    var out: [(iface: String, ip: String)] = []
    var head: UnsafeMutablePointer<ifaddrs>?
    guard getifaddrs(&head) == 0 else { return out }
    defer { freeifaddrs(head) }
    var cur = head
    while let node = cur {
        let ifa = node.pointee
        defer { cur = ifa.ifa_next }
        guard let sa = ifa.ifa_addr, sa.pointee.sa_family == UInt8(AF_INET) else { continue }
        guard (Int32(ifa.ifa_flags) & IFF_UP) != 0 else { continue }
        let name = String(cString: ifa.ifa_name)
        if name == "lo0" || name.hasPrefix("utun") || name.hasPrefix("ipsec") { continue }
        var addr = sa.withMemoryRebound(to: sockaddr_in.self, capacity: 1) { $0.pointee.sin_addr }
        var buf = [CChar](repeating: 0, count: Int(INET_ADDRSTRLEN))
        inet_ntop(AF_INET, &addr, &buf, socklen_t(INET_ADDRSTRLEN))
        let ip = String(cString: buf)
        if ip.hasPrefix("169.254.") { continue }
        out.append((name, ip))
    }
    // Prefer Wi-Fi / Ethernet, then a Mac-hosted hotspot bridge, then the rest.
    let rank: (String) -> Int = { n in
        if n == "en0" { return 0 }
        if n.hasPrefix("en") { return 1 }
        if n.hasPrefix("bridge") { return 2 }
        return 3
    }
    return out.sorted { rank($0.iface) < rank($1.iface) }
}
