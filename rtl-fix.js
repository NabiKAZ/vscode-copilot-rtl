/**
 * This script modifies the styling of various elements in a web page to support RTL (Right-to-Left) text direction.
 * It applies a configurable direction, font family, and font size to the chat area.
 * Code blocks and result editors remain LTR (Left-to-Right) for proper code display.
 *
 * Part 1: Chat area (rendered markdown + question carousel) -> forced direction/font via CSS.
 * Part 2: Prompt input box (Monaco editor) -> per-line auto direction detection (RTL/LTR)
 *         based on the first non-space character of each line, independent of Part 1's setting.
 *
 * This file is injected into VS Code's workbench window by extension.js — it is not
 * loaded as a normal extension script, so it has no access to the `vscode` API and
 * runs directly against the workbench DOM, exactly like pasting it into DevTools.
 *
 * The three constants below are rewritten by extension.js to match the user's
 * `copilotRtl.*` settings every time it syncs this file. Pasted standalone (see
 * README's "Manual usage" section) they simply keep these defaults.
 *
 * @version 2.1.0
 * @author  NabiKAZ
 * @license GPLv3
 * @see https://github.com/NabiKAZ/vscode-copilot-rtl
 * @see https://x.com/NabiKAZ
 */
(function () {
  'use strict';

  // Rewritten by extension.js to match copilotRtl.direction / fontFamily / fontSize.
  const DIRECTION = 'rtl';
  const FONT_FAMILY = 'Vazirmatn';
  const FONT_SIZE = 13;

  // Fixed location extension.js copies the bundled fallback font to, next to
  // workbench.html. Used as a fallback only — see the @font-face rule below.
  const BUNDLED_FONT_PATH = './copilot-rtl-assets/Vazirmatn-Variable.woff2';

  // Avoid double-injection if the workbench reloads without a full patch reapply
  if (window.__copilotRtlPatched) return;
  window.__copilotRtlPatched = true;

  // Log once so it's easy to confirm the script actually ran (visible in
  // Help > Toggle Developer Tools > Console).
  console.log('[copilot-rtl] script loaded', { DIRECTION, FONT_FAMILY, FONT_SIZE });

  // Small helper to inject a <style> tag into <head>
  function injectStyle(css) {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    return style;
  }

  // -----------------------------------------------------------------------
  // Part 1: Chat area — force direction, font family, and font size
  // -----------------------------------------------------------------------
  injectStyle(`
    /* Fallback so "Vazirmatn" still renders even when it isn't installed
       on the system: local() checks the system font first, url() is the
       copy bundled with the extension (unused for the DevTools/manual path,
       where the relative asset simply won't exist and this rule is skipped). */
    @font-face {
      font-family: 'Vazirmatn';
      src: local('Vazirmatn'), local('Vazirmatn Variable'), url('${BUNDLED_FONT_PATH}') format('woff2');
      font-weight: 100 900;
      font-display: swap;
    }

    /* COPILOT RTL PATCH */
    .rendered-markdown > *:not(div),
    .chat-question-carousel-widget-container {
      direction: ${DIRECTION} !important;
      font-family: "${FONT_FAMILY}", 'Vazirmatn', sans-serif !important;
      font-size: ${FONT_SIZE}px !important;
    }
  `);

  // -----------------------------------------------------------------------
  // Part 2: Prompt input box — auto-detect direction per line (RTL/LTR)
  // -----------------------------------------------------------------------
  const RTL_CHAR_REGEX = /[\u0600-\u06FF]/;
  const EDITOR_CONTAINER_SELECTOR = '.chat-editor-container';
  const LINE_SELECTOR = '.view-line';

  injectStyle(`
    ${EDITOR_CONTAINER_SELECTOR} .monaco-editor .view-lines,
    ${EDITOR_CONTAINER_SELECTOR} .monaco-editor .view-line {
      transition: all 0.1s ease-in-out;
    }
  `);

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
