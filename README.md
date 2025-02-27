# Fact Checker Chrome Extension for Perplexity Pro Users

## Overview

This Chrome extension allows Perplexity Pro users to fact-check any text on the web using Perplexity's API. It provides a quick and seamless way to verify information without leaving the current webpage.

## Key Features

- 🔍 Fact-check any selected text on any webpage
- 📊 Get a truth percentage for the selected statement
- ✅ Receive a concise fact-check summary
- 🌐 See the statement in a broader context
- 📚 Access sources for further reading
- 🔄 Retry functionality for failed requests
- 🌍 Multilingual support - works in the language of your selected text

## Installation

1. Download the extension from https://chromewebstore.google.com/detail/fact-checker/olfaipihfeomkedngnkkmappbojmlmml
2. Click on the extension icon in your Chrome toolbar
3. Enter your Perplexity API key in the extension settings
4. Use the "Test API Key" button to verify your key is working correctly

## How to Use

1. Select / Highlight any text on a webpage
2. Right-click and select "Fact check with AI"
3. View the results in a pop-up window
4. If an error occurs, use the "Retry" button to attempt the fact check again

## Current Functionality

The extension currently:
- Uses the `sonar-reasoning-pro` model for high-quality fact-checking
- Provides sources with clickable links
- Shows a truth percentage based on source reliability
- Delivers a concise fact check summary
- Offers contextual information about the selected text
- Handles errors gracefully with retry options
- Works in multiple languages, detecting and responding in the language of your selected text

## Credit Usage

This extension uses the Perplexity API, which comes with a $5 monthly credit for Pro users. Here's what you need to know:

- Your $5 credit refreshes each month with your Perplexity Pro subscription.
- The extension uses the `sonar-reasoning-pro` model, which provides high-quality fact-checking results.
- The tool is designed to use tokens efficiently, allowing for plenty of monthly fact checks.

Tips to maximize your credit:
- Focus on shorter, specific statements for the most efficient use.
- For longer texts, select the most crucial parts for fact-checking.
- Monitor your usage through your Perplexity account to understand your personal usage patterns.

## Troubleshooting

If you encounter issues with the extension, try these solutions:

1. **API Key Issues**: 
   - Ensure your Perplexity API key is entered correctly
   - Use the "Test Key" button to verify your API key is valid
   - Check that your Perplexity Pro subscription is active

2. **No Response or Errors**:
   - Check if you've exceeded your monthly API credits
   - Try using the "Retry" button if the fact check fails
   - Refresh the page and attempt the fact check again
   - Look for error messages in the fact check popup

3. **Missing Information**:
   - If some sections (like truth percentage or context) are missing, try using the "Retry" button
   - Very long selections may be truncated - try selecting a shorter piece of text
   - Some highly specialized or very recent topics may have limited sources

If problems persist, please open an issue on GitHub with details about the error.

## Development

This extension is built using JavaScript, HTML, and CSS. It uses the Perplexity API for fact-checking.

To set up the development environment:

1. Clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the cloned repository folder

## About the Developer

This extension was developed by Deniz Raslan. Connect with me on LinkedIn: https://www.linkedin.com/in/draslan/

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Feedback

As this is my first Chrome extension, I'd love to hear your thoughts, suggestions, or any bugs you encounter. Please open an issue or submit a pull request.

## Future Plans

- Support for other browsers (Firefox, Safari, etc.)
- Enhanced UI/UX
- Additional fact-checking features

Stay tuned for updates!
