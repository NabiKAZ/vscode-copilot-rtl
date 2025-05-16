# RTL Support for GitHub Copilot Chat in VSCode

A simple script to enable **Right-to-Left (RTL)** support for the GitHub Copilot Chat panel in Visual Studio Code, optimized for Persian (Farsi) and other RTL languages.

## Features

- Applies RTL direction to the chat interface
- Right-aligns input text for better readability
- Uses the Persian-friendly [Vazir font](https://github.com/rastikerdar/vazir-font)
- Preserves LTR direction for code blocks
- Clean and minimal styling for better UX

## Preview

Here is an example of the result after applying the script:

![Copilot RTL Preview](https://github.com/user-attachments/assets/076a7941-13c5-4f01-a4f1-2b8225c9673f)

## Usage

1. Make sure GitHub Copilot Chat is installed and enabled in your VSCode.

2. Open the **Developer Console** in VSCode:

   ```
   Help > Toggle Developer Tools > Console
   ```

3. Open the file [`rtl-fix.js`](./rtl-fix.js) and copy its contents.

4. Paste the code directly into the console and press `Enter`.

5. The Copilot Chat interface will now appear RTL-friendly. 🎉

## Notes

- The effect is temporary and will reset when you reload or reopen VSCode.
- You can repeat the same process each time you want to apply the RTL styling.
- Make sure the [Vazir font](https://github.com/rastikerdar/vazir-font) is installed on your system for best results.

## To-Do & Improvements

- [ ] Fix issue where LTR blocks sometimes disappear
- [ ] Improve RTL support for the question input area
- [ ] Add toggle to switch between RTL and LTR
- [ ] Convert script into a standalone VSCode extension

## License

This project is licensed under the **GNU General Public License v3.0**. See the [LICENSE](./LICENSE) file for details.

## Donation
If this project has been useful to you and you'd like to support its development, I would greatly appreciate your contribution! Here are a few ways you can help:

1. **Give a Star**: Show your support by giving a ⭐ at the top of this GitHub repository. It motivates me to keep improving!
2. **Donate**: If you'd like to contribute financially, you can donate to the following addresses:

   - **USDT (TRC20)**: `TEHjxGqu5Y2ExKBWzArBJEmrtzz3mgV5Hb`
   - **TON**: `UQAzK0qhttfz1kte3auTXGqVeRul0SyFaCZORFyV1WmYlZQj`

Your support, whether through a star or a donation, helps me continue working on projects like this. Thank you for being a part of this journey! 🚀
