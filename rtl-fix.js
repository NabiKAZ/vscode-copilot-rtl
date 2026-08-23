/**
 * This script modifies the styling of various elements in a web page to support RTL (Right-to-Left) text direction.
 * It applies a configurable direction, font family, font size, and line height to the chat area.
 * Code blocks and result editors remain LTR (Left-to-Right) for proper code display.
 *
 * Part 1: Chat area (rendered markdown + question carousel) -> forced direction/font via CSS,
 *         config polled live from copilot-rtl-config.js so settings changes apply without a reload.
 * Part 2: Prompt input box (Monaco editor) -> per-line auto direction detection (RTL/LTR)
 *         based on the first non-space character of each line, independent of Part 1's setting.
 *
 * This file is injected into VS Code's workbench window by extension.js — it is not
 * loaded as a normal extension script, so it has no access to the `vscode` API and
 * runs directly against the workbench DOM, exactly like pasting it into DevTools.
 *
 * @version 2.2.0
 * @author  NabiKAZ
 * @license GPLv3
 * @see https://github.com/NabiKAZ/vscode-copilot-rtl
 * @see https://x.com/NabiKAZ
 */
(function () {
  'use strict';

  // Used standalone (pasted into DevTools, see README) and as the starting
  // point before the first live config update arrives when run by the
  // extension. Edit these directly for standalone use.
  const DEFAULT_CONFIG = {
    direction: 'rtl',
    fontFamily: 'Vazirmatn',
    fontSize: 13,
    lineHeight: 1.8,
  };

  // Written by extension.js as plain JSON, refreshed instantly on every
  // settings change. Polled via fetch({cache:'no-store'}) — deliberately a
  // *data* fetch, not a <script> load: dynamically assigning a script's src
  // hits workbench's Trusted Types `require-trusted-types-for 'script'`
  // restriction, and its `trusted-types` directive only allow-lists VS
  // Code's own internal policy names (no custom policy can be registered).
  // fetch() isn't a Trusted Types sink at all, so it isn't affected.
  const CONFIG_PATH = './copilot-rtl-config.json';
  const CONFIG_POLL_INTERVAL_MS = 1000;

  // Fixed location extension.js copies the bundled fallback font to, next to
  // workbench.html. Used as a fallback only — see the @font-face rule below.
  const BUNDLED_FONT_PATH = './copilot-rtl-assets/Vazirmatn-Variable.woff2';

  // Avoid double-injection if the workbench reloads without a full patch reapply
  if (window.__copilotRtlPatched) return;
  window.__copilotRtlPatched = true;

  console.log('[copilot-rtl] script loaded');

  // -----------------------------------------------------------------------
  // Part 1: Chat area — direction, font family, font size, line height.
  // Re-rendered live whenever a new config is polled in, no reload needed.
  // -----------------------------------------------------------------------
  function buildChatAreaCss(config) {
    return `
      /* Fallback so "Vazirmatn" still renders even when it isn't installed
         on the system: local() checks the system font first, url() is the
         copy bundled with the extension (unused for the DevTools/manual
         path, where the relative asset simply won't exist and this rule is
         skipped). */
      @font-face {
        font-family: 'Vazirmatn';
        src: local('Vazirmatn'), local('Vazirmatn Variable'), url('${BUNDLED_FONT_PATH}') format('woff2');
        font-weight: 100 900;
        font-display: swap;
      }

      /* COPILOT RTL PATCH */
      .rendered-markdown > *:not(div),
      .chat-question-carousel-widget-container {
        direction: ${config.direction} !important;
        font-family: "${config.fontFamily}", 'Vazirmatn', sans-serif !important;
        font-size: ${config.fontSize}px !important;
        line-height: ${config.lineHeight} !important;
      }
    `;
  }

  const chatAreaStyle = document.createElement('style');
  document.head.appendChild(chatAreaStyle);

  let currentConfig = { ...DEFAULT_CONFIG };

  function renderChatArea(config) {
    chatAreaStyle.textContent = buildChatAreaCss(config);
  }
  renderChatArea(currentConfig);

  // --- live config polling (fetch, not script injection — see note above) -
  let pollFailureLogged = false;
  async function pollConfig() {
    try {
      const res = await fetch(CONFIG_PATH, { cache: 'no-store' });
      if (!res.ok) return; // e.g. 404 before the extension has written it yet
      const incoming = await res.json();
      const merged = { ...DEFAULT_CONFIG, ...incoming };
      if (JSON.stringify(merged) === JSON.stringify(currentConfig)) return; // no change
      currentConfig = merged;
      renderChatArea(currentConfig);
      console.log('[copilot-rtl] config updated', currentConfig);
    } catch (err) {
      // A missing config file (e.g. standalone DevTools use, or before the
      // extension has written one yet) is expected and harmless — but log
      // it once so a genuine failure (e.g. blocked by CSP) is visible in
      // the console instead of silently never applying settings changes.
      if (!pollFailureLogged) {
        pollFailureLogged = true;
        console.warn(
          `[copilot-rtl] could not load ${CONFIG_PATH} — settings changes won't apply live. ` +
            'This is expected if you pasted this script manually (no extension running). ' +
            'If the extension is installed, this may indicate a real problem (e.g. CSP blocking the request).',
          err
        );
      }
    }
  }
  pollConfig();
  setInterval(pollConfig, CONFIG_POLL_INTERVAL_MS);

  // -----------------------------------------------------------------------
  // Part 2: Prompt input box — auto-detect direction per line (RTL/LTR)
  // -----------------------------------------------------------------------
  const RTL_CHAR_REGEX = /[\u0600-\u06FF]/;
  const EDITOR_CONTAINER_SELECTOR = '.chat-editor-container';
  const LINE_SELECTOR = '.view-line';

  const editorTransitionStyle = document.createElement('style');
  editorTransitionStyle.textContent = `
    ${EDITOR_CONTAINER_SELECTOR} .monaco-editor .view-lines,
    ${EDITOR_CONTAINER_SELECTOR} .monaco-editor .view-line {
      transition: all 0.1s ease-in-out;
    }
  `;
  document.head.appendChild(editorTransitionStyle);

  function applyLineDirection(line) {
    const text = line.innerText?.trimStart() || '';
    const firstChar = text[0] || '';
    const isRTL = RTL_CHAR_REGEX.test(firstChar); // check only the first non-space character
    const dir = isRTL ? 'rtl' : 'ltr';
    const align = isRTL ? 'right' : 'left';

    line.style.direction = dir;
    line.style.textAlign = align;
    line.setAttribute('dir', dir);
  }

  function watchEditorContainer(container) {
    const observer = new MutationObserver(() => {
      container.querySelectorAll(LINE_SELECTOR).forEach(applyLineDirection);
    });

    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return observer;
  }

  function init() {
    const editorContainer = document.querySelector(EDITOR_CONTAINER_SELECTOR);
    if (editorContainer) {
      watchEditorContainer(editorContainer);
    } else {
      // Prompt box not rendered yet — wait for it to appear in the body.
      // Unlike the DevTools-console version, the workbench body itself may not
      // exist yet at injection time, so we also wait for document.body.
      const start = () => {
        const bodyObserver = new MutationObserver(() => {
          const el = document.querySelector(EDITOR_CONTAINER_SELECTOR);
          if (el) {
            bodyObserver.disconnect();
            watchEditorContainer(el);
          }
        });
        bodyObserver.observe(document.body, { childList: true, subtree: true });
      };

      if (document.body) {
        start();
      } else {
        document.addEventListener('DOMContentLoaded', start, { once: true });
      }
    }
  }

  init();
})();
