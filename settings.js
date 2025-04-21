document.addEventListener('DOMContentLoaded', () => {
  const saveButton = document.getElementById('saveApiKey');
  const apiKeyInput = document.getElementById('apiKey');
  const status = document.getElementById('status');
  const testApiButton = document.getElementById('testApiKey');
  const backButton = document.getElementById('backButton');

  // Load the saved API key
  chrome.storage.sync.get('apiKey', (data) => {
    if (data.apiKey) {
      apiKeyInput.value = data.apiKey;
    }
  });

  saveButton.addEventListener('click', () => {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      status.textContent = 'Please enter a valid API Key.';
      status.className = 'error';
      return;
    }
    if (apiKey.length < 20) {
      status.textContent = 'API Key appears to be too short.';
      status.className = 'error';
      return;
    }
    chrome.storage.sync.set({ apiKey }, () => {
      status.textContent = 'API Key saved!';
      status.className = 'success';
      setTimeout(() => {
        status.textContent = '';
        status.className = '';
      }, 2000);
    });
  });

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
      testApiButton.innerHTML = '<span class="loading-spinner"></span> Testing...';
      testApiButton.disabled = true;
      try {
        const response = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'content-type': 'application/json',
            'authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: 'sonar-reasoning-pro',
            messages: [ { role: 'user', content: 'Hello' } ],
            max_tokens: 10
          })
        });
        testApiButton.innerHTML = 'Test Key';
        testApiButton.disabled = false;
        if (response.ok) {
          status.textContent = 'API Key is valid!';
          status.className = 'success';
        } else {
          if (response.status === 401) {
            status.textContent = 'Invalid API Key.';
          } else if (response.status === 429) {
            status.textContent = 'API rate limit exceeded or insufficient credits.';
          } else {
            status.textContent = `API Error: ${response.status} ${response.statusText}`;
          }
          status.className = 'error';
        }
      } catch (error) {
        testApiButton.innerHTML = 'Test Key';
        testApiButton.disabled = false;
        status.textContent = `Error: ${error.message}`;
        status.className = 'error';
      }
    });
  }

  backButton.addEventListener('click', () => {
    window.location.href = 'popup.html';
  });
});
