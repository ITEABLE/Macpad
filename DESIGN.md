---
name: MacPad
description: An engraved control plate for a Mac, operated by thumb and read from the corner of the eye.
colors:
  plate: "#0B0B0D"
  field: "#15161A"
  field-down: "#1F212733"
  seam: "#23252B"
  ink: "#E9E6DF"
  ink-dim: "#878D99"
  ink-faint: "#7C818B"
  lamp: "#FFB546"
  lamp-glow: "rgba(255, 181, 70, 0.30)"
  lamp-wash: "rgba(255, 181, 70, 0.07)"
  fault: "#FF6B5A"
  plate-day: "#E7E5E2"
  field-day: "#F6F4F1"
  field-down-day: "#0000000d"
  seam-day: "#D0CDC8"
  ink-day: "#1A1916"
  ink-dim-day: "#56534E"
  ink-faint-day: "#65625C"
  lamp-day: "#8A4E00"
  lamp-glow-day: "rgba(138, 78, 0, 0.22)"
  lamp-wash-day: "rgba(138, 78, 0, 0.06)"
  fault-day: "#B3261E"
typography:
  body:
    fontFamily: "-apple-system, \"SF Pro Text\", system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.3
    fontFeature: "tabular-nums"
  glyph:
    fontFamily: "-apple-system, \"SF Pro Text\", system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 500
    lineHeight: 1
  keycap:
    fontFamily: "-apple-system, \"SF Pro Text\", system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.3
  readout:
    fontFamily: "-apple-system, \"SF Pro Text\", system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.16em"
  legend:
    fontFamily: "-apple-system, \"SF Pro Text\", system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "0.04em"
  label:
    fontFamily: "-apple-system, \"SF Pro Text\", system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "0.12em"
  section:
    fontFamily: "-apple-system, \"SF Pro Text\", system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.2em"
rounded:
  plate: "5px"
  lamp: "50%"
spacing:
  hair: "0.25rem"
  gap: "0.375rem"
  legend-row: "0.45rem"
  sm: "0.5rem"
  edge-in: "0.625rem"
  edge: "0.75rem"
  inset: "0.875rem"
  bank: "1rem"
  rail: "1.125rem"
  isolate: "1.25rem"
components:
  key:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    typography: "{typography.keycap}"
    rounded: "{rounded.plate}"
    padding: "0.25rem 0.375rem"
    height: "3.25rem"
  key-pressed:
    backgroundColor: "{colors.lamp-wash}"
    textColor: "{colors.lamp}"
    rounded: "{rounded.plate}"
  key-down:
    backgroundColor: "{colors.field-down}"
    textColor: "{colors.ink}"
  key-isolated:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.plate}"
    height: "3.25rem"
  key-compact:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    rounded: "{rounded.plate}"
    height: "2.75rem"
  ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-dim}"
    typography: "{typography.readout}"
    rounded: "{rounded.plate}"
    padding: "0 0.875rem"
    height: "2.75rem"
  pad:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink-dim}"
    rounded: "{rounded.plate}"
    padding: "1rem 0 0"
    height: "8.5rem"
  sheet:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.ink}"
    padding: "0.75rem"
  compose-input:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.plate}"
    padding: "0 0.75rem"
    height: "2.75rem"
  app-tile:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink-faint}"
    typography: "{typography.label}"
    rounded: "{rounded.plate}"
    padding: "0.625rem 0.25rem"
  app-tile-current:
    backgroundColor: "{colors.field}"
    textColor: "{colors.lamp}"
    rounded: "{rounded.plate}"
  indicator-lamp:
    backgroundColor: "{colors.ink-faint}"
    rounded: "{rounded.lamp}"
    size: "0.625rem"
  indicator-lamp-live:
    backgroundColor: "{colors.lamp}"
    rounded: "{rounded.lamp}"
    size: "0.625rem"
  indicator-lamp-fault:
    backgroundColor: "{colors.fault}"
    rounded: "{rounded.lamp}"
    size: "0.625rem"
---

# Design System: MacPad

## Overview

**Creative North Star: "The Engraved Lift Panel"**

MacPad is a control plate, not an app screen. Everything in it is built from the discipline of a lift call panel: targets you can hit without aiming, a single lamp colour that means exactly one thing, and a spatial rhythm the thumb memorises so the eye can stay on the Mac. The plate is engraved, never moulded — surfaces are separated by a one-pixel seam and a single step of luminance, and the only inner detail on the trackpad is a hairline rule set 10px in from its edge, which makes the field read as a plate rather than a card.

