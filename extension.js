/**
 * Copilot Chat RTL Support — VS Code extension entry point.
 *
 * Patches workbench.html to load an external rtl-fix.js (inline scripts are
 * blocked by CSP). Disable/removal never restores whole-file backups —
 * only our own marked block / checksum entry — so other extensions
 * patching the same files aren't affected. Full rationale: TECHNICAL.md.
 *
 * Everything this extension places next to workbench.html (script, config,
 * bundled font) lives under one ASSET_FOLDER_NAME folder, so it's obvious
 * at a glance what belongs to this extension and the whole folder can be
 * removed on Disable.
 *
 * rtl-fix.js itself never changes per-user: settings (direction, font,
 * size, line height) are written as plain JSON to <asset folder>/
 * copilot-rtl-config.json, which the already-running injected script polls
 * every second via fetch() and applies live — no reload needed for settings
 * changes. workbench.html/product.json are only touched by Enable/Disable.
 * (An earlier version polled a <script src> instead of fetching JSON, but
 * that hit workbench's Trusted Types restriction on dynamically assigning a
 * script's src — see TECHNICAL.md.)
 *
 * "Enable" doubles as what used to be a separate "Re-apply" command: it
 * always strips any existing patch first, then re-applies fresh, so it's
 * also the right thing to run after a VS Code update reverts the patch —
 * one clearly-named action instead of two overlapping ones.
 *
 * @version 2.2.1
 * @author  NabiKAZ
 * @license GPLv3
 * @see https://github.com/NabiKAZ/vscode-copilot-rtl
 * @see https://x.com/NabiKAZ
 */
'use strict';

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

const MARKER_START = '<!-- COPILOT-RTL-PATCH:START -->';
const MARKER_END = '<!-- COPILOT-RTL-PATCH:END -->';
const ASSET_FOLDER_NAME = 'vscode-copilot-rtl';
const SCRIPT_FILE_NAME = 'copilot-rtl-fix.js';
const CONFIG_FILE_NAME = 'copilot-rtl-config.json';
const BUNDLED_FONT_FILE_NAME = 'Vazirmatn-Variable.woff2';

const CONFIG_SECTION = 'copilotRtl';
const CONFIG_KEYS = ['direction', 'fontFamily', 'fontSize', 'lineHeight'];

// Known relative locations of the workbench HTML across VS Code versions/variants.
const WORKBENCH_HTML_CANDIDATES = [
  'out/vs/code/electron-sandbox/workbench/workbench.html',
  'out/vs/code/electron-sandbox/workbench/workbench.esm.html',
  'out/vs/code/electron-browser/workbench/workbench.html',
];

