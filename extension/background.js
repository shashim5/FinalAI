chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'START_CAPTURE') {
    chrome.tabCapture.capture({
      audio: true,
      video: false,
      audioConstraints: {
        mandatory: {
          chromeMediaSource: 'tab',
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      }
    }, (stream) => {
      if (chrome.runtime.lastError) {
        sendResponse({
          success: false,
          error: chrome.runtime.lastError.message
        });
        return;
      }

      if (!stream) {
        sendResponse({
          success: false,
          error: 'Failed to capture audio stream'
        });
        return;
      }

      sendResponse({ success: true, stream });
    });
    return true; // Required to use sendResponse asynchronously
  }

  if (request.type === 'STOP_CAPTURE') {
    // Cleanup any active streams if needed
    sendResponse({ success: true });
  }
});

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Interview AI Helper Audio Capture extension installed');
});
