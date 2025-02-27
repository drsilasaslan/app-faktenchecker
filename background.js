chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "factCheckAI",
    title: "Fact check with AI",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "factCheckAI") {
    chrome.tabs.sendMessage(tab.id, { action: "checkInjection" }, (response) => {
      if (chrome.runtime.lastError || !response || !response.injected) {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        }, () => {
          if (chrome.runtime.lastError) {
            console.error('Error injecting script: ' + chrome.runtime.lastError.message);
            return;
          }
          sendFactCheckMessage(tab.id, info.selectionText, tab.url);
        });
      } else {
        sendFactCheckMessage(tab.id, info.selectionText, tab.url);
      }
    });
  }
});

function sendFactCheckMessage(tabId, text, url) {
  chrome.tabs.sendMessage(tabId, { action: "showLoading" });

  chrome.storage.sync.get('apiKey', async (data) => {
    if (data.apiKey) {
      try {
        const contextText = await fetchPageContent(tabId);
        const response = await factCheckWithAI(text, contextText, url, data.apiKey);
        console.log('Sending fact check result to content script:', response);
        chrome.tabs.sendMessage(tabId, {
          action: "factCheckResult",
          data: response
        });
      } catch (error) {
        console.error('Error in fact checking:', error);
        chrome.tabs.sendMessage(tabId, {
          action: "factCheckError",
          error: error.message
        });
      }
    } else {
      chrome.tabs.sendMessage(tabId, {
        action: "factCheckError",
        error: "API Key not found. Please set it in the extension popup."
      });
    }
  });
}

async function fetchPageContent(tabId) {
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: () => document.body.innerText
    });
    return result;
  } catch (error) {
    console.error('Error fetching page content:', error);
    return '';
  }
}

async function factCheckWithAI(text, contextText, url, apiKey) {
  console.log('Starting fact check with AI...');
  console.log('Text length:', text.length);
  console.log('Context length:', contextText ? contextText.length : 0);
  
  // Limit context text length to avoid too large requests
  const maxContextLength = 5000;
  if (contextText && contextText.length > maxContextLength) {
    console.log(`Context text too long (${contextText.length}), truncating to ${maxContextLength} characters`);
    contextText = contextText.substring(0, maxContextLength) + "...";
  }
  
  const options = {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'content-type': 'application/json',
      'authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'sonar-reasoning-pro',
      messages: [
        { role: 'system', content: `You are a multilingual fact-checking assistant. Your primary tasks are:

1. Detect the language of the given text.
2. Respond in the same language as the detected language of the input text.
3. Focus specifically on fact-checking the given selected text, not the entire article or page.
4. Find and provide reliable sources for the claims in the selected text, ensuring they are from different domains and strictly related to the subject.
5. Aim to provide 5-10 sources, prioritizing diversity of domains. Do not invent sources or include unrelated sources.
6. Provide a truth percentage based on the reliability and consensus of the sources. The percentage should reflect how well the selected text is supported by the sources, not the number of sources found.
7. Write a fact check (3-4 concise sentences) that directly addresses the claims in the selected text.
8. Provide context (3-4 concise sentences) that places the selected text within the broader topic or article it's from.

Format your response EXACTLY as follows, in the detected language:

Sources:
1. [source 1 title](URL)
2. [source 2 title](URL)
...

Truth: [percentage]

Fact Check: [your fact check with inline source references, e.g. [1], [2], etc.]

Context: [your context with inline source references, e.g. [1], [2], etc.]

If you cannot find enough reliable sources to fact-check the statement, say so explicitly and explain why. If a claim is widely accepted as common knowledge, state this and provide general reference sources.` },
        { role: 'user', content: `Fact check the following selected text: "${text}"\n\nBroader context from the page:\n${contextText}\n\nPage URL: ${url}` }
      ],
      max_tokens: 2048,
      temperature: 0.1,
      return_citations: true
    })
  };

  console.log('Sending request to Perplexity API...');
  
  try {
    // Set a timeout for the fetch request (30 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      ...options,
      signal: controller.signal
    });
    
    // Clear the timeout
    clearTimeout(timeoutId);
    
    console.log('Received response from Perplexity API:', response.status, response.statusText);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error('Perplexity API error response:', response.status, errorData);
      
      if (response.status === 401) {
        throw new Error('Invalid API key. Please check your Perplexity API key and try again.');
      } else if (response.status === 429) {
        throw new Error('API rate limit exceeded or insufficient credits. Please try again later.');
      } else if (response.status === 404) {
        throw new Error('API endpoint not found. The Perplexity API may have changed.');
      } else {
        throw new Error(`Perplexity API error: ${response.status} ${response.statusText}`);
      }
    }
    
    const result = await response.json();
    console.log('Perplexity API response structure:', Object.keys(result));

    if (result.error) {
      console.error('API returned error object:', result.error);
      throw new Error(`Perplexity API error: ${result.error.message || 'Unknown error'}`);
    }

    if (result.choices && result.choices.length > 0) {
      console.log('Found choices in response, extracting content...');
      const content = result.choices[0].message.content;
      console.log('Content length:', content.length);
      console.log('Content preview:', content.substring(0, 100) + '...');
      return content;
    } else {
      console.error('Invalid response structure:', result);
      throw new Error('Invalid response format from Perplexity API. The response structure may have changed.');
    }
  } catch (error) {
    console.error('Error in Perplexity API request:', error);
    if (error.name === 'AbortError') {
      throw new Error('Request to Perplexity API timed out after 30 seconds. Please try again later.');
    }
    throw error;
  }
}