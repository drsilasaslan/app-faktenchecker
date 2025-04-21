# Faktenchecker Chrome Extension

> **Note:** This extension is currently in development and is not officially released. No license is granted for distribution or use at this time.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [How to Use](#how-to-use)
- [API Setup](#api-setup)
- [Troubleshooting](#troubleshooting)
- [Development](#development)
- [Credits](#credits)
- [License](#license)

---

## Overview

Faktenchecker is a Chrome extension that lets you fact-check selected text on any webpage using the Perplexity API. Instantly verify information, get a truth score, and review reliable sources—all without leaving your browser.

## Features

- 🔍 Fact-check any selected text on any webpage
- 📊 Get a truth percentage for the selected statement
- ✅ Receive a concise fact-check summary
- 🌐 See the statement in a broader context
- 📚 Access sources for further reading
- 🔄 Retry functionality for failed requests
- 🌍 Multilingual support—works in the language of your selected text
- ⏱️ Timer display with cancel option for long-running requests
- 🛠️ User-friendly settings menu for API key management and instructions

## How to Use

1. Select or highlight any text on a webpage.
2. Right-click and select **"Fact check with AI"**.
3. View the results in a pop-up window:
   - Truth percentage
   - Fact-check summary
   - List of sources (with links)
   - Option to retry or cancel
4. For long-running requests, monitor the remaining time and cancel if needed.

## API Setup

- **API Key Required:**
  - You need a Perplexity API key to use the extension. Get one from [Perplexity](https://www.perplexity.ai/).
  - Enter your API key in the extension's settings menu and save it.
  - Use the "Test Key" button to verify your API key is valid.

- **Tips for Efficient Usage:**
  - Focus on shorter, specific statements for the most efficient use.
  - For longer texts, select the most crucial parts for fact-checking.
  - Monitor your API usage to stay within your desired limits.

## Troubleshooting

1. **API Key Issues:**
   - Ensure your Perplexity API key is entered correctly.
   - Use the "Test Key" button to verify your API key is valid.
   - Check that your Perplexity account is active and has sufficient quota.
2. **No Response or Errors:**
   - Check if you've exceeded your API credits.
   - Try using the "Retry" button if the fact check fails.
   - Refresh the page and attempt the fact check again.
   - Look for error messages in the fact check popup.
3. **Long Waits:**
   - Some checks may take up to 2 minutes.
   - You can cancel a running check at any time.

## Development

- This extension is built using JavaScript, HTML, and CSS.
- Uses the Perplexity API for fact-checking.
- Project structure:
  - `manifest.json` – Chrome extension manifest (v3)
  - `background.js` – Handles context menu, API requests, and messaging
  - `content.js` – Injects UI, handles user interactions, displays results
  - `popup.html` / `popup.js` – Main extension popup UI
  - `settings.html` / `settings.js` – Settings page for API key and instructions
  - `styles.css` – Shared styles for popup and settings
  - `images/` – Extension icons and assets
- To run locally:
  1. Clone this repository
  2. Open Chrome and go to `chrome://extensions/`
  3. Enable "Developer mode"
  4. Click "Load unpacked" and select the project folder

## Credits

- This extension is a fork of the original project by Deniz Raslan.
- Further developed and maintained by OTONGO.tools.

## License

> **No license is granted at this time.**
> This extension is not officially released or distributed.

3. **Missing Information**:
   - If some sections (like truth percentage or context) are missing, try using the "Retry" button
   - Very long selections may be truncated - try selecting a shorter piece of text
   - Some highly specialized or very recent topics may have limited sources

If problems persist, please open an issue on GitHub with details about the error.

## Development

Not available yet, release soo.

## About the Developer

This extension is a fork from Deniz Raslan. Further developed by OTONGO.tools

## License

no licence at the moment

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Feedback

As this is a fork of Deniz Raslan's first Chrome extension, I'd love to hear your thoughts, suggestions, or any bugs you encounter. Please open an issue or submit a pull request.

## Future Plans

- Support for other browsers (Firefox, Safari, etc.)
- Enhanced UI/UX
- Additional fact-checking features

Stay tuned for updates!