function findWorkbenchHtmlRelativePath(appRoot) {
  for (const rel of WORKBENCH_HTML_CANDIDATES) {
    if (fs.existsSync(path.join(appRoot, rel))) return rel;
  }
  return null;
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function backupPath(filePath) {
  return `${filePath}.copilot-rtl-bak`;
}

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function writeFile(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf8');
}

function isPatched(html) {
  return html.includes(MARKER_START);
}

function buildInjection(scriptFileName) {
  return `${MARKER_START}\n<script src="./${ASSET_FOLDER_NAME}/${scriptFileName}"></script>\n${MARKER_END}\n`;
}

/**
 * Remove every occurrence of our marked block from an HTML string, without
 * touching anything else. Using a global match also cleans up any
 * duplicate/stale blocks a previous buggy run might have left behind.
 */
function stripPatchBlocks(html) {
  const blockRegex = new RegExp(
    `[ \\t]*${escapeRegExp(MARKER_START)}[\\s\\S]*?${escapeRegExp(MARKER_END)}\\n?`,
    'g'
  );
  const matches = html.match(blockRegex);
  const result = html.replace(blockRegex, '');
  return { result, removedCount: matches ? matches.length : 0 };
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

function readConfig() {
  const cfg = vscode.workspace.getConfiguration(CONFIG_SECTION);
  return {
    direction: cfg.get('direction', 'rtl'),
    fontFamily: cfg.get('fontFamily', 'Vazirmatn'),
    fontSize: cfg.get('fontSize', 13),
    lineHeight: cfg.get('lineHeight', 1.6),
  };
}

// ---------------------------------------------------------------------------
// Patching workbench.html / product.json / synced assets
// ---------------------------------------------------------------------------

/** The one folder next to workbench.html that holds everything this
 *  extension places there — created on demand, removed entirely on Disable. */
function assetFolderPath(htmlPath) {
  return path.join(path.dirname(htmlPath), ASSET_FOLDER_NAME);
}

function ensureAssetFolder(htmlPath) {
  const dir = assetFolderPath(htmlPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Copy rtl-fix.js into the asset folder. Its content is static/generic —
 *  settings live in the separate JSON config file it polls (see writeConfigFile). */
function syncScriptFile(context, htmlPath) {
  const scriptDest = path.join(ensureAssetFolder(htmlPath), SCRIPT_FILE_NAME);
  fs.copyFileSync(path.join(context.extensionPath, 'rtl-fix.js'), scriptDest);
  return scriptDest;
}

/**
 * Write the live-polled config as plain JSON into the asset folder. The
 * already running injected script (rtl-fix.js) fetches this ~every second
 * and applies it immediately — this is what makes settings changes take
 * effect without a window reload. Plain JSON (not a .js file) deliberately:
 * fetching data isn't a Trusted Types sink, whereas assigning a dynamically
 * created <script>'s src is, and workbench's `trusted-types` CSP directive
 * only allow-lists VS Code's own internal policy names.
 */
function writeConfigFile(htmlPath, config) {
  const dest = path.join(ensureAssetFolder(htmlPath), CONFIG_FILE_NAME);
  writeFile(dest, JSON.stringify(config));
  return dest;
}

/** Copy the bundled fallback font into the asset folder, once. No
 *  subfolder of its own — it sits next to the script/config directly. */
function syncFontFile(context, htmlPath) {
  const dest = path.join(ensureAssetFolder(htmlPath), BUNDLED_FONT_FILE_NAME);
  if (fs.existsSync(dest)) return dest;
  fs.copyFileSync(path.join(context.extensionPath, 'fonts', BUNDLED_FONT_FILE_NAME), dest);
  return dest;
}

/** Remove the script/config/font files and the asset folder itself —
 *  everything under it is wholly ours, so this is always safe. */
function removeAssetFolder(htmlPath) {
  const dir = assetFolderPath(htmlPath);
  if (!fs.existsSync(dir)) return;
  for (const name of [SCRIPT_FILE_NAME, CONFIG_FILE_NAME, BUNDLED_FONT_FILE_NAME]) {
    const filePath = path.join(dir, name);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  // Only remove the folder if nothing unexpected got left behind in it.
  if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
}

/**
 * Delete the checksum entry for the patched file so VS Code stops flagging
 * the install as corrupt. Keeps a full-file backup purely as a manual
 * recovery safety net — restore logic never reads it back wholesale.
 */
function removeProductJsonChecksum(appRoot, relativeHtmlPath) {
  const productJsonPath = path.join(appRoot, 'product.json');
  if (!fs.existsSync(productJsonPath)) return;

  const bak = backupPath(productJsonPath);
  if (!fs.existsSync(bak)) {
    fs.copyFileSync(productJsonPath, bak);
  }

  try {
    const product = JSON.parse(readFile(productJsonPath));
    if (product.checksums && relativeHtmlPath in product.checksums) {
      delete product.checksums[relativeHtmlPath];
      writeFile(productJsonPath, JSON.stringify(product, null, '\t'));
    }
  } catch (err) {
    // Best-effort — a failure here only means the (harmless) "corrupt
    // installation" notice may reappear, so we don't surface it as an error.
    console.error('Copilot RTL: could not patch product.json', err);
  }
}

/**
 * Restore ONLY the single checksum entry we removed, merging it into
 * product.json's CURRENT state — never overwriting the whole file, since
 * other extensions using the same technique may have changed other entries
 * in the meantime.
 */
function restoreProductJsonChecksum(appRoot, relativeHtmlPath) {
  const productJsonPath = path.join(appRoot, 'product.json');
  const bak = backupPath(productJsonPath);
  if (!fs.existsSync(productJsonPath) || !fs.existsSync(bak)) return;

  try {
    const backedUp = JSON.parse(readFile(bak));
    const originalValue = backedUp.checksums && backedUp.checksums[relativeHtmlPath];
    if (originalValue === undefined) return; // nothing to restore

    const current = JSON.parse(readFile(productJsonPath));
    current.checksums = current.checksums || {};
    current.checksums[relativeHtmlPath] = originalValue;
    writeFile(productJsonPath, JSON.stringify(current, null, '\t'));
  } catch (err) {
    console.error('Copilot RTL: could not restore product.json checksum', err);
  }
  // The backup is intentionally left in place (not deleted) as a manual
  // recovery file; it is harmless to keep and safe to delete by hand.
}

function locateWorkbench() {
  const appRoot = vscode.env.appRoot;
  const relHtml = findWorkbenchHtmlRelativePath(appRoot);
  if (!relHtml) {
    throw new Error(
      'Could not locate workbench.html for this VS Code installation/version.'
    );
  }
  return { appRoot, relHtml, htmlPath: path.join(appRoot, relHtml) };
}

/**
 * Refresh the external script + bundled font + live config next to
 * workbench.html to match current settings. Independent of whether
 * workbench.html itself needs (re)patching.
 */
function syncAssets(context, htmlPath) {
  syncScriptFile(context, htmlPath);
  syncFontFile(context, htmlPath);
  writeConfigFile(htmlPath, readConfig());
}

function applyPatch(context) {
  const { appRoot, relHtml, htmlPath } = locateWorkbench();
  const html = readFile(htmlPath);

  syncAssets(context, htmlPath);

  if (isPatched(html)) return false; // <script> reference already present

  const bak = backupPath(htmlPath);
  if (!fs.existsSync(bak)) {
    fs.copyFileSync(htmlPath, bak); // manual recovery safety net only
  }

  const injection = buildInjection(SCRIPT_FILE_NAME);
  // Inject inside <head> (before </head>) so the script runs early and reliably.
  const patchedHtml = html.includes('</head>')
    ? html.replace('</head>', `${injection}</head>`)
    : html.replace('</html>', `${injection}</html>`);

  writeFile(htmlPath, patchedHtml);
  removeProductJsonChecksum(appRoot, relHtml);
  return true;
}

function removePatch() {
  const { appRoot, relHtml, htmlPath } = (() => {
    const appRoot = vscode.env.appRoot;
    const relHtml = findWorkbenchHtmlRelativePath(appRoot);
    return relHtml
      ? { appRoot, relHtml, htmlPath: path.join(appRoot, relHtml) }
      : { appRoot, relHtml: null, htmlPath: null };
  })();
  if (!relHtml) return false;

  const html = readFile(htmlPath);

  // Surgically cut out only our own marked block from the file's CURRENT
  // state — never restore workbench.html from the backup wholesale, since
  // other extensions patching the same file may have made their own changes
  // since we backed it up.
  const { result, removedCount } = stripPatchBlocks(html);
  if (removedCount > 0) {
    writeFile(htmlPath, result);
  }

  removeAssetFolder(htmlPath);
  restoreProductJsonChecksum(appRoot, relHtml);

  return removedCount > 0;
}

/** Always strip any existing patch first, then apply fresh — this is what
 *  the Enable command runs (covers both "not yet patched" and "patched but
 *  stale after a VS Code update" in one action). Startup/autoEnable uses
 *  plain applyPatch() instead, so it stays a no-op when nothing changed. */
function forceEnable(context) {
  removePatch();
  return applyPatch(context);
}

async function offerReload(message) {
  const choice = await vscode.window.showInformationMessage(
    message,
    'Reload Window',
    'Later'
  );
  if (choice === 'Reload Window') {
    vscode.commands.executeCommand('workbench.action.reloadWindow');
  }
}

function withErrorHandling(fn) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (err) {
      vscode.window.showErrorMessage(
        `Copilot RTL: ${err.message || err}. ` +
          'This usually means VS Code needs to be run once with write access ' +
          '(e.g. as administrator, or fix folder permissions) to its install directory.'
      );
      return undefined;
    }
  };
}

// ---------------------------------------------------------------------------
// Status bar menu
// ---------------------------------------------------------------------------

let statusBarItem;

function updateStatusBarItem() {
  if (!statusBarItem) return;
  const config = readConfig();
  statusBarItem.text = `$(arrow-swap) ${config.direction.toUpperCase()}`;
  statusBarItem.tooltip = `Copilot RTL — direction: ${config.direction}, font: ${config.fontFamily} ${config.fontSize}px, line height: ${config.lineHeight} (click for options)`;
}

function createStatusBarItem() {
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'copilotRtl.openMenu';
  updateStatusBarItem();
  statusBarItem.show();
  return statusBarItem;
}

async function openMenu() {
  const config = readConfig();
  const cfg = vscode.workspace.getConfiguration(CONFIG_SECTION);

  /** @type {vscode.QuickPickItem & { action: string }[]} */
  const items = [
    {
      action: 'direction-rtl',
      label: `${config.direction === 'rtl' ? '$(circle-large-filled)' : '$(circle-large-outline)'} Right-to-left (RTL)`,
      description: 'Force RTL direction in the chat area',
    },
    {
      action: 'direction-ltr',
      label: `${config.direction === 'ltr' ? '$(circle-large-filled)' : '$(circle-large-outline)'} Left-to-right (LTR)`,
      description: 'Force LTR direction in the chat area',
    },
    {
      action: 'font-family',
      label: '$(symbol-color) Change font family…',
      description: config.fontFamily,
    },
    {
      action: 'font-size',
      label: '$(text-size) Change font size…',
      description: `${config.fontSize}px`,
    },
    {
      action: 'line-height',
      label: '$(whitespace) Change line spacing…',
      description: `${config.lineHeight}`,
    },
    { action: 'enable', label: '$(check) Enable Copilot RTL (requires reload)', description: 'Also fixes it after a VS Code update' },
    { action: 'disable', label: '$(circle-slash) Disable Copilot RTL (requires reload)', description: 'Run this before uninstalling the extension' },
  ];

  const picked = await vscode.window.showQuickPick(items, { title: 'Copilot RTL' });
  if (!picked) return;

  switch (picked.action) {
    case 'direction-rtl':
      await cfg.update('direction', 'rtl', vscode.ConfigurationTarget.Global);
      break;
    case 'direction-ltr':
      await cfg.update('direction', 'ltr', vscode.ConfigurationTarget.Global);
      break;
    case 'font-family': {
      const input = await vscode.window.showInputBox({
        title: 'Copilot RTL — Font Family',
        prompt: 'Name of an installed font. Leave as Vazirmatn to use the bundled fallback automatically.',
        value: config.fontFamily,
      });
      if (input) await cfg.update('fontFamily', input.trim(), vscode.ConfigurationTarget.Global);
      break;
    }
    case 'font-size': {
      const input = await vscode.window.showInputBox({
        title: 'Copilot RTL — Font Size',
        prompt: 'Font size in pixels',
        value: String(config.fontSize),
        validateInput: (v) => (/^\d+$/.test(v) && Number(v) > 0 ? undefined : 'Enter a positive whole number'),
      });
      if (input) await cfg.update('fontSize', Number(input), vscode.ConfigurationTarget.Global);
      break;
    }
    case 'line-height': {
      const input = await vscode.window.showInputBox({
        title: 'Copilot RTL — Line Spacing',
        prompt: 'Line height multiplier (e.g. 1.6 ≈ default, 1 = tight, 2.5 = airy)',
        value: String(config.lineHeight),
        validateInput: (v) => (/^\d+(\.\d+)?$/.test(v) && Number(v) > 0 ? undefined : 'Enter a positive number'),
      });
      if (input) await cfg.update('lineHeight', Number(input), vscode.ConfigurationTarget.Global);
      break;
    }
    case 'enable':
      vscode.commands.executeCommand('copilotRtl.enable');
      break;
    case 'disable':
      vscode.commands.executeCommand('copilotRtl.disable');
      break;
  }
}

// ---------------------------------------------------------------------------
// Activation
// ---------------------------------------------------------------------------

function activate(context) {
  createStatusBarItem();
  context.subscriptions.push(statusBarItem);

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'copilotRtl.enable',
      withErrorHandling(async () => {
        forceEnable(context);
        await offerReload('Copilot RTL patch applied. Reload the window for it to take effect.');
      })
    ),
    vscode.commands.registerCommand(
      'copilotRtl.disable',
      withErrorHandling(async () => {
        const changed = removePatch();
        await offerReload(
          changed
            ? 'Copilot RTL patch removed. Reload the window for it to take effect.'
            : 'Copilot RTL patch was not applied.'
        );
      })
    ),
    vscode.commands.registerCommand('copilotRtl.openMenu', withErrorHandling(openMenu))
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(
      withErrorHandling(async (e) => {
        if (!CONFIG_KEYS.some((key) => e.affectsConfiguration(`${CONFIG_SECTION}.${key}`))) return;

        updateStatusBarItem();
        // Direction/font/size/line-height are picked up live by the already
        // running injected script (polled ~every second) — no reload needed.
        const { htmlPath } = locateWorkbench();
        writeConfigFile(htmlPath, readConfig());
        vscode.window.setStatusBarMessage('$(check) Copilot RTL settings applied', 2000);
      })
    )
  );

  const autoEnable = vscode.workspace.getConfiguration(CONFIG_SECTION).get('autoEnable', true);
  if (autoEnable) {
    try {
      const changed = applyPatch(context);
      if (changed) {
        offerReload('Copilot RTL patch applied. Reload the window for it to take effect.');
      }
    } catch (err) {
      console.error('Copilot RTL: auto-patch failed', err);
    }
  }
}

function deactivate() {
  // Intentionally a no-op: the patch lives in VS Code's own files, not in
  // memory, so disabling/uninstalling the extension should not silently
  // revert it. Users (or the uninstall flow) should run "Copilot RTL: Disable"
  // first if they want the workbench fully restored.
}

module.exports = { activate, deactivate };
