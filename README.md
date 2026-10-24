# MacPad

Turns an iPhone into a trackpad, keyboard and gesture pad for a Mac over the
local network. No App Store build, no pairing, no cloud. A Swift menu bar app
serves a web page; the phone opens it and streams input over a WebSocket.

Written because my Mac was plugged into a TV across the room and I didn't have
a remote.

## Why a web page instead of a native iOS app

A native client needs Xcode, a provisioning profile, and a re-signing session
every seven days on a free account. A web page needs none of that, and Safari
already exposes everything required: multi-touch via `Touch` events, the system
keyboard, and `visualViewport` for laying out around it. Added to the Home
Screen it runs full screen with no browser chrome.

The tradeoff is no background execution and no access to the Taptic Engine.
Neither matters for this.

## Latency

Phone and Mac talk directly over the LAN, so nothing depends on internet speed.
Three things keep it responsive:

- `TCP_NODELAY` on the listener. Without it Nagle batches the small, frequent
  movement packets and the pointer visibly stutters.
- Pointer deltas are accumulated and flushed once per animation frame, so a
  120 Hz touch stream doesn't become 120 WebSocket messages per second.
- Movement is relative, so a dropped packet costs a few pixels rather than
  desynchronising the cursor.

## Architecture

```
Sources/
  main.swift                  NSApplication bootstrap (menu bar accessory)
  Config.swift                port, timeouts, protocol constants
  MenuBar.swift               status item, QR window, permission state
  Server.swift                NWListener, routing, running-app list
  WebSocketConnection.swift   HTTP upgrade and RFC 6455 framing
  EventSynth.swift            CGEvent synthesis (pointer, clicks, keys)
  KeyMap.swift                keycodes, media keys, gesture shortcuts
  WebAssets.swift             asset lookup
  NetworkInterfaces.swift     LAN address discovery
  web/
  index.html                  markup only
  styles.css
  app.js                      gesture recognition and protocol
test/
  client-tests.js             headless gesture/protocol suite
```

The WebSocket server is written directly against `Network.framework`: handshake,
frame parsing, masking, ping/pong. It is about 250 lines and removes the only
dependency the project would otherwise have.

### Protocol

Compact JSON per frame, phone to Mac:

| Message | Meaning |
| --- | --- |
| `{t:"m", x, y}` | relative pointer move |
| `{t:"c", b, n}` | click; button 0/1/2, n = click count |
| `{t:"d"\|"u", b}` | button down / up (drag) |
| `{t:"s", x, y}` | scroll by pixels |
| `{t:"k", key, mod}` | key press with modifiers |
| `{t:"mod", m, down}` | hold or release a modifier |
| `{t:"txt", s}` | type a string |
| `{t:"apps"}` / `{t:"activate", b}` | list or focus running apps |

Mac to phone: a `hello` on connect, Accessibility state changes, and the app
list with icons as base64 PNG.

## Design notes

**Synthesised presses of system hotkeys do nothing, so gestures route around
them.** macOS exposes no API for injecting a real trackpad gesture, so the
obvious approach is to send the shortcut each gesture triggers. That turns out
not to work: Ctrl+Up, Ctrl+Down, Ctrl+Left/Right and F11 were each measured
firing nothing, while Cmd+Tab and Cmd+` fire every time. The difference is that
the first group are system hotkeys and the second are ordinary app shortcuts.

Each gesture therefore uses whatever mechanism actually works. Three fingers up
launches Mission Control directly. Three fingers sideways activates the adjacent
app, which moves between windows and, because a full-screen app owns its own
Space, between Spaces too. Three fingers down sends Cmd+`, cycling the current
app's windows. Each was verified against a signal specific to its effect: a Dock
full-screen window for Mission Control, the frontmost app for cycling apps, and
CGWindowList front-to-back order for cycling windows.

