/**
 * This script modifies the styling of various elements in a web page to support RTL (Right-to-Left) text direction
 * It applies RTL direction, Vazirmatn font family, and specific font sizes to interactive elements
 * Code blocks and result editors remain LTR (Left-to-Right) for proper code display
 * https://github.com/NabiKAZ/vscode-copilot-rtl
 * https://x.com/NabiKAZ
 */
// Create CSS rules for RTL support
const css = `
/* COPILOT RTL PATCH */
.rendered-markdown > *:not(div) {
  direction: rtl !important;
  font-family: vazirmatn !important;
  font-size: 13px !important;
}`;
// Create style element and add CSS
const style = document.createElement('style');
style.textContent = css;
document.querySelector('head').appendChild(style);
