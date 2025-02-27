document.addEventListener('DOMContentLoaded', () => {
  const saveButton = document.getElementById('saveApiKey');
  const apiKeyInput = document.getElementById('apiKey');
  const status = document.getElementById('status');
  const testApiButton = document.getElementById('testApiKey');

  // Load the saved API key
  chrome.storage.sync.get('apiKey', (data) => {
    if (data.apiKey) {
      apiKeyInput.value = data.apiKey;
    }
  });

  // Save the API key when the button is clicked
  saveButton.addEventListener('click', () => {
    const apiKey = apiKeyInput.value.trim();
    
    // Basic validation for API key format
    if (!apiKey) {
      status.textContent = 'Please enter a valid API Key.';
      status.className = 'error';
      return;
    }
    
    // Check if the API key has a reasonable length
    if (apiKey.length < 20) {
      status.textContent = 'API Key appears to be too short. Please check your Perplexity API key.';
      status.className = 'error';
      return;
    }

    // Save the API key
    chrome.storage.sync.set({ apiKey }, () => {
      status.textContent = 'API Key saved!';
      status.className = 'success';
      setTimeout(() => {
        status.textContent = '';
        status.className = '';
      }, 2000);
    });
  });

  // Add test API key functionality if the button exists
  if (testApiButton) {
    testApiButton.addEventListener('click', async () => {
      const apiKey = apiKeyInput.value.trim();
      
      if (!apiKey) {
        status.textContent = 'Please enter an API Key to test.';
        status.className = 'error';
        return;
      }
      
      status.textContent = 'Testing API Key...';
      status.className = '';
      
      try {
        // Simple test request to the Perplexity API
        const response = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'content-type': 'application/json',
            'authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: 'sonar-reasoning-pro',
            messages: [
              { role: 'user', content: 'Hello' }
            ],
            max_tokens: 10
          })
        });
        
        if (response.ok) {
          status.textContent = 'API Key is valid!';
          status.className = 'success';
        } else {
          const errorData = await response.json().catch(() => null);
          if (response.status === 401) {
            status.textContent = 'Invalid API Key. Please check and try again.';
          } else if (response.status === 429) {
            status.textContent = 'API rate limit exceeded or insufficient credits.';
          } else {
            status.textContent = `API Error: ${response.status} ${response.statusText}`;
          }
          status.className = 'error';
        }
      } catch (error) {
        status.textContent = `Error testing API Key: ${error.message}`;
        status.className = 'error';
      }
    });
  }
});