**Modifiers are posted as `flagsChanged`, not as flags on the key event.**
Setting `maskControl` on a key event is enough for most applications but not
reliably for system hotkeys. Pressing the modifier for real, sending the key,
then releasing, behaves like hardware.

**Held modifiers are released defensively.** Holding Command is what keeps the
app switcher panel on screen, which means a dropped connection could leave
Command stuck down system-wide. Modifiers are released when the last client
disconnects, and a watchdog clears them after 20 seconds of silence.

**Touch state is reconciled against `e.touches` every event.** iOS drops
`touchend` when a system gesture steals the sequence. Tracking touches
incrementally leaves a phantom finger behind, after which every one-finger tap
reads as two and right-clicks instead. Treating the browser's list as
authoritative makes it self-healing.

**Taps are classified by simultaneous landings, not peak finger count.** A thumb
brushing the pad shortly after the tapping finger shouldn't turn a left click
into a right click. Only fingers landing within 140 ms of each other count.

**Text entry is the iPhone's keyboard, never a drawn one.** A web QWERTY gives
up autocorrect, dictation and swipe to reproduce something iOS already does
better. The panel supplies only what iOS cannot send to a Mac: latching
modifiers, esc and tab, the six universal chord shortcuts, and arrows, which
the iOS keyboard has none of. The field diffs its own contents and sends the
delta, so an autocorrect replacement arrives as a deletion then an insertion,
and it rides above the system keyboard using `visualViewport`, which iOS does
not shrink the layout viewport for.

**The trackpad is never covered.** An open panel is capped at runtime so the
pad keeps a usable height, and the pad sheds its legend rather than shrink into
a card. You can click into a field on the Mac and keep typing without closing
anything.

**The UI is loaded from Application Support, not the app bundle.** The app is
ad-hoc signed, so rebuilding changes its code signature and macOS revokes the
Accessibility grant. Reading the UI from outside the bundle means front end
changes ship with a file copy and no re-signing.

The visual system is recorded in [DESIGN.md](DESIGN.md), with a
machine-readable sidecar at `.impeccable/design.json`. Product constraints that
outlive any redesign are in [PRODUCT.md](PRODUCT.md).

## Build and run

```sh
./build.sh                      # compile, sign, install to /Applications
open /Applications/MacPad.app
```

Requires macOS 13+ and the Xcode command line tools. No package manager, no
dependencies.

First launch asks for Accessibility permission, which macOS requires before any
process can post input events. The menu bar icon and the phone both show the
current state and clear as soon as it is granted.

Front end changes only:

```sh
./sync-ui.sh                    # copy web/ across, then reload on the phone
```

## Tests

```sh
./test/run.sh
```

51 checks covering gesture recognition, tap classification, scroll, drag,
keyboard mirroring, modifier latching, and the app switcher. `app.js` runs in a
stub DOM, so touch sequences are replayed as data and assertions are made
against the exact protocol messages produced. Timers run on a virtual clock,
which makes timing-dependent behaviour (drag arming, double-tap) deterministic.

The two regression tests were each checked against the original fault to
confirm they fail without the fix: the scroll bug produced a 1879 pixel pointer
jump, and the phantom-finger bug suppressed the click entirely.

## Known issues

- The LAN address changes when the router reassigns a lease. The QR code is
  always current; a bookmarked URL may not be. Bonjour would fix this.
- Gesture routing was worked out against one Mac. On a machine where the system
  hotkeys do respond to a synthetic press, sending them would be the tidier
  path; the shortcut remains as a fallback for Mission Control only.
- The running-app list is about 230 KB because it carries icons as base64 PNG.
  That is 40 ms on a LAN and has not been worth optimising.

## Security

The server binds to the LAN and requires a token, stored in `~/.macpad-token`
and embedded in the QR code. Requests without it are rejected before the
WebSocket upgrade. Static file serving is restricted to a flat allowlist of
extensions with no path traversal.

This is enough for a home network and not enough for a hostile one. There is no
TLS, so treat it as a trusted-LAN tool.

## License

MIT.
