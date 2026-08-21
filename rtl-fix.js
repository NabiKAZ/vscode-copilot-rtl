/**
 * This script modifies the styling of various elements in a web page to support RTL (Right-to-Left) text direction.
 * It applies RTL direction, Vazirmatn font family, and specific font sizes to interactive elements.
 * Code blocks and result editors remain LTR (Left-to-Right) for proper code display.
 *
 * Part 1: Chat area (rendered markdown + question carousel) -> forced RTL styling via CSS.
 * Part 2: Prompt input box (Monaco editor) -> per-line auto direction detection (RTL/LTR)
 *         based on the first non-space character of each line.
 *
 * @version 1.0.1
 * @author  NabiKAZ
 * @license GPLv3
 * @see https://github.com/NabiKAZ/vscode-copilot-rtl
 * @see https://x.com/NabiKAZ
 */

(function () {
  'use strict';

  // Small helper to inject a <style> tag into <head>
  function injectStyle(css) {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    return style;
  }

  // -----------------------------------------------------------------------
  // Part 1: Chat area — force RTL direction, Vazirmatn font, and font size
  // -----------------------------------------------------------------------
  injectStyle(`
    /* COPILOT RTL PATCH */
    .rendered-markdown > *:not(div),
    .chat-question-carousel-widget-container {
      direction: rtl !important;
      font-family: Vazirmatn !important;
      font-size: 13px !important;
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

  const editorContainer = document.querySelector(EDITOR_CONTAINER_SELECTOR);
  if (editorContainer) {
    watchEditorContainer(editorContainer);
  } else {
    // Prompt box not rendered yet — wait for it to appear in the body
    const bodyObserver = new MutationObserver(() => {
      const el = document.querySelector(EDITOR_CONTAINER_SELECTOR);
      if (el) {
        bodyObserver.disconnect();
        watchEditorContainer(el);
      }
    });
    bodyObserver.observe(document.body, { childList: true, subtree: true });
  }
})();
