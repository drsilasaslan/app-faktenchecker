(function () {
  if (window.perplexityFactCheckerInjected) {
    return;
  }
  window.perplexityFactCheckerInjected = true;

  let factCheckBox = null;

  // Globale Variablen für den Timer
  let timerInterval = null;
  let remainingTime = 0;

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Received message in content script:', request);
    switch (request.action) {
      case 'checkInjection':
        sendResponse({ injected: true });
        break;
      case 'showLoading':
        showLoading();
        break;
      case 'factCheckResult':
        showFactCheckResult(request.data);
        break;
      case 'factCheckError':
        showError(request.error);
        break;
      case 'retryFactCheck':
        retryFactCheck(request.text, request.url);
        break;
      case 'startTimer':
        startTimer(request.maxTime);
        break;
      case 'stopTimer':
        stopTimer();
        break;
    }
  });

  // Funktion zum Starten des Timers
  function startTimer(maxTime) {
    // Stoppe einen eventuell laufenden Timer
    stopTimer();

    // Setze die verbleibende Zeit
    remainingTime = maxTime;

    // Aktualisiere die Loading-Anzeige
    updateLoadingDisplay();

    // Starte den Timer-Intervall
    timerInterval = setInterval(() => {
      remainingTime--;
      updateLoadingDisplay();

      // Wenn die Zeit abgelaufen ist, stoppe den Timer
      if (remainingTime <= 0) {
        stopTimer();
      }
    }, 1000);
  }

  // Funktion zum Stoppen des Timers
  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  // Funktion zum Aktualisieren der Loading-Anzeige
  function updateLoadingDisplay() {
    if (!factCheckBox) return;

    // Formatiere die verbleibende Zeit
    const minutes = Math.floor(remainingTime / 60);
    const seconds = remainingTime % 60;
    const timeString = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

    // Aktualisiere den Timer-Text
    const timerElement = factCheckBox.querySelector('.timer-text');
    if (timerElement) {
      timerElement.textContent = `Verbleibende Zeit: ${timeString}`;
    }
  }

  // Funktion zum Abbrechen der Faktencheck-Anfrage
  function abortFactCheck() {
    console.log('Aborting Faktencheck...');

    // Stoppe den Timer
    stopTimer();

    // Sende eine Nachricht an das Background-Script
    chrome.runtime.sendMessage({ action: 'abortFactCheck' }, (response) => {
      console.log('Abort response:', response);

      // Zeige eine Meldung an, dass die Anfrage abgebrochen wurde
      showError('Die Faktencheck-Anfrage wurde abgebrochen.');
    });
  }

  function showLoading() {
    if (!factCheckBox) {
      factCheckBox = createFactCheckBox();
    }
    factCheckBox.innerHTML = `
      <div class="fact-check-header">
        <h2>Faktenchecker</h2>
        <button id="close-fact-check">×</button>
      </div>
      <p>Faktencheck in progress... This may take up to 2 minutes.</p>
      <div class="loader"></div>
      <p class="timer-text">Verbleibende Zeit: 2:00</p>
      <p class="loading-tip">Tipp: Längere Texte können mehr Zeit in Anspruch nehmen.</p>
      <button id="abort-fact-check" class="abort-button">Abbrechen</button>
    `;
    factCheckBox.style.display = 'block';
    addCloseButtonListener();

    // Füge einen Event-Listener für den Abbrechen-Button hinzu
    const abortButton = factCheckBox.querySelector('#abort-fact-check');
    if (abortButton) {
      abortButton.addEventListener('click', abortFactCheck);
    }
  }

  function showFactCheckResult(result) {
    console.log('Showing Faktencheck result:', result);
    if (!factCheckBox) {
      factCheckBox = createFactCheckBox();
    }
    const parsedResult = parseFactCheckResult(result);
    updateFactCheckBox(parsedResult);
  }

  function createFactCheckBox() {
    const box = document.createElement('div');
    box.id = 'perplexity-fact-check-box';
    document.body.appendChild(box);
    makeDraggableAndResizable(box);
    return box;
  }

  function updateFactCheckBox(result) {
    console.log('Updating Faktencheck box with:', result);

    // Set default values for missing sections
    const truthPercentage = result.truthPercentage || 'N/A';
    const factCheck = result.factCheck || 'No Faktencheck provided.';
    const context = result.context || 'No context provided.';
    const sources = result.sources || [];

    // Determine color for truth percentage
    const truthColor = getTruthColor(truthPercentage);
    console.log('Truth color:', truthColor);

    // Create HTML for sources list
    const sourcesHTML =
      sources.length > 0
        ? sources
            .map(
              (source) =>
                `<li value="${source.index}"><a href="${source.url}" target="_blank">${source.title}</a></li>`
            )
            .join('')
        : '<li>No sources provided.</li>';

    factCheckBox.innerHTML = `
      <div class="fact-check-header">
        <h2>Faktenchecker</h2>
        <button id="close-fact-check">×</button>
      </div>
      <h3 id="truth-percentage">Truth Percentage: <span style="color: ${truthColor} !important;">${truthPercentage}</span></h3>
      <h4>Faktencheck:</h4>
      <p>${factCheck}</p>
      <h4>Context:</h4>
      <p>${context}</p>
      <h4>Sources:</h4>
      <ol>
        ${sourcesHTML}
      </ol>
      <button id="copy-result">Copy Result</button>
    `;
    factCheckBox.style.display = 'block';
    addCloseButtonListener();
    addCopyButtonListener(result);
  }

  function parseFactCheckResult(result) {
    console.log('Parsing raw result:', result);

    // Fallback for invalid result format
    if (!result || typeof result !== 'string') {
      console.error('Invalid result format, not a string:', result);
      return {
        truthPercentage: 'N/A',
        factCheck: 'The API response could not be processed.',
        context: 'Please try again with a shorter or clearer text.',
        sources: [],
      };
    }

    // Create a clean version of the result with consistent newlines
    const cleanResult = result
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n');
    console.log('Cleaned result:', cleanResult);

    // Initialize the parsed result with default values
    const parsedResult = {
      truthPercentage: 'N/A',
      factCheck: 'No Faktencheck provided.',
      context: 'No context provided.',
      sources: [],
    };

    // Extract sections using regex patterns for more reliable parsing
    // Sources section
    const sourcesMatch = cleanResult.match(
      /Sources:[\s\S]*?(?=Truth:|Faktencheck:|Context:|$)/i
    );
    if (sourcesMatch) {
      const sourcesText = sourcesMatch[0];
      console.log('Sources section:', sourcesText);

      // Extract individual sources
      const sourceLines = sourcesText.split('\n').slice(1);
      sourceLines.forEach((line) => {
        const match = line.match(/(\d+)\.\s+(.+)/);
        if (match) {
          const [, index, content] = match;
          const urlMatch = content.match(/\[([^\]]+)\]\(([^)]+)\)/);
          if (urlMatch) {
            parsedResult.sources.push({
              index,
              title: urlMatch[1],
              url: urlMatch[2],
            });
          } else {
            parsedResult.sources.push({ index, title: content, url: '#' });
          }
        }
      });
    }

    // Truth percentage section
    const truthMatch = cleanResult.match(
      /Truth:[\s\S]*?(?=Faktencheck:|Context:|Sources:|$)/i
    );
    if (truthMatch) {
      const truthText = truthMatch[0].trim();
      console.log('Truth section:', truthText);

      // Extract the percentage
      const percentageMatch = truthText.match(/Truth:\s*(.*)/i);
      if (percentageMatch && percentageMatch[1]) {
        parsedResult.truthPercentage = percentageMatch[1].trim();
      }
    }

    // Faktencheck section
    const factCheckMatch = cleanResult.match(
      /Faktencheck:[\s\S]*?(?=Context:|Truth:|Sources:|$)/i
    );
    if (factCheckMatch) {
      const factCheckText = factCheckMatch[0].trim();
      console.log('Faktencheck section:', factCheckText);

      // Extract the Faktencheck content
      const contentMatch = factCheckText.match(/Faktencheck:\s*([\s\S]*)/i);
      if (contentMatch && contentMatch[1]) {
        parsedResult.factCheck = contentMatch[1].trim();
      }
    }

    // Context section
    const contextMatch = cleanResult.match(
      /Context:[\s\S]*?(?=Faktencheck:|Truth:|Sources:|$)/i
    );
    if (contextMatch) {
      const contextText = contextMatch[0].trim();
      console.log('Context section:', contextText);

      // Extract the context content
      const contentMatch = contextText.match(/Context:\s*([\s\S]*)/i);
      if (contentMatch && contentMatch[1]) {
        parsedResult.context = contentMatch[1].trim();
      }
    }

    // If we couldn't find any sections using the regex approach, fall back to the original method
    if (
      parsedResult.sources.length === 0 &&
      parsedResult.truthPercentage === 'N/A' &&
      parsedResult.factCheck === 'No Faktencheck provided.' &&
      parsedResult.context === 'No context provided.'
    ) {
      console.log('Regex parsing failed, falling back to original method');
      return parseFactCheckResultOriginal(cleanResult);
    }

    // If we have sources but no truth percentage, try to extract it from the Faktencheck or context
    if (
      parsedResult.truthPercentage === 'N/A' &&
      (parsedResult.factCheck !== 'No Faktencheck provided.' ||
        parsedResult.context !== 'No context provided.')
    ) {
      const percentageMatch = cleanResult.match(
        /(\d{1,3}(?:\.\d+)?%|\d{1,3}(?:\.\d+)? percent)/i
      );
      if (percentageMatch) {
        parsedResult.truthPercentage = percentageMatch[0];
        console.log(
          'Extracted truth percentage from text:',
          parsedResult.truthPercentage
        );
      }
    }

    console.log('Final parsed result:', parsedResult);

    // Replace source references with hyperlinks
    parsedResult.factCheck = replaceSourceReferences(
      parsedResult.factCheck,
      parsedResult.sources
    );
    parsedResult.context = replaceSourceReferences(
      parsedResult.context,
      parsedResult.sources
    );

    return parsedResult;
  }

  // Original parsing method as a fallback
  function parseFactCheckResultOriginal(result) {
    const sections = result.split('\n\n');
    const parsedResult = {
      truthPercentage: 'N/A',
      factCheck: 'No Faktencheck provided.',
      context: 'No context provided.',
      sources: [],
    };

    let currentSection = '';

    sections.forEach((section) => {
      if (
        section.toLowerCase().startsWith('sources:') ||
        section.toLowerCase().startsWith('quellen:') ||
        section.toLowerCase().startsWith('sources :') ||
        section.toLowerCase().startsWith('quellen :')
      ) {
        currentSection = 'sources';
        const sourceLines = section.split('\n').slice(1);
        sourceLines.forEach((line) => {
          const match = line.match(/(\d+)\.\s+(.+)/);
          if (match) {
            const [, index, content] = match;
            const urlMatch = content.match(/\[(.+?)\]\((.+?)\)/);
            if (urlMatch) {
              parsedResult.sources.push({
                index,
                title: urlMatch[1],
                url: urlMatch[2],
              });
            } else {
              parsedResult.sources.push({ index, title: content, url: '#' });
            }
          }
        });
      } else if (
        section.toLowerCase().startsWith('truth:') ||
        section.toLowerCase().startsWith('wahrheit:') ||
        section.toLowerCase().startsWith('truth :') ||
        section.toLowerCase().startsWith('wahrheit :')
      ) {
        currentSection = 'truth';
        parsedResult.truthPercentage = section.split(':')[1].trim();
      } else if (
        section.toLowerCase().startsWith('faktencheck:') ||
        section.toLowerCase().startsWith('faktencheck :')
      ) {
        currentSection = 'factCheck';
        parsedResult.factCheck = section.split(':').slice(1).join(':').trim();
      } else if (
        section.toLowerCase().startsWith('context:') ||
        section.toLowerCase().startsWith('kontext:') ||
        section.toLowerCase().startsWith('context :') ||
        section.toLowerCase().startsWith('kontext :')
      ) {
        currentSection = 'context';
        parsedResult.context = section.split(':').slice(1).join(':').trim();
      } else if (currentSection === 'factCheck') {
        parsedResult.factCheck += ' ' + section.trim();
      } else if (currentSection === 'context') {
        parsedResult.context += ' ' + section.trim();
      }
    });

    // If no sources found, try to extract them from the text
    if (parsedResult.sources.length === 0) {
      const urlMatches = result.match(/\[([^\]]+)\]\(([^)]+)\)/g);
      if (urlMatches && urlMatches.length > 0) {
        urlMatches.forEach((match, index) => {
          const urlParts = match.match(/\[([^\]]+)\]\(([^)]+)\)/);
          if (urlParts && urlParts.length >= 3) {
            parsedResult.sources.push({
              index: index + 1,
              title: urlParts[1],
              url: urlParts[2],
            });
          }
        });
      }
    }

    // Replace source references with hyperlinks
    parsedResult.factCheck = replaceSourceReferences(
      parsedResult.factCheck,
      parsedResult.sources
    );
    parsedResult.context = replaceSourceReferences(
      parsedResult.context,
      parsedResult.sources
    );

    return parsedResult;
  }

  // Helper function to replace source references with hyperlinks
  function replaceSourceReferences(text, sources) {
    if (!text || !sources || sources.length === 0) {
      return text;
    }

    // Replace references like [1], [2], etc. with hyperlinks
    let modifiedText = text;
    sources.forEach((source) => {
      const regex = new RegExp(`\\[${source.index}\\]`, 'g');
      modifiedText = modifiedText.replace(
        regex,
        `<a href="${source.url}" target="_blank">[${source.index}]</a>`
      );
    });

    return modifiedText;
  }

  function getTruthColor(percentage) {
    // Handle N/A case
    if (!percentage || percentage === 'N/A') {
      return '#888888'; // Gray for unknown
    }

    // Extract numeric value from percentage string
    let numericValue;

    if (typeof percentage === 'string') {
      // Try to extract a number from the string
      const matches = percentage.match(/(\d+(?:\.\d+)?)/);
      if (matches && matches[1]) {
        numericValue = parseFloat(matches[1]);
      } else {
        // Handle text-based percentages
        const lowerPercentage = percentage.toLowerCase();
        if (
          lowerPercentage.includes('high') ||
          lowerPercentage.includes('hoch')
        ) {
          numericValue = 85;
        } else if (
          lowerPercentage.includes('medium') ||
          lowerPercentage.includes('mittel')
        ) {
          numericValue = 50;
        } else if (
          lowerPercentage.includes('low') ||
          lowerPercentage.includes('niedrig')
        ) {
          numericValue = 25;
        } else {
          return '#888888'; // Gray for unknown format
        }
      }
    } else if (typeof percentage === 'number') {
      numericValue = percentage;
    } else {
      return '#888888'; // Gray for unknown type
    }

    // Ensure the value is between 0 and 100
    numericValue = Math.max(0, Math.min(100, numericValue));

    // Determine color based on percentage - using the logo colors
    if (numericValue >= 80) {
      return '#4CAF50'; // Green for high truth
    } else if (numericValue >= 60) {
      return '#8BC34A'; // Light green for mostly true
    } else if (numericValue >= 40) {
      return '#FFC107'; // Yellow for mixed
    } else if (numericValue >= 20) {
      return '#FF9800'; // Orange for mostly false
    } else {
      return '#F44336'; // Red for false
    }
  }

  function showError(message) {
    console.error('Showing error:', message);
    if (!factCheckBox) {
      factCheckBox = createFactCheckBox();
    }

    // Store the last selection for retry functionality
    const lastSelection = window.getSelection().toString();

    // Determine if this is an API key related error
    const isApiKeyError = message.toLowerCase().includes('api key');
    const isTimeoutError = message.toLowerCase().includes('timed out');

    factCheckBox.innerHTML = `
      <div class="fact-check-header">
        <h2>Faktenchecker</h2>
        <button id="close-fact-check">×</button>
      </div>
      <div class="error-container">
        <h3 class="error-title">Fehler</h3>
        <p class="error-message">${message}</p>
        ${
          isApiKeyError
            ? `
          <div class="error-help">
            <p>So beheben Sie dieses Problem:</p>
            <ol>
              <li>Klicken Sie auf das Faktenchecker-Symbol in Ihrer Symbolleiste</li>
              <li>Geben Sie Ihren Perplexity API-Schlüssel ein</li>
              <li>Klicken Sie auf "Speichern" und versuchen Sie es erneut</li>
            </ol>
            <p>Benötigen Sie einen API-Schlüssel? <a href="https://www.perplexity.ai/settings/api" target="_blank">Holen Sie sich einen von Perplexity</a></p>
          </div>
        `
            : isTimeoutError
              ? `
          <div class="error-help">
            <p>Die Anfrage hat zu lange gedauert (über 2 Minuten). Mögliche Gründe:</p>
            <ul>
              <li>Der ausgewählte Text ist zu lang</li>
              <li>Die Perplexity-Server sind derzeit überlastet</li>
              <li>Ihre Internetverbindung ist instabil</li>
            </ul>
            <p>Bitte versuchen Sie es mit einem kürzeren Text oder zu einem späteren Zeitpunkt erneut.</p>
            <button id="retry-fact-check" class="retry-button">Erneut versuchen</button>
          </div>
        `
              : `
          <div class="error-help">
            <p>Bitte versuchen Sie es später erneut oder prüfen Sie den Abschnitt zur Fehlerbehebung in der Erweiterungsdokumentation.</p>
            <button id="retry-fact-check" class="retry-button">Erneut versuchen</button>
          </div>
        `
        }
      </div>
    `;

    factCheckBox.style.display = 'block';
    addCloseButtonListener();

    // Add retry button listener if present
    const retryButton = document.getElementById('retry-fact-check');
    if (retryButton && lastSelection) {
      retryButton.addEventListener('click', function () {
        chrome.runtime.sendMessage({
          action: 'retryFactCheck',
          text: lastSelection,
          url: window.location.href,
        });
        showLoading();
      });
    }
  }

  function retryFactCheck(text, url) {
    // Stoppe einen eventuell laufenden Timer
    stopTimer();

    chrome.runtime.sendMessage({
      action: 'retryFactCheck',
      text: text,
      url: url,
    });
    showLoading();
  }

  function addCloseButtonListener() {
    const closeButton = document.getElementById('close-fact-check');
    if (closeButton) {
      console.log('Close button found, adding event listener');

      // Entferne alle existierenden Event-Listener
      const newCloseButton = closeButton.cloneNode(true);
      closeButton.parentNode.replaceChild(newCloseButton, closeButton);

      // Füge den neuen Event-Listener hinzu
      newCloseButton.addEventListener('click', (e) => {
        console.log('Close button clicked');
        e.preventDefault();
        e.stopPropagation();
        if (factCheckBox) {
          factCheckBox.style.display = 'none';
        }
        // Stoppe einen eventuell laufenden Timer
        stopTimer();
      });

      // Verhindere, dass der Schließen-Button das Drag & Drop auslöst
      newCloseButton.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    } else {
      console.log('Close button not found');
    }
  }

  function addCopyButtonListener(result) {
    const copyButton = document.getElementById('copy-result');
    if (copyButton) {
      copyButton.addEventListener('click', () => {
        const textToCopy = `
Truth Percentage: ${result.truthPercentage}

Fact Check: ${result.factCheck}

Context: ${result.context}

Sources:
${result.sources.map((source) => `${source.index}. ${source.title} - ${source.url}`).join('\n')}
        `;
        navigator.clipboard.writeText(textToCopy).then(() => {
          copyButton.textContent = 'Copied!';
          setTimeout(() => {
            copyButton.textContent = 'Copy Result';
          }, 2000);
        });
      });
    }
  }

  function isDarkMode() {
    return (
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    );
  }

  function makeDraggableAndResizable(element) {
    let isResizing = false;
    let isDragging = false;
    let startX, startY, startWidth, startHeight, startLeft, startTop;
    let resizeDirection = '';

    element.addEventListener('mousedown', startDragOrResize);
    document.addEventListener('mousemove', dragOrResize);
    document.addEventListener('mouseup', stopDragOrResize);
    element.addEventListener('mousemove', updateCursor);

    function startDragOrResize(e) {
      if (isNearEdge(e, element)) {
        isResizing = true;
        resizeDirection = getResizeDirection(e, element);
      } else {
        isDragging = true;
      }
      startX = e.clientX;
      startY = e.clientY;
      startWidth = element.offsetWidth;
      startHeight = element.offsetHeight;
      startLeft = element.offsetLeft;
      startTop = element.offsetTop;
      e.preventDefault();
    }

    function dragOrResize(e) {
      if (isResizing) {
        resize(e);
      } else if (isDragging) {
        drag(e);
      }
    }

    function resize(e) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (resizeDirection.includes('w')) {
        element.style.width = `${Math.max(200, startWidth - dx)}px`;
        element.style.left = `${startLeft + dx}px`;
      } else if (resizeDirection.includes('e')) {
        element.style.width = `${Math.max(200, startWidth + dx)}px`;
      }

      if (resizeDirection.includes('n')) {
        element.style.height = `${Math.max(200, startHeight - dy)}px`;
        element.style.top = `${startTop + dy}px`;
      } else if (resizeDirection.includes('s')) {
        element.style.height = `${Math.max(200, startHeight + dy)}px`;
      }
    }

    function drag(e) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      element.style.left = `${startLeft + dx}px`;
      element.style.top = `${startTop + dy}px`;
    }

    function stopDragOrResize() {
      isResizing = false;
      isDragging = false;
      resizeDirection = '';
      element.style.cursor = 'default';
    }

    function updateCursor(e) {
      const direction = getResizeDirection(e, element);
      if (direction) {
        element.style.cursor = getCursorStyle(direction);
      } else {
        element.style.cursor = 'move';
      }
    }

    function isNearEdge(e, element) {
      const rect = element.getBoundingClientRect();
      const edgeThreshold = 10;
      return (
        e.clientX < rect.left + edgeThreshold ||
        e.clientX > rect.right - edgeThreshold ||
        e.clientY < rect.top + edgeThreshold ||
        e.clientY > rect.bottom - edgeThreshold
      );
    }

    function getResizeDirection(e, element) {
      const rect = element.getBoundingClientRect();
      const edgeThreshold = 10;
      let direction = '';

      if (e.clientY < rect.top + edgeThreshold) direction += 'n';
      else if (e.clientY > rect.bottom - edgeThreshold) direction += 's';

      if (e.clientX < rect.left + edgeThreshold) direction += 'w';
      else if (e.clientX > rect.right - edgeThreshold) direction += 'e';

      return direction;
    }

    function getCursorStyle(direction) {
      switch (direction) {
        case 'n':
        case 's':
          return 'ns-resize';
        case 'e':
        case 'w':
          return 'ew-resize';
        case 'nw':
        case 'se':
          return 'nwse-resize';
        case 'ne':
        case 'sw':
          return 'nesw-resize';
        default:
          return 'move';
      }
    }
  }

  const style = document.createElement('style');
  style.textContent = `
    #perplexity-fact-check-box {
      position: fixed;
      top: 20px;
      right: 20px;
      width: 320px;
      height: 450px;
      min-width: 280px;
      min-height: 200px;
      max-width: 80vw;
      max-height: 80vh;
      overflow-y: auto;
      background-color: #001A33;
      color: white !important;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
      z-index: 9999;
      font-family: 'Segoe UI', 'Roboto', sans-serif !important;
    }
    #perplexity-fact-check-box * {
      font-family: 'Segoe UI', 'Roboto', sans-serif !important;
      color: white !important;
    }
    #perplexity-fact-check-box .fact-check-header {
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      margin-bottom: 25px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      padding-bottom: 15px;
      background: radial-gradient(circle at center, #002952 0%, #001A33 70%);
      margin: -20px -20px 20px -20px;
      padding: 20px;
      border-radius: 12px 12px 0 0;
    }
    #perplexity-fact-check-box h2 {
      margin: 0;
      text-align: center;
      width: 100%;
      font-size: 24px;
      font-weight: 600;
      color: white !important;
      letter-spacing: 0.5px;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }
    #perplexity-fact-check-box h3 {
      text-align: center;
      font-size: 20px;
      margin-top: 0;
      margin-bottom: 25px;
      color: white !important;
      position: relative;
      padding-bottom: 15px;
    }
    #perplexity-fact-check-box h3::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 70%;
      height: 6px;
      background: linear-gradient(to right, #EF4444 0%, #F59E0B 50%, #22C55E 100%);
      border-radius: 10px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }
    #perplexity-fact-check-box h4 {
      margin-top: 20px;
      margin-bottom: 12px;
      font-size: 18px;
      color: #22C55E !important;
      font-weight: 600;
      border-bottom: 2px solid rgba(34, 197, 94, 0.3);
      padding-bottom: 8px;
      display: inline-block;
    }
    #perplexity-fact-check-box p, 
    #perplexity-fact-check-box li {
      font-size: 14px;
      line-height: 1.5;
      color: #e6e6e6 !important;
      margin-bottom: 10px;
    }
    #perplexity-fact-check-box a {
      color: #22C55E !important;
      text-decoration: none;
      font-weight: 500;
      transition: all 0.2s ease;
      border-bottom: 1px dashed rgba(34, 197, 94, 0.3);
      padding-bottom: 1px;
    }
    #perplexity-fact-check-box a:hover {
      color: #1ea750 !important;
      border-bottom-style: solid;
    }
    #perplexity-fact-check-box #close-fact-check {
      background: none;
      border: none;
      font-size: 22px;
      cursor: pointer;
      color: white !important;
      position: absolute;
      top: 15px;
      right: 15px;
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: all 0.2s ease;
    }
    #perplexity-fact-check-box #close-fact-check:hover {
      background-color: rgba(255, 255, 255, 0.1);
    }
    #perplexity-fact-check-box #copy-result {
      display: block;
      margin: 20px auto 5px auto;
      padding: 10px 15px;
      background-color: #22C55E;
      color: white !important;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      transition: all 0.3s ease;
      box-shadow: 0 4px 6px rgba(34, 197, 94, 0.2);
      max-width: 200px;
      width: 100%;
      position: relative;
      overflow: hidden;
      letter-spacing: 0.3px;
    }
    #perplexity-fact-check-box #copy-result::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0));
      opacity: 0;
      transition: opacity 0.3s ease;
    }
    #perplexity-fact-check-box #copy-result:hover::after {
      opacity: 1;
    }
    #perplexity-fact-check-box #copy-result:hover {
      background-color: #1ea750;
      box-shadow: 0 6px 10px rgba(34, 197, 94, 0.3);
      transform: translateY(-1px);
    }
    #perplexity-fact-check-box #copy-result:active {
      transform: translateY(1px);
    }
    #perplexity-fact-check-box .loader {
      border: 5px solid rgba(0, 10, 20, 0.3);
      border-top: 5px solid #22C55E;
      border-right: 5px solid #0073e6;
      border-bottom: 5px solid #22C55E;
      border-radius: 50%;
      width: 60px;
      height: 60px;
      animation: perplexity-fact-check-spin 0.8s cubic-bezier(0.55, 0.055, 0.675, 0.19) infinite;
      margin: 30px auto;
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
    }
    @keyframes perplexity-fact-check-spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    #perplexity-fact-check-box .error-container {
      padding: 20px;
      background-color: rgba(239, 68, 68, 0.1);
      border-left: 4px solid #EF4444;
      margin-bottom: 15px;
      border-radius: 8px;
    }
    #perplexity-fact-check-box .error-title {
      font-size: 18px;
      margin-top: 0;
      color: #EF4444 !important;
      font-weight: 600;
    }
    #perplexity-fact-check-box .error-message {
      font-size: 15px;
      margin-bottom: 20px;
      color: #ffffff !important;
      font-weight: 500;
    }
    #perplexity-fact-check-box .error-help {
      font-size: 14px;
      background-color: rgba(0, 10, 20, 0.3);
      padding: 15px;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      line-height: 1.5;
    }
    #perplexity-fact-check-box .error-help a {
      color: #22C55E !important;
      text-decoration: none;
      font-weight: 500;
      transition: all 0.2s ease;
      border-bottom: 1px dashed rgba(34, 197, 94, 0.3);
      padding-bottom: 1px;
    }
    #perplexity-fact-check-box .error-help a:hover {
      color: #1ea750 !important;
      border-bottom-style: solid;
    }
    #perplexity-fact-check-box .retry-button {
      background-color: #22C55E;
      color: white !important;
      border: none;
      padding: 10px 15px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      margin: 15px auto 5px auto;
      display: block;
      transition: all 0.3s ease;
      box-shadow: 0 4px 6px rgba(34, 197, 94, 0.2);
      max-width: 200px;
      width: 100%;
      position: relative;
      overflow: hidden;
      letter-spacing: 0.3px;
    }
    #perplexity-fact-check-box .retry-button::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0));
      opacity: 0;
      transition: opacity 0.3s ease;
    }
    #perplexity-fact-check-box .retry-button:hover::after {
      opacity: 1;
    }
    #perplexity-fact-check-box .retry-button:hover {
      background-color: #1ea750;
      box-shadow: 0 6px 10px rgba(34, 197, 94, 0.3);
      transform: translateY(-1px);
    }
    #perplexity-fact-check-box .retry-button:active {
      transform: translateY(1px);
    }
    #perplexity-fact-check-box .loading-tip {
      font-size: 13px;
      color: #e6e6e6 !important;
      font-style: italic;
      margin-top: 15px;
      text-align: center;
      background-color: rgba(0, 10, 20, 0.3);
      padding: 10px 15px;
      border-radius: 8px;
      box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1);
    }
    #perplexity-fact-check-box .timer-text {
      font-size: 16px;
      text-align: center;
      margin: 15px 0;
      font-weight: 600;
      color: #22C55E !important;
      letter-spacing: 0.5px;
    }
    #perplexity-fact-check-box .abort-button {
      background-color: #EF4444;
      color: white !important;
      border: none;
      padding: 10px 15px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      margin: 15px auto 5px auto;
      display: block;
      width: 140px;
      text-align: center;
      transition: all 0.3s ease;
      box-shadow: 0 4px 6px rgba(239, 68, 68, 0.2);
      position: relative;
      overflow: hidden;
      letter-spacing: 0.3px;
    }
    #perplexity-fact-check-box .abort-button::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0));
      opacity: 0;
      transition: opacity 0.3s ease;
    }
    #perplexity-fact-check-box .abort-button:hover::after {
      opacity: 1;
    }
    #perplexity-fact-check-box .abort-button:hover {
      background-color: #dc2626;
      box-shadow: 0 6px 10px rgba(239, 68, 68, 0.3);
      transform: translateY(-1px);
    }
    #perplexity-fact-check-box .abort-button:active {
      transform: translateY(1px);
    }
  `;
  document.head.appendChild(style);
})();
