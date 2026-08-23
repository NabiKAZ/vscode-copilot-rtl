# Copilot Chat RTL Support

A Visual Studio Code extension that adds **Right-to-Left (RTL)** support to the GitHub Copilot Chat panel — optimized for Persian (Farsi) and other RTL languages.

## Features

- Applies RTL direction to the Copilot Chat interface
- Right-aligns input text for better readability
- Uses the Persian-friendly [Vazirmatn font](https://github.com/rastikerdar/vazirmatn)
- Preserves LTR direction for code blocks
- Automatically detects RTL vs. LTR per line in the prompt input box
- Re-applies itself on startup, including after a VS Code update overwrites the patch

## Preview

Here is an example of the result after applying the extension:

![Copilot RTL Preview](https://github.com/user-attachments/assets/076a7941-13c5-4f01-a4f1-2b8225c9673f)

## Installation

1. Install the extension from the VS Code Marketplace (search for **"Copilot Chat RTL Support"**), or install the `.vsix` manually:
   ```
   code --install-extension copilot-rtl-X.X.X.vsix
   ```
2. Reload the window when prompted (or run **Developer: Reload Window**).
3. Make sure the [Vazirmatn font](https://github.com/rastikerdar/vazirmatn) is installed on your system for best results.

That's it — no console, no manual steps after the first reload.

## Commands

| Command | Description |
|---|---|
| `Copilot RTL: Enable` | Apply the patch now |
| `Copilot RTL: Disable` | Remove the patch and restore the original files |
| `Copilot RTL: Re-apply Patch (after a VS Code update)` | Force re-apply, useful if an update reverted it |

## Settings

| Setting | Default | Description |
|---|---|---|
| `copilotRtl.autoEnable` | `true` | Automatically (re)apply the patch on startup |

## ⚠️ Uninstalling

**Run the `Copilot RTL: Disable` command *before* uninstalling this extension** — not after.

How and where to run it:

1. Open the **Command Palette**:
   - Windows / Linux: <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>
   - macOS: <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>
   - (or via the menu: **View > Command Palette…**)
2. Type `Copilot RTL: Disable` and press <kbd>Enter</kbd> when it appears in the list.
3. A notification will ask to reload — click **Reload Window**.
4. Only now go to the **Extensions** view (<kbd>Ctrl</kbd>/<kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>X</kbd>) and uninstall the extension.

If you already uninstalled without disabling first, see [TECHNICAL.md](./TECHNICAL.md#recovering-from-an-uninstall-without-disabling-first) for how to fix it.

## Manual (no-install) usage

If you'd rather not install anything, you can still run the original script by hand:

1. Open **Help > Toggle Developer Tools > Console**.
2. Paste the contents of [`rtl-fix.js`](./rtl-fix.js) and press **Enter**.
3. The effect is temporary and resets on reload — repeat whenever needed.

## To-Do & Improvements

- [x] Fix issue where LTR blocks sometimes disappear
- [x] Improve RTL support for the question input area
- [x] Package as a VS Code extension
- [ ] Add a toggle to switch between RTL and LTR from the status bar
- [ ] Auto-download/register the Vazirmatn font if missing

## For developers

Curious how the patch actually works under the hood, or want to build/publish this extension yourself? See [TECHNICAL.md](./TECHNICAL.md).

## License

This project is licensed under the **GNU General Public License v3.0**. See the [LICENSE](./LICENSE) file for details.

## Support

If this project has been useful to you and you'd like to support its development:

- ⭐ **Give a Star**: Show your support with a ⭐ on the GitHub repository.
- 💎 **Donate**:
   - **USDT (TRC20)**: `TEHjxGqu5Y2ExKBWzArBJEmrtzz3mgV5Hb`
   - **TON**: `nabikaz.ton`
- 🐦 **Follow / say hi**: [x.com/NabiKAZ](https://x.com/NabiKAZ)

Thank you for being a part of this journey! 🚀
