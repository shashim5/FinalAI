import { GoogleGenerativeAI } from '@google/generative-ai';
import { SystemAudioConfig, SystemAudioProcessor, SystemRecognitionResult } from '../types/systemAudio';
import { RecognitionResult } from '../types/recognition';

// Mock phrases for simulation mode
export const mockPhrases = [
  "Tell me about your experience with React and web development.",
  "How do you handle state management in complex applications?",
  "Can you describe a challenging project you worked on?",
  "What's your approach to debugging and testing?",
  "How do you stay updated with new technologies?"
];

// AI Configuration
const API_KEY = 'AIzaSyDfbugjoSRGIb40hn4JoxT8kLL39tIzCzM';
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

// Default system audio configuration
const defaultSystemAudioConfig: SystemAudioConfig = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
  channelCount: 2,
  sampleRate: 44100
};

export const generateAIResponse = async (text: string): Promise<string> => {
  try {
    const result = await model.generateContent(text);
    const response = result.response;
    return response.text();
  } catch (error) {
    console.error('Error generating AI response:', error);
    return 'Error generating response. Please try again.';
  }
};

export const checkSystemAudioAvailability = async (): Promise<boolean> => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const hasSystemAudio = devices.some(device =>
      device.kind === 'audioinput' &&
      (device.label.toLowerCase().includes('system') ||
       device.label.toLowerCase().includes('virtual') ||
       device.label.toLowerCase().includes('output') ||
       device.label.toLowerCase().includes('monitor') ||
       device.label.toLowerCase().includes('mix') ||
       device.label.toLowerCase().includes('loopback'))
    );
    return hasSystemAudio;
  } catch (error) {
    console.error('Error checking system audio:', error);
    return false;
  }
};

const setupSystemAudioProcessor = async (config: SystemAudioConfig = defaultSystemAudioConfig): Promise<SystemAudioProcessor | null> => {
  try {
    const context = new AudioContext({ sampleRate: config.sampleRate });
    await context.audioWorklet.addModule('/audioWorklet.js');

    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioDevice = devices.find(device =>
      device.kind === 'audioinput' &&
      (device.label.toLowerCase().includes('system') ||
       device.label.toLowerCase().includes('virtual') ||
       device.label.toLowerCase().includes('output') ||
       device.label.toLowerCase().includes('monitor') ||
       device.label.toLowerCase().includes('mix') ||
       device.label.toLowerCase().includes('loopback'))
    );

    if (!audioDevice) {
      throw new Error('No suitable system audio device found');
    }

    const constraints: MediaTrackConstraints = {
      deviceId: { exact: audioDevice.deviceId },
      ...config,
      noiseSuppression: { ideal: config.noiseSuppression },
      echoCancellation: { ideal: config.echoCancellation },
      autoGainControl: { ideal: config.autoGainControl }
    };

    const stream = await navigator.mediaDevices.getUserMedia({ audio: constraints });
    const source = context.createMediaStreamSource(stream);
    const workletNode = new AudioWorkletNode(context, 'audio-processor');

    source.connect(workletNode);
    workletNode.connect(context.destination);

    return {
      context,
      source,
      workletNode,
      stream,
      isActive: true
    };
  } catch (error) {
    console.error('Error setting up system audio processor:', error);
    return null;
  }
};

export const setupSpeechRecognition = (
  onStart: () => void,
  onResult: (transcript: string) => void,
  onError: (error: string) => void,
  onEnd: () => void
): SystemRecognitionResult => {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    onError('Speech recognition not supported in this browser.');
    throw new Error('Speech recognition not supported');
  }

  const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
  let audioProcessor: SystemAudioProcessor | null = null;
  let silenceTimeout: NodeJS.Timeout | null = null;
  let retryCount = 0;
  const MAX_RETRIES = 3;

  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  const cleanup = () => {
    if (silenceTimeout) {
      clearTimeout(silenceTimeout);
      silenceTimeout = null;
    }
    if (audioProcessor) {
      audioProcessor.workletNode.disconnect();
      audioProcessor.source.disconnect();
      audioProcessor.context.close();
      audioProcessor.stream.getTracks().forEach(track => track.stop());
      audioProcessor = null;
    }
    try {
      recognition.stop();
    } catch (error) {
      console.error('Error stopping recognition:', error);
    }
  };

  const initializeAudioCapture = async (): Promise<void> => {
    try {
      if (retryCount >= MAX_RETRIES) {
        throw new Error('Maximum retry attempts reached');
      }

      audioProcessor = await setupSystemAudioProcessor();
      if (!audioProcessor) {
        throw new Error('Failed to initialize system audio processor');
      }

      audioProcessor.workletNode.port.onmessage = (event: MessageEvent) => {
        const data = event.data;
        if (data.type === 'buffer') {
          const buffer = data.buffer;
          const sum = Array.from(buffer).reduce((acc, val) => acc + Math.abs(val), 0);
          const average = sum / buffer.length;

          if (average > 0.01) {
            if (!recognition.continuous) {
              recognition.continuous = true;
              try {
                recognition.start();
              } catch (error) {
                console.error('Error starting recognition:', error);
              }
            }
            if (silenceTimeout) {
              clearTimeout(silenceTimeout);
              silenceTimeout = null;
            }
          } else if (recognition.continuous && !silenceTimeout) {
            silenceTimeout = setTimeout(() => {
              recognition.continuous = false;
              try {
                recognition.stop();
              } catch (error) {
                console.error('Error stopping recognition:', error);
              }
            }, 1500);
          }
        }
      };
    } catch (error) {
      console.error('Error in audio capture:', error);
      cleanup();
      retryCount++;

      if (retryCount < MAX_RETRIES) {
        setTimeout(() => initializeAudioCapture(), 1000 * retryCount);
      } else {
        onError('Failed to initialize system audio capture after multiple attempts.');
      }
    }
  };

  // Initialize audio capture
  void initializeAudioCapture();

  recognition.onstart = () => {
    console.log('Speech recognition started');
    onStart();
  };

  recognition.onresult = (event: any) => {
    const transcript = Array.from(event.results)
      .map((result: any) => result[0])
      .map((result: any) => result.transcript)
      .join(' ');
    console.log('Transcript:', transcript);
    onResult(transcript);
  };

  recognition.onerror = (event: any) => {
    let errorMessage = 'An error occurred. ';
    switch (event.error) {
      case 'network':
        errorMessage += 'Network error. Please check your internet connection.';
        break;
      case 'not-allowed':
        errorMessage += 'System audio access denied. Please check your system audio settings.';
        break;
      case 'no-speech':
        return; // Don't show error for no speech
      default:
        errorMessage += `Error: ${event.error}. Please try again.`;
    }
    console.error('Recognition error:', errorMessage);
    onError(errorMessage);
  };

  recognition.onend = () => {
    console.log('Speech recognition ended');
    onEnd();
  };

  return { recognition, cleanup, audioProcessor };
};