Light and dark are both first-class, not a theme and its override. The product is used in a dark room with the Mac on a TV and at a lit desk, so the stylesheet declares `color-scheme: dark light` and ships a complete daylight twin with identical geometry on a warm-neutral plate (`#E7E5E2`) that shares the dark twin's warm axis. Neither scheme is a default and neither is the "real" one.

Density is deliberately low. One primary target size (52px) governs every control the thumb must hit, a 44px floor governs the compact keys and secondary buttons inside sheets, and controls that rearrange the Mac are separated from the rest by real empty space rather than a divider line. The system refuses the category default — the dark grey slab with a featureless pad and a row of undersized icon buttons — and it equally refuses brushed-metal skeuomorphism: there are no bevels, no gloss, no gradients and no metal bezels anywhere in the build. Type is the platform sans; the typographic work is carried by scale, wide tracking and tabular figures, because the page is served over the LAN with no internet and no dependency.

**Key Characteristics:**
- Engraved flatness: one luminance step plus a 1px seam does all the separating.
- Two co-equal schemes, identical geometry, one warm axis.
- One chromatic colour (amber), reserved entirely for "engaged".
- 52px primary target, 44px floor, air between banks.
- Nothing eases except one 220ms sheet slide and one 260ms lamp warm.
- Flat corners: a single 5px radius, plus a round indicator lamp.

## Colors

A two-step greyscale plate with warm ink, one amber lamp, and one red fault colour; nothing else is chromatic.

### Primary
- **Lamp Amber** (`#FFB546` dark / `#8A4E00` daylight): the only chromatic colour in the system, and it means exactly one state: engaged. It appears on a latched modifier, on Command held during an app switch, on an active drag, on the frontmost app tile, on the live connection lamp, and on the gesture flash. It also themes the browser's own surfaces — selection background, caret, and the 2px `:focus-visible` outline. Its two companions are a glow (`lamp-glow`, 30% dark / 22% day) and a fill wash (`lamp-wash`, 7% dark / 6% day).
- **Fault Red** (`#FF6B5A` dark / `#B3261E` daylight): disconnection only. It colours the indicator lamp and its status word simultaneously, so the state is never carried by hue alone.

### Neutral
- **Plate** (`#0B0B0D` dark / `#E7E5E2` daylight): the page ground and the background of every sheet. The daylight plate is warm-neutral, deliberately not cream.
- **Field** (`#15161A` dark / `#F6F4F1` daylight): one step off the plate. Every raised surface — the trackpad, keys, app tiles, the compose input — sits on it.
- **Field Down** (`#1F212733` dark / `#0000000d` daylight): a translucent press state for the key under the finger.
- **Seam** (`#23252B` dark / `#D0CDC8` daylight): hairline divisions. Every border in the build is 1px of seam, including the trackpad's engraved inner rule and the scrollbar thumb.
- **Ink** (`#E9E6DF` dark / `#1A1916` daylight): primary text and key faces; warm, not pure white or pure black.
- **Ink Dim** (`#878D99` dark / `#56534E` daylight): legend terms, sheet titles, ghost-button labels, the `accent-color` for native inputs.
- **Ink Faint** (`#7C818B` dark / `#65625C` daylight): keycaps, host address, app labels, placeholder text, the unlit indicator lamp.

### Named Rules
**The One Lamp Rule.** Amber is the only chromatic colour and it means engaged, nothing else. It is never used for emphasis, branding, decoration or hierarchy. If more than a couple of elements on screen are amber at once, the lamp has stopped meaning anything.

**The Luminance-Not-Hue Rule.** State changes move within one palette. A control that engages goes brighter and warmer; it never swaps to a different hue family, and it never carries its state in colour alone — the pressed key shifts border, text, background and ring together.

**The Two-Step Rule.** Depth is exactly two values: plate and field, one luminance step apart, divided by a 1px seam. There is no third surface level and no shadow doing the dividing.

## Typography

**Body Font:** the platform sans (`-apple-system`, "SF Pro Text", `system-ui`, sans-serif)
**Display Font:** none. The system has no display face and no heading ramp.
**Label/Mono Font:** none distinct; readouts use the same stack with `font-variant-numeric: tabular-nums` set globally on `body`.

**Character:** Plainspoken and instrumental. There is no editorial voice here, only legends, keycaps and readouts. The typographic work is done by scale, uppercase tracking and tabular figures rather than by a typeface, because the page must load over the LAN with no internet and the project ships zero dependencies.

