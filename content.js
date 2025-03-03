(function() {
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
      case "checkInjection":
        sendResponse({ injected: true });
        break;
      case "showLoading":
        showLoading();
        break;
      case "factCheckResult":
        showFactCheckResult(request.data);
        break;
      case "factCheckError":
        showError(request.error);
        break;
      case "retryFactCheck":
        retryFactCheck(request.text, request.url);
        break;
      case "startTimer":
        startTimer(request.maxTime);
        break;
      case "stopTimer":
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

  // Funktion zum Abbrechen der Fact-Check-Anfrage
  function abortFactCheck() {
    console.log('Aborting fact check...');
    
    // Stoppe den Timer
    stopTimer();
    
    // Sende eine Nachricht an das Background-Script
    chrome.runtime.sendMessage({ action: "abortFactCheck" }, (response) => {
      console.log('Abort response:', response);
      
      // Zeige eine Meldung an, dass die Anfrage abgebrochen wurde
      showError('Die Fact-Check-Anfrage wurde abgebrochen.');
    });
  }

  function showLoading() {
    if (!factCheckBox) {
      factCheckBox = createFactCheckBox();
    }
    factCheckBox.innerHTML = `
      <div class="fact-check-header">
        <h2>Fact Checker</h2>
        <button id="close-fact-check">×</button>
      </div>
      <p>Fact-checking in progress... This may take up to 2 minutes.</p>
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
    console.log('Showing fact check result:', result);
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
    console.log('Updating fact check box with:', result);
    
    // Set default values for missing sections
    const truthPercentage = result.truthPercentage || 'N/A';
    const factCheck = result.factCheck || 'No fact check provided.';
    const context = result.context || 'No context provided.';
    const sources = result.sources || [];
    
    // Determine color for truth percentage
    const truthColor = getTruthColor(truthPercentage);
    console.log('Truth color:', truthColor);
    
    // Create HTML for sources list
    const sourcesHTML = sources.length > 0 
      ? sources.map(source => `<li value="${source.index}"><a href="${source.url}" target="_blank">${source.title}</a></li>`).join('')
      : '<li>No sources provided.</li>';
    
    factCheckBox.innerHTML = `
      <div class="fact-check-header">
        <h2>Fact Checker</h2>
        <button id="close-fact-check">×</button>
      </div>
      <h3 id="truth-percentage">Truth Percentage: <span style="color: ${truthColor} !important;">${truthPercentage}</span></h3>
      <h4>Fact Check:</h4>
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
    console.log("Parsing raw result:", result);

    // Fallback for invalid result format
    if (!result || typeof result !== 'string') {
      console.error("Invalid result format, not a string:", result);
      return {
        truthPercentage: 'N/A',
        factCheck: 'The API response could not be processed.',
        context: 'Please try again with a shorter or clearer text.',
        sources: []
      };
    }

    // Create a clean version of the result with consistent newlines
    const cleanResult = result.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n');
    console.log("Cleaned result:", cleanResult);

    // Initialize the parsed result with default values
    const parsedResult = {
      truthPercentage: 'N/A',
      factCheck: 'No fact check provided.',
      context: 'No context provided.',
      sources: []
    };

    // Extract sections using regex patterns for more reliable parsing
    // Sources section
    const sourcesMatch = cleanResult.match(/Sources:[\s\S]*?(?=Truth:|Fact Check:|Context:|$)/i);
    if (sourcesMatch) {
      const sourcesText = sourcesMatch[0];
      console.log("Sources section:", sourcesText);
      
      // Extract individual sources
      const sourceLines = sourcesText.split('\n').slice(1);
      sourceLines.forEach(line => {
        const match = line.match(/(\d+)\.\s+(.+)/);
        if (match) {
          const [, index, content] = match;
          const urlMatch = content.match(/\[([^\]]+)\]\(([^)]+)\)/);
          if (urlMatch) {
            parsedResult.sources.push({ index, title: urlMatch[1], url: urlMatch[2] });
          } else {
            parsedResult.sources.push({ index, title: content, url: '#' });
          }
        }
      });
    }

    // Truth percentage section
    const truthMatch = cleanResult.match(/Truth:[\s\S]*?(?=Fact Check:|Context:|Sources:|$)/i);
    if (truthMatch) {
      const truthText = truthMatch[0].trim();
      console.log("Truth section:", truthText);
      
      // Extract the percentage
      const percentageMatch = truthText.match(/Truth:\s*(.*)/i);
      if (percentageMatch && percentageMatch[1]) {
        parsedResult.truthPercentage = percentageMatch[1].trim();
      }
    }

    // Fact Check section
    const factCheckMatch = cleanResult.match(/Fact Check:[\s\S]*?(?=Context:|Truth:|Sources:|$)/i);
    if (factCheckMatch) {
      const factCheckText = factCheckMatch[0].trim();
      console.log("Fact Check section:", factCheckText);
      
      // Extract the fact check content
      const contentMatch = factCheckText.match(/Fact Check:\s*([\s\S]*)/i);
      if (contentMatch && contentMatch[1]) {
        parsedResult.factCheck = contentMatch[1].trim();
      }
    }

    // Context section
    const contextMatch = cleanResult.match(/Context:[\s\S]*?(?=Fact Check:|Truth:|Sources:|$)/i);
    if (contextMatch) {
      const contextText = contextMatch[0].trim();
      console.log("Context section:", contextText);
      
      // Extract the context content
      const contentMatch = contextText.match(/Context:\s*([\s\S]*)/i);
      if (contentMatch && contentMatch[1]) {
        parsedResult.context = contentMatch[1].trim();
      }
    }

    // If we couldn't find any sections using the regex approach, fall back to the original method
    if (parsedResult.sources.length === 0 && 
        parsedResult.truthPercentage === 'N/A' && 
        parsedResult.factCheck === 'No fact check provided.' && 
        parsedResult.context === 'No context provided.') {
      
      console.log("Regex parsing failed, falling back to original method");
      return parseFactCheckResultOriginal(cleanResult);
    }

    // If we have sources but no truth percentage, try to extract it from the fact check or context
    if (parsedResult.truthPercentage === 'N/A' && (parsedResult.factCheck !== 'No fact check provided.' || parsedResult.context !== 'No context provided.')) {
      const percentageMatch = cleanResult.match(/(\d{1,3}(?:\.\d+)?%|\d{1,3}(?:\.\d+)? percent)/i);
      if (percentageMatch) {
        parsedResult.truthPercentage = percentageMatch[0];
        console.log("Extracted truth percentage from text:", parsedResult.truthPercentage);
      }
    }

    console.log("Final parsed result:", parsedResult);

    // Replace source references with hyperlinks
    parsedResult.factCheck = replaceSourceReferences(parsedResult.factCheck, parsedResult.sources);
    parsedResult.context = replaceSourceReferences(parsedResult.context, parsedResult.sources);

    return parsedResult;
  }

  // Original parsing method as a fallback
  function parseFactCheckResultOriginal(result) {
    const sections = result.split('\n\n');
    const parsedResult = {
      truthPercentage: 'N/A',
      factCheck: 'No fact check provided.',
      context: 'No context provided.',
      sources: []
    };

    let currentSection = '';

    sections.forEach(section => {
      if (section.toLowerCase().startsWith('sources:') || 
          section.toLowerCase().startsWith('quellen:') || 
          section.toLowerCase().startsWith('sources :') || 
          section.toLowerCase().startsWith('quellen :')) {
        currentSection = 'sources';
        const sourceLines = section.split('\n').slice(1);
        sourceLines.forEach(line => {
          const match = line.match(/(\d+)\.\s+(.+)/);
          if (match) {
            const [, index, content] = match;
            const urlMatch = content.match(/\[(.+?)\]\((.+?)\)/);
            if (urlMatch) {
              parsedResult.sources.push({ index, title: urlMatch[1], url: urlMatch[2] });
            } else {
              parsedResult.sources.push({ index, title: content, url: '#' });
            }
          }
        });
      } 
      else if (section.toLowerCase().startsWith('truth:') || 
               section.toLowerCase().startsWith('wahrheit:') || 
               section.toLowerCase().startsWith('truth :') || 
               section.toLowerCase().startsWith('wahrheit :')) {
        currentSection = 'truth';
        parsedResult.truthPercentage = section.split(':')[1].trim();
      } 
      else if (section.toLowerCase().startsWith('fact check:') || 
               section.toLowerCase().startsWith('faktencheck:') || 
               section.toLowerCase().startsWith('fact check :') || 
               section.toLowerCase().startsWith('faktencheck :')) {
        currentSection = 'factCheck';
        parsedResult.factCheck = section.split(':').slice(1).join(':').trim();
      } 
      else if (section.toLowerCase().startsWith('context:') || 
               section.toLowerCase().startsWith('kontext:') || 
               section.toLowerCase().startsWith('context :') || 
               section.toLowerCase().startsWith('kontext :')) {
        currentSection = 'context';
        parsedResult.context = section.split(':').slice(1).join(':').trim();
      } 
      else if (currentSection === 'factCheck') {
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
              url: urlParts[2] 
            });
          }
        });
      }
    }

    // Replace source references with hyperlinks
    parsedResult.factCheck = replaceSourceReferences(parsedResult.factCheck, parsedResult.sources);
    parsedResult.context = replaceSourceReferences(parsedResult.context, parsedResult.sources);

    return parsedResult;
  }

  // Helper function to replace source references with hyperlinks
  function replaceSourceReferences(text, sources) {
    if (!text || !sources || sources.length === 0) {
      return text;
    }

    // Replace references like [1], [2], etc. with hyperlinks
    let modifiedText = text;
    sources.forEach(source => {
      const regex = new RegExp(`\\[${source.index}\\]`, 'g');
      modifiedText = modifiedText.replace(regex, `<a href="${source.url}" target="_blank">[${source.index}]</a>`);
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
        if (lowerPercentage.includes('high') || lowerPercentage.includes('hoch')) {
          numericValue = 85;
        } else if (lowerPercentage.includes('medium') || lowerPercentage.includes('mittel')) {
          numericValue = 50;
        } else if (lowerPercentage.includes('low') || lowerPercentage.includes('niedrig')) {
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
        <h2>Fact Checker</h2>
        <button id="close-fact-check">×</button>
      </div>
      <div class="error-container">
        <h3 class="error-title">Fehler</h3>
        <p class="error-message">${message}</p>
        ${isApiKeyError ? `
          <div class="error-help">
            <p>So beheben Sie dieses Problem:</p>
            <ol>
              <li>Klicken Sie auf das Fact Checker-Symbol in Ihrer Symbolleiste</li>
              <li>Geben Sie Ihren Perplexity API-Schlüssel ein</li>
              <li>Klicken Sie auf "Speichern" und versuchen Sie es erneut</li>
            </ol>
            <p>Benötigen Sie einen API-Schlüssel? <a href="https://www.perplexity.ai/settings/api" target="_blank">Holen Sie sich einen von Perplexity</a></p>
          </div>
        ` : isTimeoutError ? `
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
        ` : `
          <div class="error-help">
            <p>Bitte versuchen Sie es später erneut oder prüfen Sie den Abschnitt zur Fehlerbehebung in der Erweiterungsdokumentation.</p>
            <button id="retry-fact-check" class="retry-button">Erneut versuchen</button>
          </div>
        `}
      </div>
    `;
    
    factCheckBox.style.display = 'block';
    addCloseButtonListener();
    
    // Add retry button listener if present
    const retryButton = document.getElementById('retry-fact-check');
    if (retryButton && lastSelection) {
      retryButton.addEventListener('click', function() {
        chrome.runtime.sendMessage({
          action: "retryFactCheck",
          text: lastSelection,
          url: window.location.href
        });
        showLoading();
      });
    }
  }

  function retryFactCheck(text, url) {
    // Stoppe einen eventuell laufenden Timer
    stopTimer();
    
    chrome.runtime.sendMessage({
      action: "retryFactCheck",
      text: text,
      url: url
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
${result.sources.map(source => `${source.index}. ${source.title} - ${source.url}`).join('\n')}
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
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
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
    @import url('https://fonts.googleapis.com/css2?family=Satoshi:wght@400;700&display=swap');

    #perplexity-fact-check-box {
      position: fixed;
      top: 20px;
      right: 20px;
      width: 300px;
      height: 400px;
      min-width: 200px;
      min-height: 200px;
      max-width: 80vw;
      max-height: 80vh;
      overflow-y: auto;
      background-color: #1a1f2b;
      color: white !important;
      border: 1px solid #3a3f4b;
      border-radius: 10px;
      padding: 15px;
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
      z-index: 9999;
      font-family: 'Satoshi', sans-serif !important;
    }
    #perplexity-fact-check-box * {
      font-family: 'Satoshi', sans-serif !important;
      color: white !important;
    }
    #perplexity-fact-check-box .fact-check-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      border-bottom: 1px solid #3a3f4b;
      padding-bottom: 10px;
    }
    #perplexity-fact-check-box h2 {
      margin: 0;
      text-align: center;
      width: 100%;
      font-size: 24px;
      color: white !important;
    }
    #perplexity-fact-check-box h3 {
      text-align: center;
      font-size: 20px;
      margin-top: 0;
      margin-bottom: 25px;
      color: white !important;
    }
    #perplexity-fact-check-box h4 {
      margin-top: 20px;
      margin-bottom: 10px;
      font-size: 18px;
      color: #FFC107 !important;
    }
    #perplexity-fact-check-box p, #perplexity-fact-check-box li {
      font-size: 14px;
      line-height: 1.4;
      color: #cccccc !important;
    }
    #perplexity-fact-check-box a {
      color: #FFC107 !important;
      text-decoration: none;
    }
    #perplexity-fact-check-box a:hover {
      text-decoration: underline;
      color: #e6af06 !important;
    }
    #close-fact-check {
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
      color: white !important;
      position: absolute;
      top: 10px;
      right: 10px;
    }
    #copy-result {
      display: block;
      margin-top: 15px;
      padding: 5px 10px;
      background-color: #4CAF50;
      color: white !important;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-size: 14px;
      transition: background-color 0.3s;
    }
    #copy-result:hover {
      background-color: #45a049;
    }
    .loader {
      border: 5px solid #2a2f3b;
      border-top: 5px solid #FFC107;
      border-right: 5px solid #F44336;
      border-bottom: 5px solid #4CAF50;
      border-radius: 50%;
      width: 50px;
      height: 50px;
      animation: spin 1s linear infinite;
      margin: 20px auto;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .error-container {
      padding: 20px;
      background-color: #2a2f3b;
      border-left: 4px solid #F44336;
      margin-bottom: 15px;
      border-radius: 5px;
    }
    .error-title {
      font-size: 18px;
      margin-top: 0;
      color: #F44336 !important;
    }
    .error-message {
      font-size: 14px;
      margin-bottom: 20px;
      color: #F44336 !important;
      font-weight: bold;
    }
    .error-help {
      font-size: 14px;
      background-color: #1a1f2b;
      padding: 10px;
      border-radius: 4px;
      border: 1px solid #3a3f4b;
    }
    .error-help a {
      color: #FFC107 !important;
      text-decoration: none;
    }
    .error-help a:hover {
      text-decoration: underline;
      color: #e6af06 !important;
    }
    .retry-button {
      background-color: #4CAF50;
      color: white !important;
      border: none;
      padding: 8px 15px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      margin-top: 10px;
      display: block;
      transition: background-color 0.3s;
    }
    
    .retry-button:hover {
      background-color: #45a049;
    }
    
    .loading-tip {
      font-size: 12px;
      color: #cccccc !important;
      font-style: italic;
      margin-top: 10px;
      text-align: center;
    }
    .timer-text {
      font-size: 14px;
      text-align: center;
      margin: 10px 0;
      font-weight: bold;
      color: #FFC107 !important;
    }
    .abort-button {
      background-color: #F44336;
      color: white !important;
      border: none;
      padding: 8px 15px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      margin: 10px auto;
      display: block;
      width: 120px;
      text-align: center;
      transition: background-color 0.3s;
    }
    .abort-button:hover {
      background-color: #d32f2f;
    }
  `;
  document.head.appendChild(style);
})();