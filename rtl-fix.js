/**
 * This script modifies the styling of various elements in a web page to support RTL (Right-to-Left) text direction.
 * It applies a configurable direction, font family, font size, and line height to the chat area.
 * Code blocks and result editors remain LTR (Left-to-Right) for proper code display.
 *
 * Part 1: Chat area (rendered markdown + question carousel) -> direction/font via CSS,
 *         config polled live from copilot-rtl-config.json so settings changes apply without a reload.
 *         `direction: 'auto'` resolves direction per rendered block (paragraph, list item,
 *         heading, table cell…) from that block's own text, so a bilingual conversation
 *         reads correctly: Persian answers RTL, English answers LTR.
 * Part 2: Prompt input box (Monaco editor) -> per-line auto direction detection (RTL/LTR),
 *         independent of Part 1's setting.
 *
 * Both parts share one detection routine keyed on the first *strong* character of the
 * text, so leading digits, bullets, quotes and other neutral markdown characters don't
 * flip an otherwise RTL line to LTR.
 *
 * This file is injected into VS Code's workbench window by extension.js — it is not
 * loaded as a normal extension script, so it has no access to the `vscode` API and
 * runs directly against the workbench DOM, exactly like pasting it into DevTools.
 *
 * @version 2.3.0
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
    direction: 'auto', // 'auto' | 'rtl' | 'ltr'
    fontFamily: 'Vazirmatn',
    fontSize: 13,
    lineHeight: 1.6,
  };

  // Everything this extension places next to workbench.html lives under one
  // shared folder, for tidiness — see extension.js's ASSET_FOLDER_NAME.
  const ASSET_FOLDER = './vscode-copilot-rtl';

  // Written by extension.js as plain JSON, refreshed instantly on every
  // settings change. Polled via fetch({cache:'no-store'}) — deliberately a
  // *data* fetch, not a <script> load: dynamically assigning a script's src
  // hits workbench's Trusted Types `require-trusted-types-for 'script'`
  // restriction, and its `trusted-types` directive only allow-lists VS
  // Code's own internal policy names (no custom policy can be registered).
  // fetch() isn't a Trusted Types sink at all, so it isn't affected.
  const CONFIG_PATH = `${ASSET_FOLDER}/copilot-rtl-config.json`;
  const CONFIG_POLL_INTERVAL_MS = 1000;

  // Fixed location extension.js copies the bundled fallback font to, next to
  // workbench.html. Used as a fallback only — see the @font-face rule below.
  const BUNDLED_FONT_PATH = `${ASSET_FOLDER}/Vazirmatn-Variable.woff2`;

  // Avoid double-injection if the workbench reloads without a full patch reapply
  if (window.__copilotRtlPatched) return;
  window.__copilotRtlPatched = true;

  console.log('[vscode-copilot-rtl] script loaded');

  // -----------------------------------------------------------------------
  // Shared direction detection (used by both parts)
  // -----------------------------------------------------------------------

  // Strong RTL scripts: Hebrew, Arabic (+ Supplement/Extended-A/B), Thaana,
  // NKo, Syriac, and the Arabic Presentation Forms blocks. The previous
  // version only covered U+0600–U+06FF, so Hebrew — which the extension
  // claims to support — was detected as LTR.
  const RTL_CHAR_REGEX =
    /[\u0591-\u07FF\u0860-\u086A\u08A0-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;
  const LTR_CHAR_REGEX = /[A-Za-z\u00C0-\u024F\u0370-\u058F\u0E00-\u0E7F\u1E00-\u1FFF]/;

  /**
   * Direction of a string from its first *strong* character, skipping neutral
   * ones (spaces, digits, punctuation, markdown bullets, emoji…). Returns
   * `null` when the text carries no directional signal at all, so callers can
   * leave such blocks alone instead of forcing them one way.
   */
  function detectDirection(text) {
    if (!text) return null;
    for (const char of text) {
      if (RTL_CHAR_REGEX.test(char)) return 'rtl';
      if (LTR_CHAR_REGEX.test(char)) return 'ltr';
    }
    return null;
  }

  // -----------------------------------------------------------------------
  // Part 1: Chat area — direction, font family, font size, line height.
  // Re-rendered live whenever a new config is polled in, no reload needed.
  // -----------------------------------------------------------------------
  function buildChatAreaCss(config) {
    // In 'auto' mode direction is set per block by the observer below, so the
    // stylesheet must not declare one at all (an !important rule here would
    // beat the per-element inline styles).
    const directionRule =
      config.direction === 'auto' ? '' : `direction: ${config.direction} !important;`;

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
        ${directionRule}
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
    setAutoDirectionEnabled(config.direction === 'auto');
  }

  // --- 'auto' mode: resolve direction per rendered block ------------------

  // Block-level markdown elements worth aligning individually. `pre` (and
  // anything inside it) is deliberately absent: code always stays LTR.
  const AUTO_BLOCK_SELECTOR = [
    'p',
    'li',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'blockquote',
    'th',
    'td',
    'dt',
    'dd',
    'summary',
  ]
    .map((tag) => `.rendered-markdown ${tag}, .chat-question-carousel-widget-container ${tag}`)
    .join(', ');

  const AUTO_MARKER_ATTRIBUTE = 'data-copilot-rtl-auto';
  const AUTO_SKIP_SELECTOR = 'pre, code, .monaco-editor, .interactive-result-editor';

  function applyBlockDirection(el) {
    if (el.closest(AUTO_SKIP_SELECTOR)) return;

    const dir = detectDirection(el.textContent);
    if (!dir) return; // no directional signal — leave the block untouched
    if (el.getAttribute(AUTO_MARKER_ATTRIBUTE) === dir) return; // already correct

    el.setAttribute(AUTO_MARKER_ATTRIBUTE, dir);
    el.style.direction = dir;
    el.style.textAlign = dir === 'rtl' ? 'right' : 'left';
  }

  function clearBlockDirections() {
    document.querySelectorAll(`[${AUTO_MARKER_ATTRIBUTE}]`).forEach((el) => {
      el.removeAttribute(AUTO_MARKER_ATTRIBUTE);
      el.style.direction = '';
      el.style.textAlign = '';
    });
  }

  let autoDirectionObserver = null;
  let autoDirectionScheduled = false;
  /** Sweep every block instead of only the mutated ones (first run / mode switch). */
  let autoDirectionFullSweep = false;
  const autoDirectionPendingRoots = new Set();

  function sweepAutoDirection() {
    autoDirectionScheduled = false;

    if (autoDirectionFullSweep) {
      autoDirectionFullSweep = false;
      autoDirectionPendingRoots.clear();
      document.querySelectorAll(AUTO_BLOCK_SELECTOR).forEach(applyBlockDirection);
      return;
    }

    for (const root of autoDirectionPendingRoots) {
      if (!root.isConnected) continue;
      if (root.matches(AUTO_BLOCK_SELECTOR)) applyBlockDirection(root);
      root.querySelectorAll(AUTO_BLOCK_SELECTOR).forEach(applyBlockDirection);
    }
    autoDirectionPendingRoots.clear();
  }

  /** Coalesce the many mutations of a streaming answer into one pass per frame. */
  function scheduleAutoDirectionSweep() {
    if (autoDirectionScheduled) return;
    autoDirectionScheduled = true;
    requestAnimationFrame(sweepAutoDirection);
  }

  function queueAutoDirection(mutations) {
    for (const mutation of mutations) {
      // characterData mutations report the text node itself; walk up to an element.
      const target =
        mutation.target.nodeType === Node.ELEMENT_NODE
          ? mutation.target
          : mutation.target.parentElement;
      if (target) autoDirectionPendingRoots.add(target);
    }
    scheduleAutoDirectionSweep();
  }

  function setAutoDirectionEnabled(enabled) {
    if (enabled === Boolean(autoDirectionObserver)) return;

    if (!enabled) {
      autoDirectionObserver.disconnect();
      autoDirectionObserver = null;
      autoDirectionPendingRoots.clear();
      clearBlockDirections();
      return;
    }

    autoDirectionObserver = new MutationObserver(queueAutoDirection);
    autoDirectionObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    autoDirectionFullSweep = true;
    scheduleAutoDirectionSweep();
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
    const text = line.innerText || '';
    const dir = detectDirection(text) || 'ltr'; // empty/neutral lines keep the LTR default
    const align = dir === 'rtl' ? 'right' : 'left';

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
