# Changelog

## 2.4.0

- **Tables now get RTL treatment too.** A `<table>` whose first strong
  character is RTL (e.g. a Persian header row) lays out as a whole
  right-to-left — column order flips, borders land on the correct side —
  while each cell still resolves its own direction from its own text, so a
  mixed Persian/English table reads correctly cell by cell. Tables with no
  directional signal are left untouched.
- **Tables are covered by the font/size/line-height rule as well.** Copilot
  nests tables inside wrapper `div`s that the main chat-area rule
  (`> *:not(div)`) deliberately skips, so tables get their own explicit
  selector.
- **Tables stream in empty and fill cell by cell**, and cell-level mutations
  never name the table as a mutation target — cell mutations now re-queue the
  enclosing table for re-evaluation, so its direction is decided from real
  content instead of its empty state.
- **Tables sit on the correct side.** `direction` alone flips the column
  order but doesn't move a shrink-to-fit table box inside its scroll
  container: forced RTL pins the table to the right edge
  (`margin-right: 0; margin-left: auto`), forced LTR to the left, and auto
  mode does the same inline per table. The Monaco scrollable wrapper around
  the table is deliberately left LTR so Monaco's scroll math isn't desynced.
- The Monaco scrollable wrapper Copilot renders tables inside
  (`.rendered-markdown-table-scroll-wrapper`) is aligned with the configured
  direction as well, so an RTL table hugs the RTL text edge instead of
  overflowing to the right of the paragraph.

## 2.3.0

- **New `auto` direction mode, now the default.** Instead of forcing one
  direction on the whole chat area, each rendered block (paragraph, list item,
  heading, table cell, blockquote…) gets its own direction based on its text —
  so Persian answers read RTL and English answers read LTR in the same
  conversation. Code blocks and editors are left LTR as before. `rtl` and `ltr`
  remain available for forcing a single direction.
- **Better direction detection, shared by the chat area and the prompt box.**
  Detection now keys on the first *strong* character, skipping digits, bullets,
  quotes and other neutral characters, so a line like `1. سلام` is no longer
  treated as LTR. The character ranges now also cover Hebrew, Arabic
  Supplement/Extended, Arabic Presentation Forms, Thaana, NKo and Syriac —
  previously only `U+0600–U+06FF` was recognised, despite Hebrew being listed
  as supported.
- **New `Copilot RTL: Cycle Direction` command**, bound to `Ctrl+Alt+R`
  (`Cmd+Alt+R` on macOS), cycling auto → RTL → LTR.
- **Font picker lists installed system fonts** instead of requiring the family
  name to be typed by hand; manual entry is still offered as the first choice.
- **A patch reverted by a VS Code update is now detected explicitly.** The
  re-apply notification says so when it happens, and with `autoEnable` off the
  new `copilotRtl.notifyWhenPatchReverted` setting warns with a *Re-apply Now*
  action instead of the styling quietly stopping working.
- The status bar item now shows a mode-specific icon.

## 2.2.1

- Fixed the live-apply mechanism actually working: settings polling now uses
  `fetch()` of a plain JSON file instead of a dynamically-created `<script>`
  tag, which was silently blocked by workbench's Trusted Types policy.
- Default `copilotRtl.lineHeight` changed from `1.8` to `1.6`.
- Everything the extension places next to `workbench.html` (script, live
  config, bundled font) now lives under one `vscode-copilot-rtl/` folder
  instead of being scattered — the whole folder is removed on Disable.
- Merged the `Re-apply Patch` command into `Enable`: Enable now always
  strips any existing patch first, then re-applies fresh, so it covers both
  a first install and repairing a patch a VS Code update reverted. One
  clearly-named action instead of two overlapping ones.
- `Enable`/`Disable` command titles now say "(requires reload)" so it's
  clear upfront which actions need one and which (the live settings) don't.

## 2.2.0

- These four settings apply **live** — no window reload needed. The injected
  script polls a small config file the extension writes instantly on every
  change, and re-renders its styles within about a second.
- Adds `copilotRtl.lineHeight` settings; a status bar item opens a quick menu to
  change any of them without going through Settings.

## 2.1.0

- Adds `copilotRtl.direction`, `copilotRtl.fontFamily`, and `copilotRtl.fontSize`
  settings; a status bar item opens a quick menu to change any of them without
  going through Settings.
- Bundles the Vazirmatn font so it's used automatically as a fallback when it
  isn't installed on the system, whatever font family is chosen.

## 2.0.0

- Initial extension release, packaging the original DevTools console script.
- Auto-applies the RTL patch on startup and re-applies it after VS Code updates.
- Adds `Copilot RTL: Enable` / `Disable` / `Re-apply Patch` commands.
- Suppresses the "installation appears to be corrupt" notice by patching the
  relevant `product.json` checksum entry.

## 1.0.1

- Rewrote `rtl-fix.js` as an IIFE with two parts: forced RTL CSS for the chat
  area, plus per-line auto direction detection (RTL/LTR) in the prompt input box.

## 1.0.0

- Initial release of the DevTools console script: applies RTL direction,
  Vazirmatn font, and font size to the Copilot Chat panel via static CSS.
