import { GoogleGenerativeAI } from '@google/generative-ai';
import { SystemAudioConfig, SystemAudioProcessor, SystemRecognitionResult } from '../types/systemAudio';
import '../types/speech';

const API_KEY = 'AIzaSyDfbugjoSRGIb40hn4JoxT8kLL39tIzCzM';
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

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

interface DisplayMediaStreamOptions {
  video: {
    displaySurface: string;
    width: { ideal: number };
    height: { ideal: number };
  };
  audio: {
    echoCancellation: boolean;
    noiseSuppression: boolean;
    autoGainControl: boolean;
  };
}

declare global {
  interface Navigator {
    mediaDevices: {
      getDisplayMedia(constraints?: DisplayMediaStreamOptions): Promise<MediaStream>;
    };
  }
}

export const setupSystemAudioCapture = async (): Promise<MediaStream | null> => {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        displaySurface: 'browser',
        width: { ideal: 1 },
        height: { ideal: 1 }
      },
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    });

    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) {
      throw new Error('No audio track available');
    }

    const audioStream = new MediaStream([audioTrack]);
    stream.getVideoTracks().forEach(track => track.stop());

    return audioStream;
  } catch (error) {
    console.error('Error capturing system audio:', error);
    return null;
  }
};

export const setupSpeechRecognition = async (
  onStart: () => void,
  onResult: (transcript: string) => void,
  onError: (error: string) => void,
  onEnd: () => void
): Promise<SystemRecognitionResult> => {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    onError('Speech recognition not supported in this browser.');
    throw new Error('Speech recognition not supported');
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  let audioStream: MediaStream | null = null;
  let audioContext: AudioContext | null = null;
  let source: MediaStreamAudioSourceNode | null = null;

  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  const cleanup = () => {
    if (audioStream) {
      audioStream.getTracks().forEach(track => track.stop());
      audioStream = null;
    }
    if (source) {
      source.disconnect();
      source = null;
    }
    if (audioContext) {
      audioContext.close();
      audioContext = null;
    }
    try {
      recognition.stop();
    } catch (error) {
      console.error('Error stopping recognition:', error);
    }
  };

  try {
    audioStream = await setupSystemAudioCapture();
    if (!audioStream) {
      throw new Error('Failed to capture system audio');
    }

    audioContext = new AudioContext();
    source = audioContext.createMediaStreamSource(audioStream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);

    source.connect(processor);
    processor.connect(audioContext.destination);

    processor.onaudioprocess = (e: AudioProcessingEvent) => {
      const inputData = e.inputBuffer.getChannelData(0);
      const sum = Array.from(inputData).reduce((acc, val) => acc + Math.abs(val), 0);
      const average = sum / inputData.length;

      if (average > 0.01 && !recognition.continuous) {
        recognition.continuous = true;
        try {
          recognition.start();
        } catch (error) {
          console.error('Error starting recognition:', error);
        }
      }
    };

    recognition.onstart = () => {
      console.log('Speech recognition started');
      onStart();
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = Array.from(event.results)
        .map(result => result[0].transcript)
        .join(' ');
      console.log('Transcript:', transcript);
      onResult(transcript);
    };

    recognition.onerror = (event: SpeechRecognitionError) => {
      let errorMessage = 'An error occurred. ';
      switch (event.error) {
        case 'network':
          errorMessage += 'Network error. Please check your internet connection.';
          break;
        case 'not-allowed':
          errorMessage += 'System audio access denied. Please check your system audio settings.';
          break;
        case 'no-speech':
          return;
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

    return { recognition, cleanup, audioProcessor: null };
  } catch (error) {
    console.error('Error setting up speech recognition:', error);
    cleanup();
    throw error;
  }
};
