# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

One primary user: the owner of both devices, holding an iPhone and controlling
their own Mac. No accounts, no multi-user model, no sharing. A second audience
exists but never uses the product: visitors to the public repository judging it
as engineering work.

The two audiences do not conflict. The user has stated the interface must be
easy to use with good experience regardless of who is looking, so usability
leads and expression lives in the quality of execution rather than in
decoration.

## Product Purpose

Turn an iPhone into a trackpad, keyboard and gesture pad for a Mac on the same
local network, so the Mac can be driven from across the room without buying a
peripheral. Success is the user forgetting they are using a phone: pointer
movement that feels direct, taps that land, and nothing that needs looking at
twice.

## Positioning

Zero install on either side. No App Store build, no provisioning profile, no
pairing, no cloud account, no third-party dependency. The Mac app serves the
interface to the phone's browser, so the "client" is a URL. Phone and Mac talk
directly over the LAN, so the quality of the user's internet connection is
irrelevant to responsiveness.

## Operating Context

Mixed lighting and posture, confirmed by the user. Sometimes a dark room with
the Mac on a TV across the room, sometimes a lit desk. Sometimes one hand,
sometimes two. The interface therefore cannot assume a dark room or a single
grip.

Attention is usually on the Mac's screen, not on the phone. The phone is
operated in the user's peripheral vision or by feel, which makes target size,
spacing and predictable placement more valuable than information density.

Typically installed to the iOS Home Screen and launched full screen, but also
used directly in Safari, where browser chrome takes vertical space.

The LAN address changes when the router reassigns a lease, so the QR code in
the Mac's menu bar is the reliable entry point.

## Capabilities and Constraints

Confirmed capabilities: relative pointer movement with acceleration; left,
right, middle click; double and triple click; press-and-drag; two-finger
scroll; three and four finger swipes mapped to Mission Control, App Expose,
Spaces and Show Desktop; an on-screen keyboard with latching modifier keys;
mirroring of the iPhone's own keyboard including autocorrect and dictation;
media keys; a Command-Tab app switcher that holds Command, plus a tappable grid
of running apps with icons; adjustable pointer speed, scroll speed, gesture
sensitivity, natural scrolling, and pointer acceleration.

Constraints:

- Vanilla HTML, CSS and JavaScript with no build step and no third-party
  dependency. The server is a hand-written WebSocket implementation; adding a
  front-end dependency would contradict the project's stated position.
- Served over plain HTTP on the LAN, so secure-context browser APIs are
  unavailable. Screen Wake Lock in particular cannot be relied on.
- iOS Safari is the only target browser that matters.
- Touch input only. No hover state can carry meaning.
- The page must survive reconnection: the Mac app can restart and the Wi-Fi can
  drop mid-gesture.
- Any held modifier must be released on disconnect; a stuck Command key makes
  the Mac unusable.

## Brand Commitments

Name: MacPad. No logo, wordmark, color palette or typeface has been
established. MIT licensed, copyright Ahed al-Ali.

## Evidence on Hand

Working implementation at `web/` and `Sources/`. A 51-check headless test suite
at `test/`. No screenshots, marketing copy, user research, testimonials or
usage data exist, and none may be invented.

## Product Principles

1. The Mac's screen is the output; the phone is only the input. The interface
   should not compete for attention with what the user is actually watching.
2. Reachability beats density. A control the thumb cannot reach is not a
   control.
3. Fail visibly and recover silently. Connection loss must be obvious at a
   glance and repair itself without the user intervening.
4. No irreversible surprises. Any gesture that could disrupt the Mac needs to
   be hard to trigger by accident.
5. The quality of the execution is the only brand the product has.

## Accessibility & Inclusion

No specific requirement was established by the user. Treat the operating
context as the accessibility driver: large targets, high contrast in both light
and dark, no reliance on color alone to convey state, and respect for
`prefers-reduced-motion` and `prefers-color-scheme`.