### Hierarchy
- **Glyph** (500, 17px / 1.0625rem, line-height 1): the hardware symbols printed on Apple keyboards — ⌘ ⌃ ⌥ ⇧ and the ⌘C-class chords. These are set as type on purpose; they are characters, not icons.
- **Keycap** (400, 15px / 0.9375rem, 1.3): the face of a word key such as "Click" or "Right click". Wide keys take weight 500.
- **Readout** (600, 13px / 0.8125rem, tracking 0.16em, uppercase): the connection status word. Also the plain 13px size for ghost buttons, settings labels, toggles and the empty-state line.
- **Gesture flash**: the momentary confirmation printed across the pad when a multi-finger gesture fires. It takes the Readout step rather than a size of its own, because the flash and the connection word are both the surface reporting its state.
- **Legend** (600, 12px / 0.75rem, tracking 0.04em for terms; 400 for definitions, 1.25): the ranked gesture legend on the pad. Also the 12px size for isolated-key captions, settings values and the footnote.
- **Label** (400, 11px / 0.6875rem, tracking 0.12em, uppercase): keycap sublabels under a glyph or icon, the host address (0.1em), and app tile names (0.02em, not uppercased).
- **Section** (600, 11px / 0.6875rem, tracking 0.2em, uppercase): sheet titles. The widest tracking in the system and the only thing that behaves like a heading.

### Named Rules
**The No-Display-Type Rule.** There is no hero size and no heading ramp. The largest text in the system is 17px. Nothing on this surface is to be read from across the room; the Mac's screen is the output.

**The Tracking-Carries-It Rule.** Small uppercase text earns its authority from tracking, which widens as the text gets smaller and more structural: 0.04em on legend terms, 0.12em on keycaps, 0.16em on the status readout, 0.2em on sheet titles.

**The Hardware-Glyph Rule.** ⌘ ⌃ ⌥ ⇧ ⏎-class symbols are typed characters, never drawn icons, because they are the symbols printed on the user's own keyboard. Everything else pictorial is an SVG from the sprite.

## Layout

A single full-height column, no routes and no scrolling page: `html, body` are locked at 100% with `overflow: hidden`, `overscroll-behavior: none` and `touch-action: none`, and the body carries the four `env(safe-area-inset-*)` values as padding so the plate reaches the device edges.

Top to bottom the column is fixed in order: the connection indicator (fixed height, 16/18/14px padding, closed by a 1px seam below), the trackpad (`flex: 1 1 auto`, so it absorbs all spare height), then the control banks (fixed height, 10px top / 12px sides / 12px bottom). Sheets are `position: fixed` to the bottom edge at `z-index: 10`, capped at `60vh` by CSS and re-capped at runtime.

Banks are CSS grids of 2, 3, 4 or 5 equal columns — plus one 2fr/1fr split for the click pair — with a 6px gutter and a 6px step between consecutive banks. A bank marked isolated takes a 20px top margin instead: that gap is the only separator used, and it replaces a divider rule. The app grid is four fixed columns with an 8px gutter, capped at `28vh` and scrolled with a 3px seam-coloured thumb.

The spacing rhythm is a 2px-resolution ramp used at a handful of fixed steps: 4px internal, 6px grid gutters and bank steps, 8px app gutter, 10px edge-in and inner rule inset, 12px plate margins and sheet padding, 14px ghost padding, 16px pad top, 18px indicator rail, 20px isolation gap.

### Named Rules
**The Pad Is Never Covered Rule.** The trackpad keeps a usable height no matter what is open. CSS floors it at 8.5rem; JavaScript recomputes an open sheet's `max-height` against a 150px pad floor and the indicator's height, and lifts the sheet above the system keyboard using `visualViewport`.

**The Shed-Before-Shrink Rule.** When a sheet opens, the pad drops its legend and the banks hide entirely (`body[data-sheet="open"]`) rather than let the pad compress into a card. Content is given up before geometry is.

**The Bottom-Reach Rule.** Panel openers (Apps, Keyboard, Settings) live in the last bank at the bottom of the column, because the top corners are the hardest reach for a thumb. Frequency orders the banks; reach orders the column.

## Elevation & Depth

This system has no elevation. Nothing is lifted, nothing casts a drop shadow, and there is no blur, gradient or bevel anywhere in the build. Depth is tonal and linear: a single luminance step from plate to field, closed by a 1px seam. The trackpad adds one engraved inner rule — a 1px seam border inset 10px at 50% opacity — which is the only ornament in the system and reads as a machined line scored into the plate, not as a raised edge.

