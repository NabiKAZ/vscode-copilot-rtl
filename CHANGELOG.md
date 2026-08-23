# Changelog

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
