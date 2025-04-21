chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "factCheckAI",
    title: "Faktenchecker with AI",
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
          sendFactCheckMessage(tab.id, info.selectionText, tab.url, tab);
        });
      } else {
        sendFactCheckMessage(tab.id, info.selectionText, tab.url, tab);
      }
    });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message in background script:', request);
  
  if (request.action === "retryFactCheck" && request.text && sender.tab) {
    console.log('Retrying fact check for:', request.text.substring(0, 50) + '...');
    sendFactCheckMessage(sender.tab.id, request.text, request.url || sender.tab.url, sender.tab);
  }
});

function sendFactCheckMessage(tabId, text, url, tab) {
  chrome.tabs.sendMessage(tabId, { action: "showLoading" });

  chrome.storage.sync.get('apiKey', async (data) => {
    if (data.apiKey) {
      try {
        const contextText = await fetchPageContent(tabId);
        const response = await factCheckWithAI(text, contextText, url, data.apiKey, tab);
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

async function factCheckWithAI(text, contextText, url, apiKey, tab) {
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
      model: 'sonar',
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

IMPORTANT: You MUST format your response EXACTLY as follows, with these exact section headings and in this exact order:

Sources:
1. [source 1 title](URL)
2. [source 2 title](URL)
...

Truth: [percentage]

Fact Check: [your fact check with inline source references, e.g. [1], [2], etc.]

Context: [your context with inline source references, e.g. [1], [2], etc.]

Do not deviate from this format. Do not add any additional sections or explanations. If you cannot find enough reliable sources to fact-check the statement, say so explicitly in the Fact Check section and explain why. If a claim is widely accepted as common knowledge, state this and provide general reference sources.` },
        { role: 'user', content: `Faktenchecker the following selected text: "${text}"\n\nBroader context from the page:\n${contextText}\n\nPage URL: ${url}` }
      ],
      max_tokens: 2048,
      temperature: 0.1,
      return_citations: true
    })
  };

  console.log('Sending request to Perplexity API...');
  
  try {
    // Set a timeout for the fetch request (120 seconds = 2 minutes)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);
    
    // Send a message to the content script to start the timer
    chrome.tabs.sendMessage(tab.id, { 
      action: "startTimer", 
      maxTime: 120 // in seconds
    });
    
    // Listen for abort requests from the content script
    const abortListener = (request, sender, sendResponse) => {
      if (request.action === "abortFactCheck") {
        console.log('User aborted fact check');
        controller.abort();
        chrome.runtime.onMessage.removeListener(abortListener);
        sendResponse({ success: true });
        return true; // Keep the message channel open for the async response
      }
    };
    chrome.runtime.onMessage.addListener(abortListener);
    
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      ...options,
      signal: controller.signal
    });
    
    // Clear the timeout and remove the listener
    clearTimeout(timeoutId);
    chrome.runtime.onMessage.removeListener(abortListener);
    
    // Send a message to stop the timer
    chrome.tabs.sendMessage(tab.id, { action: "stopTimer" });
    
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
    
    // Log the full response for debugging
    console.log('Full Perplexity API response:', JSON.stringify(result, null, 2));
    
    // If the response has a choices array, log the content
    if (result.choices && result.choices.length > 0) {
      console.log('Response content:', result.choices[0].message.content);
    }

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
      throw new Error('Request to Perplexity API timed out after 2 minutes. Please try again later.');
    }
    throw error;
  }
}