The only `box-shadow` values in the build are zero-offset amber glows and one inset ring. They are not elevation; they are the lamp.

### Shadow Vocabulary
- **Indicator glow** (`box-shadow: 0 0 0.5rem var(--lamp-glow)`): on the connection lamp when the link is live.
- **Engagement glow** (`box-shadow: 0 0 0.75rem var(--lamp-glow)`): on the trackpad border during an active drag.
- **Engagement ring** (`box-shadow: inset 0 0 0 1px var(--lamp), 0 0 0.75rem var(--lamp-glow)`): on a latched modifier or held-Command key. The inset 1px amber ring is the halo's hard edge; the outer glow is its bleed.

### Named Rules
**The Flat Plate Rule.** No bevel, no chrome, no gloss, no gradient, no drop shadow. The plate is engraved, not moulded. Any shadow in this system is zero-offset and amber, which makes it light rather than depth.

**The Glow Is Never Alone Rule.** The lamp halo is a deliberate, named exception to the usual prohibition on zero-offset glows, and it is only legitimate because it is always reinforced: engagement sets border-colour, text-colour and background wash alongside the glow, so the state survives on a surface where the glow is invisible.

## Shapes

One corner radius governs the whole system: 5px (`--radius`), applied identically to the trackpad, every key, ghost buttons, app tiles and the compose input. It is small enough to read as a milled corner on a plate rather than a soft card. The single exception is the connection lamp, which is a true circle (`border-radius: 50%`, 10px) because it is a lamp.

Every edge in the system is a 1px seam border (`--seam-w`), never a thicker rule and never a colour other than seam. The isolated keys drop their background to transparent and keep only that border, which makes them read as outlines cut into the plate. Nothing is clipped to a non-rectangular silhouette.

Icons are an authored inline SVG sprite: one 24×24 grid, one 1.6 stroke weight, `fill: none`, round caps and joins, no filled shapes. They render at 20px inside a key and 17px inside a ghost button.

### Named Rules
**The One Radius Rule.** 5px everywhere, or a full circle for a lamp. There is no radius scale, no pill and no square-cornered exception.

**The Hairline Rule.** Every division in the system is exactly 1px of seam colour. Weight is never used to signal importance; a division is a division.

## Components

### Keys
The primitive of the system. A key is a field-coloured plate with a seam border, a 5px radius, and a guaranteed target.
- **Shape:** milled 5px corners, 1px seam border, column flex with a 4px gap between icon/glyph and caption.
- **Primary:** field background, ink text, `min-height: var(--target)` (52px), 4px/6px padding, 15px keycap type. Content is a hardware glyph, a 20px sprite icon, a word, or an icon plus an 11px uppercase caption.
- **Pressed (finger down):** background swaps to the translucent field-down value. No movement, no scale, no transition — it lands immediately.
- **Engaged (`aria-pressed="true"`):** the signature. Amber border, amber text, amber caption, 7% amber wash, plus the inset 1px amber ring and outer glow. It persists for exactly as long as the state is held.
- **Isolated:** transparent background, seam border retained, 12px caption at 0.08em. Used for the system-disrupting gestures and the panel openers, which also sit behind a 20px gap.
- **Compact:** the same key at a 44px floor (`min-height: 2.75rem`) inside sheet rows.

### Ghost Buttons
Quiet, secondary, sheet-only: transparent background, seam border, ink-dim 13px label, 44px floor, 14px side padding, 6px gap to a 17px icon. Press state is the same field-down wash. Used for Done and Refresh — never for an action that changes the Mac.

### Trackpad
The product's centre and its only large surface. Field background, seam border, 5px radius, `flex: 1 1 auto` with an 8.5rem floor. It carries three things and no chrome: the engraved inner rule, the ranked gesture legend anchored to its bottom edge, and a full-bleed flash layer. The legend fades to 25% opacity while a finger is down (`data-touching="yes"`) and is removed outright when a sheet opens. During a drag (`data-engaged="drag"`) the whole border goes amber with the engagement glow.

### Gesture Flash
A full-bleed overlay inside the pad: 7% amber wash, amber 14px uppercase text at 0.14em, centred, `aria-live="polite"`. It is the only element that transitions opacity, at the 90ms linear step. It names the gesture that just fired — the pad's way of confirming without the user looking down for longer than a glance.

