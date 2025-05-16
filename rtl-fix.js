/**
 * This script modifies the styling of various elements in a web page to support RTL (Right-to-Left) text direction
 * It applies RTL direction, Vazir font family, and specific font sizes to interactive elements
 * Code blocks and result editors remain LTR (Left-to-Right) for proper code display
 * https://github.com/NabiKAZ/vscode-copilot-rtl
 * https://x.com/NabiKAZ
 */
document.querySelectorAll('.interactive-list').forEach(el => {
  el.style.setProperty('direction', 'rtl', 'important');
  el.style.setProperty('font-family', 'vazir', 'important');
  el.style.setProperty('font-size', '14px', 'important');
});
document.querySelectorAll('.interactive-input-editor span').forEach(el => {
  el.style.setProperty('direction', 'rtl', 'important');
  el.style.setProperty('text-align', 'right', 'important');
  el.style.setProperty('font-family', 'vazir', 'important');
  el.style.setProperty('font-size', '13px', 'important');
});
document.querySelectorAll('.interactive-result-code-block').forEach(el => {
  el.style.setProperty('direction', 'ltr', 'important');
});
document.querySelectorAll('.interactive-result-editor').forEach(el => {
  el.style.setProperty('direction', 'ltr', 'important');
});
