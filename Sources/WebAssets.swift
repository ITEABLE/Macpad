//
//  WebAssets.swift
//  Locates the web UI, preferring the editable copy over the bundled one.
//

import Foundation

func loadWebAsset(_ name: String) -> Data? {
    var candidates: [URL] = []
    // Checked first: edits here take effect on the next page load, with no
    // rebuild and therefore no re-signing and no lost Accessibility grant.
    if let support = FileManager.default.urls(for: .applicationSupportDirectory,
                                              in: .userDomainMask).first {
        candidates.append(support.appendingPathComponent("MacPad/web/\(name)"))
    }
    if let r = Bundle.main.resourceURL {
        candidates.append(r.appendingPathComponent("web/\(name)"))
    }
    let exe = Bundle.main.executableURL?.resolvingSymlinksInPath()
    if let exe {
        // MacPad.app/Contents/MacOS/MacPad -> project root
        candidates.append(exe.deletingLastPathComponent()
            .deletingLastPathComponent().deletingLastPathComponent()
            .deletingLastPathComponent().appendingPathComponent("web/\(name)"))
        candidates.append(exe.deletingLastPathComponent().appendingPathComponent("web/\(name)"))
    }
    candidates.append(URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
        .appendingPathComponent("web/\(name)"))
    for c in candidates {
        if let d = try? Data(contentsOf: c) { return d }
    }
    return nil
}
