// Import dependencies directly instead of using dynamic imports
const API_KEY = 'AIzaSyDfbugjoSRGIb40hn4JoxT8kLL39tIzCzM';
let recognition = null;
let model = null;

// Initialize speech recognition
function initializeSpeechRecognition() {
  recognition = new webkitSpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.onstart = () => {
    chrome.runtime.sendMessage({
      type: 'status',
      text: 'Listening...'
    });
  };

  recognition.onresult = async (event) => {
    const transcript = Array.from(event.results)
      .map(result => result[0].transcript)
      .join('');

    chrome.runtime.sendMessage({
      type: 'transcript',
      text: transcript
    });

    if (event.results[event.results.length - 1].isFinal) {
      try {
        const prompt = `You are an AI interview assistant. Please provide a concise and professional response to this interview question: ${transcript}`;
        const response = await fetch('https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=' + API_KEY, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: prompt
              }]
            }]
          })
        });

        const data = await response.json();
        const text = data.candidates[0].content.parts[0].text;

        chrome.runtime.sendMessage({
          type: 'aiResponse',
          text: text
        });
      } catch (error) {
        console.error('AI response error:', error);
        chrome.runtime.sendMessage({
          type: 'error',
          text: 'Failed to generate AI response. Please try again.'
        });
      }
    }
  };

  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    chrome.runtime.sendMessage({
      type: 'error',
      text: 'Speech recognition error: ' + event.error
    });
  };

  recognition.onend = () => {
    chrome.runtime.sendMessage({
      type: 'status',
      text: 'Click to start recording'
    });
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startRecording') {
    if (!recognition) initializeSpeechRecognition();
    recognition.start();
  } else if (message.action === 'stopRecording') {
    if (recognition) recognition.stop();
  }
});
