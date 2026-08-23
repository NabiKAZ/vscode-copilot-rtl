/**
 * Copilot Chat RTL Support — VS Code extension entry point.
 *
 * Patches workbench.html to load an external rtl-fix.js (inline scripts are
 * blocked by CSP). Disable/removal never restores whole-file backups —
 * only our own marked block / checksum entry — so other extensions
 * patching the same files aren't affected. Full rationale: TECHNICAL.md.
 *
 * @version 2.0.0
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
const SCRIPT_FILE_NAME = 'copilot-rtl-fix.js';

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
  return `${MARKER_START}\n<script src="./${scriptFileName}"></script>\n${MARKER_END}\n`;
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

/** Keep a copy of the external script next to workbench.html up to date. */
function syncScriptFile(context, htmlPath) {
  const scriptDest = path.join(path.dirname(htmlPath), SCRIPT_FILE_NAME);
  const scriptSrc = path.join(context.extensionPath, 'rtl-fix.js');
  fs.copyFileSync(scriptSrc, scriptDest);
  return scriptDest;
}

function removeScriptFile(htmlPath) {
  const scriptDest = path.join(path.dirname(htmlPath), SCRIPT_FILE_NAME);
  if (fs.existsSync(scriptDest)) fs.unlinkSync(scriptDest);
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

function applyPatch(context) {
  const appRoot = vscode.env.appRoot;
  const relHtml = findWorkbenchHtmlRelativePath(appRoot);
  if (!relHtml) {
    throw new Error(
      'Could not locate workbench.html for this VS Code installation/version.'
    );
  }

  const htmlPath = path.join(appRoot, relHtml);
  const html = readFile(htmlPath);

  // Always refresh the external script file, independent of whether
  // workbench.html itself needs (re)patching. This lets the extension ship
  // logic updates that take effect on the next window reload alone, with no
  // need to touch workbench.html again.
  syncScriptFile(context, htmlPath);

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
  const appRoot = vscode.env.appRoot;
  const relHtml = findWorkbenchHtmlRelativePath(appRoot);
  if (!relHtml) return false;

  const htmlPath = path.join(appRoot, relHtml);
  const html = readFile(htmlPath);

  // Surgically cut out only our own marked block from the file's CURRENT
  // state — never restore workbench.html from the backup wholesale, since
  // other extensions patching the same file may have made their own changes
  // since we backed it up.
  const { result, removedCount } = stripPatchBlocks(html);
  if (removedCount > 0) {
    writeFile(htmlPath, result);
  }

  removeScriptFile(htmlPath);
  restoreProductJsonChecksum(appRoot, relHtml);

  return removedCount > 0;
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

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'copilotRtl.enable',
      withErrorHandling(async () => {
        const changed = applyPatch(context);
        await offerReload(
          changed
            ? 'Copilot RTL patch applied. Reload the window for it to take effect.'
            : 'Copilot RTL patch is already applied (script file refreshed).'
        );
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
    vscode.commands.registerCommand(
      'copilotRtl.reapply',
      withErrorHandling(async () => {
        removePatch();
        applyPatch(context);
        await offerReload(
          'Copilot RTL patch re-applied (useful after a VS Code update overwrote it). Reload the window for it to take effect.'
        );
      })
    )
  );

  const autoEnable = vscode.workspace.getConfiguration('copilotRtl').get('autoEnable', true);
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
