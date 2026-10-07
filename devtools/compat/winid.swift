// winid.swift - dev only. Prints "<windowId> <width> <height>" for the game's large layer-0 windows, so a screenshot
// can capture the game window even when another window is in front: screencapture -x -o -l <windowId> out.png
// Build once: swiftc -O winid.swift -o winid-bin
import CoreGraphics
let list = CGWindowListCopyWindowInfo(.optionAll, kCGNullWindowID) as! [[String: Any]]
for w in list {
  let owner = w[kCGWindowOwnerName as String] as? String ?? ""
  if owner.contains("ivilization") {
    let b = w[kCGWindowBounds as String] as? [String: Any] ?? [:]
    let wd = b["Width"] as? Double ?? 0
    let ht = b["Height"] as? Double ?? 0
    let layer = w[kCGWindowLayer as String] as? Int ?? -1
    // ht > 600 skips the app's full-width menu-bar strip.
    if wd > 400 && ht > 600 && layer == 0 {
      print(w[kCGWindowNumber as String] as? Int ?? 0, Int(wd), Int(ht))
    }
  }
}
