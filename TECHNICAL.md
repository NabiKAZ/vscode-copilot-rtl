# Technical notes

This document covers how the patch actually works, recovery details, and how to build/publish the extension. End users don't need any of this — see [README.md](./README.md).

## How it works

VS Code extensions normally can't touch the main workbench UI (only webviews). The Copilot Chat panel, however, is part of the workbench itself. So, like the original DevTools console script, this extension patches VS Code's own `workbench.html` to load the RTL script — the same technique used by tools such as *Custom CSS and JS Loader*.

Two things are worth knowing, because `workbench.html` and `product.json` are shared files that other extensions using the same technique may also be editing:

- **Everything this extension places next to workbench.html lives in one folder.** Rather than scattering files loosely, the script, live config, and bundled font all go under a single `vscode-copilot-rtl/` folder next to `workbench.html` — easy to spot, and the whole folder is removed in one step on Disable.
- **The RTL logic lives in its own file.** `workbench.html` only gets a single `<script src="./vscode-copilot-rtl/copilot-rtl-fix.js">` reference (workbench's CSP blocks inline scripts entirely — only `'self'` sources are allowed). `rtl-fix.js` itself is static/generic — it never needs rewriting or re-patching to reflect settings changes (see next point).
- **Settings apply live, via a polled JSON config file — no reload.** `rtl-fix.js` runs inside the workbench window with no access to the `vscode` API, so it can't call `vscode.workspace.getConfiguration` itself, and there's no supported channel for the extension host to push a message into an already-open workbench window. Instead: the extension writes a tiny `vscode-copilot-rtl/copilot-rtl-config.json`, instantly, on every `copilotRtl.*` settings change. The already-running `rtl-fix.js` fetches this file roughly once a second (`fetch(path, { cache: 'no-store' })`) and re-renders its `<style>` element's content immediately if the config changed.
- **Why `fetch()` and not a polled `<script>` tag.** An earlier version polled the config by creating a fresh `<script>` element each cycle and reading a global variable it set. Two problems ruled that out: workbench enforces `require-trusted-types-for 'script'`, so assigning a plain string to a *dynamically created* `<script>`'s `.src` throws (`... requires 'TrustedScriptURL' assignment`) — the initial patch `<script>` tag is exempt because it comes from the HTML parser, not a JS sink, but anything created at runtime isn't. Registering our own Trusted Types policy to work around this (`trustedTypes.createPolicy('copilot-rtl', {...})`) also fails: workbench's `trusted-types` CSP directive only allow-lists its own internal policy names (things like `amdLoader`, `dompurify`, `lit-html`, …), so a custom policy name is rejected outright. `fetch()` sidesteps all of this — it isn't a Trusted Types sink, so a plain JSON *data* file can be polled with no special handling, which is also why the config file is JSON rather than a `.js` file executed via `<script>`.
- **The bundled font is a fallback, not a replacement.** `fonts/Vazirmatn-Variable.woff2` (the OFL-licensed variable font from the [`vazirmatn`](https://www.npmjs.com/package/vazirmatn) npm package) is copied once into `vscode-copilot-rtl/` — no subfolder of its own, since it's a single file. The injected CSS declares `@font-face { font-family: 'Vazirmatn'; src: local('Vazirmatn'), local('Vazirmatn Variable'), url('./vscode-copilot-rtl/Vazirmatn-Variable.woff2') format('woff2'); }` — the browser tries the system-installed font first via `local()`, and only loads the bundled file if that lookup fails. Whatever `fontFamily` the user picks is placed ahead of `'Vazirmatn'` in the CSS `font-family` stack, so any custom font also falls back to (system or bundled) Vazirmatn before a generic `sans-serif`.
- **Enable also covers what used to be a separate "Re-apply" command.** `Copilot RTL: Enable` always strips any existing patch first, then applies fresh — so running it is also the right move after a VS Code update reverts the patch, with no need for a second, overlapping command.
- **A reverted patch is detected, not silently ignored.** The extension records in `globalState` whether it last left the patch applied. On startup, if that flag is set but `workbench.html` no longer contains the marker, the patch was overwritten (in practice, by a VS Code update). With `autoEnable` on, the re-apply notification says so explicitly; with it off, `copilotRtl.notifyWhenPatchReverted` surfaces a warning with a **Re-apply Now** action instead of leaving the user to notice the RTL styling has quietly stopped working.
- **Automatic direction is resolved in the DOM, not in CSS.** CSS `direction: auto` doesn't exist (only the HTML `dir="auto"` attribute does, and Copilot's renderer doesn't set it), so `direction: 'auto'` is implemented by observing the chat DOM and setting `direction`/`text-align` inline per block element (`p`, `li`, `h1`–`h6`, `th`, `td`, `blockquote`, …). Anything inside `pre`, `code`, or a Monaco editor is skipped so code stays LTR. In this mode the stylesheet deliberately emits no `direction` rule at all, because an `!important` declaration there would override the per-element inline styles. Mutations are queued and flushed once per animation frame, and only the mutated subtrees are re-scanned, so a streaming answer doesn't trigger a full-document sweep on every token.
- **Direction detection uses the first strong character.** One shared routine serves both the chat area and the prompt input box: it walks the text and returns on the first character in a strong RTL block (Hebrew, Arabic and its supplements, Arabic Presentation Forms, Thaana, NKo, Syriac) or a strong LTR one, skipping neutrals such as digits, bullets, quotes and emoji. Text with no directional signal is left untouched rather than forced one way. Earlier versions only tested `U+0600–U+06FF` against the single first non-space character, which both missed Hebrew and misread lines starting with a list marker or number.
- **Installed fonts are listed from the filesystem.** The font picker enumerates the platform's font directories (`%WINDIR%\Fonts` and the per-user Windows font folder, `/System/Library/Fonts` and friends on macOS, `/usr/share/fonts` and the XDG user paths on Linux) and derives family names from the file names, stripping weight/style suffixes. This avoids a native dependency; it's a best-effort list, so manual entry stays available and an unreadable directory is simply skipped.
- **Disabling never restores a whole-file backup.** If it did, and some other extension had patched `workbench.html` or `product.json` in the meantime, that extension's changes would be silently erased. Instead:
  - In `workbench.html`, only the exact block we injected (marked by HTML comments) is located and cut out — everything else in the file is left untouched.
  - In `product.json`, only the single checksum entry we removed is merged back in — the rest of the file, including changes made by other tools, is left as-is.
  - The `vscode-copilot-rtl/` folder (script, config, font) is deleted directly — it's wholly ours, so no merge concerns there.
  - Full-file `.copilot-rtl-bak` backups are still written next to both files as a manual/emergency recovery option, but the **Disable** command does not use them automatically.

Because this modifies files inside the VS Code installation folder, it is **unsupported by Microsoft**, and a few side effects are expected:

| Effect | Why | Mitigation |
|---|---|---|
| "Your installation appears to be corrupt" notice | VS Code checksums its core files | The extension removes the corresponding checksum entry from `product.json`, so this notice normally does not appear |
| Patch disappears after a VS Code update | Updates overwrite `workbench.html` | The extension detects this on startup and re-applies (or, if `autoEnable` is off, offers to); you can also run **Copilot RTL: Enable** manually |
| Needs write access to the VS Code install folder | The patch edits files there, not your project | On some systems (e.g. a system-wide Windows install) you may need to run VS Code as administrator once |
| Enable/Disable still need a window reload | These add/remove the `<script>` reference in `workbench.html` itself — a page can't load a script it doesn't yet reference, and once loaded, a script can't be un-loaded from a running page either | Settings (direction/font/size/line height) don't have this problem — they're read by a script that's already running, so they apply live instead |

## Manual recovery

If something ever looks wrong and the **Disable** command isn't enough, each patched file has a sibling backup created the first time it was patched:

- `workbench.html.copilot-rtl-bak`
- `product.json.copilot-rtl-bak`

These are never touched automatically after that point — safe to inspect, restore by hand, or delete once you're confident everything is fine.

## Recovering from an uninstall without disabling first

Why this can happen: once the extension is uninstalled, its code is gone, so it can no longer clean up after itself. VS Code also has no reliable way to run cleanup code specifically at uninstall time — the same `deactivate()` function fires on a plain window reload or on VS Code closing, so the extension deliberately does **not** auto-remove the patch there (doing so would strip it, and re-add it, on every single reload). Disable is the one moment this can be done safely, and it must happen while the extension is still installed.

If it already happened, `workbench.html`, `product.json`, and the copied `vscode-copilot-rtl/` folder (script, config, font) are still patched. To fix it:

1. Reinstall the extension (Marketplace or the same `.vsix`).
2. Run **Copilot RTL: Disable** (see README for how) and reload when prompted.
3. *Then* uninstall it again.

## Publishing (for maintainers)

```bash
npm install -g @vscode/vsce
vsce login NabiKAZ
vsce package   # produces copilot-rtl-<version>.vsix
vsce publish   # publishes the current version to the Marketplace
```

You'll need a Marketplace publisher account (`NabiKAZ`) and an Azure DevOps Personal Access Token with **Marketplace: Manage** scope. See the [official publishing guide](https://code.visualstudio.com/api/working-with-extensions/publishing-extension) for details. Don't forget to add a real `icon.png` (128×128) before packaging — `package.json` already references it.

After the first publish, replace every `TODO_MARKETPLACE_LINK` placeholder in `README.md` with the extension's actual Marketplace URL (`https://marketplace.visualstudio.com/items?itemName=NabiKAZ.copilot-rtl` once published, assuming the `name`/`publisher` in `package.json` stay as they are).

`fonts/Vazirmatn-Variable.woff2` is redistributed under the SIL Open Font License 1.1; its license text is bundled at `fonts/OFL.txt` and must ship with any package containing the font.
