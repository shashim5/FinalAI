// Listen for messages from the webpage
window.addEventListener('message', function(event) {
  // Only accept messages from our application
  if (event.source != window) return;

  if (event.data.type === 'START_CAPTURE') {
    // Forward the request to the background script
    chrome.runtime.sendMessage(event.data, function(response) {
      window.postMessage({
        type: 'CAPTURE_RESPONSE',
        success: response.success,
        error: response.error,
        stream: response.stream
      }, '*');
    });
  }
});

// Notify the webpage that the extension is installed
window.postMessage({
  type: 'EXTENSION_INSTALLED',
  version: '1.0'
}, '*');

console.log('Interview AI Helper extension content script loaded');
