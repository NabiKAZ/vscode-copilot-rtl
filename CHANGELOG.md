# Changelog

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