### Sheets
Bottom-anchored panels on the plate colour, closed by a 1px seam along the top, 12px padding plus the bottom safe-area inset. Closed state is `translateY(110%)`; open is `translateY(0)`, carried by the system's one eased moment: 220ms `cubic-bezier(.2,.75,.25,1)`. Capped at 60vh in CSS and re-capped in JS against the pad floor. Scrolls with `touch-action: pan-y` and `overscroll-behavior: contain`. A sheet head is a flex row with an 11px 0.2em uppercase ink-dim title and ghost buttons trailing.

### Inputs / Fields
- **Compose input:** field background, seam border, 5px radius, 44px floor, 12px side padding, 16px text — the 16px is load-bearing, since anything smaller makes iOS zoom the page. Placeholder is ink-faint. Caret is amber; selection is amber on plate.
- **Settings field:** a 10px/4px row closed by a 1px seam below, with a baseline-aligned label/value pair (13px label, 12px 0.08em value) and a full-width 28px native range below it.
- **Toggle row:** a space-between flex row, 13px label, native 48×28px checkbox.
- **Focus:** there is no hover state anywhere in this system — the surface is touch-only, so hover can never carry meaning. Keyboard focus is a 2px amber outline at 2px offset.
- **Native chrome:** native controls are themed from the palette rather than left to the user agent (`accent-color: var(--ink-dim)`, `caret-color: var(--lamp)`, `scrollbar-color: var(--seam) transparent`).

### Connection Indicator
The first thing read on the surface, and the only persistent status. A 10px round lamp plus a 13px uppercase 0.16em status word plus an 11px ink-faint host address pushed to the right edge. Three states: down (ink-faint lamp), live (amber lamp with the 0.5rem glow, warmed in by a 260ms `warm` keyframe — the one authored animation), fault (fault-red lamp *and* fault-red word).

### App Tiles
A four-column grid of field-coloured tiles: 5px radius, seam border, 10px/4px padding, a 36px app icon above an 11px ink-faint truncating label. The frontmost app (`aria-current="true"`) takes an amber border and amber label — engagement again, same vocabulary, no glow needed at tile scale.

### Signature: The Lamp Ring
Anything engaged wears a persistent illuminated halo for as long as the state is held: a latched modifier, Command held through an app switch, an active drag, a live connection. The halo is always four signals at once — border, text, wash and glow — so it survives colour-blindness, glare and a washed-out daylight screen. It never animates on, never pulses, and never swaps hue. It is rare by design: if several rings are lit at once, the vocabulary has been overspent.

## Do's and Don'ts

### Do:
- **Do** give every thumb target the primary floor (52px / `var(--target)`) and never go below 44px for a secondary control inside a sheet.
- **Do** carry engaged state with the full lamp ring — border, text, wash and glow together — so the state never depends on the glow alone.
- **Do** use a 1px seam border for every division, and a 5px radius for every rectangular surface.
- **Do** separate a disruptive control with real empty space (20px bank margin), not with a divider line.
- **Do** ship any new token into both schemes at once; dark and light are co-equal, and the daylight twin keeps identical geometry on a warm-neutral plate.
- **Do** keep state landing in two frames (`--step: 90ms linear`). The only eased moments in the system are the 220ms sheet slide and the 260ms lamp warm, both inside `prefers-reduced-motion: no-preference`.
- **Do** set hardware modifier symbols (⌘ ⌃ ⌥ ⇧) as type, and everything else pictorial as a 1.6-stroke 24×24 sprite icon.
- **Do** keep the pad usable at all times: cap sheets against the pad floor and drop the legend before the pad shrinks.
- **Do** theme the browser's own surfaces from the palette — selection, caret, focus ring, scrollbar, accent-color, tabular numerals.

### Don't:
- **Don't** introduce a second chromatic colour, or spend amber on anything other than "engaged". Fault red is the single exception and it is reserved for disconnection.
- **Don't** add a bevel, gloss, gradient, metal bezel or offset drop shadow. Every shadow in this system is a zero-offset amber glow or an inset amber ring.
- **Don't** signal state with hue. Engagement is luminance within one palette.
- **Don't** add a radius scale. 5px, or a circle for a lamp.
- **Don't** add a display size or a heading ramp. 17px is the largest type in the system.
- **Don't** attach meaning to hover; the surface is touch-only and hover never fires.
- **Don't** draw a QWERTY keyboard. Text entry is the iPhone's own keyboard; the sheet supplies only what iOS cannot send to a Mac.
- **Don't** let a sheet cover the trackpad, or let the pad compress into a card to make room.
- **Don't** add a webfont, icon font or any third-party asset. The page must load over the LAN with no internet, which is why the platform sans ships.
- **Don't** animate an engaged state on. The ring appears in two frames and stays as long as the state is held.
