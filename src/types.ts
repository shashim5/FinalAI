// Type definitions for Web Speech API

// Define the session interface
export interface Session {
  id: string;
  question: string;
  response: string;
  isListening: boolean;
  transcript: string;
}

// Define the speech recognition result interface
export interface SpeechRecognitionResult {
  transcript: string;
  confidence: number;
}

// Define the speech recognition event interface
export interface SpeechRecognitionEvent {
  results: {
    [index: number]: {
      [index: number]: SpeechRecognitionResult;
    };
    length: number;
    item(index: number): {
      [index: number]: SpeechRecognitionResult;
    };
  };
  resultIndex: number;
}

// Define error event interface
export interface SpeechRecognitionError {
  error: 'no-speech' | 'aborted' | 'audio-capture' | 'network' | 'not-allowed' | 'service-not-allowed' | 'bad-grammar' | 'language-not-supported';
  message?: string;
}

// Define the speech recognition interface
export interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (event: Event) => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionError) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

// Media Stream types
export interface MediaTrackConstraints {
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  sampleRate?: number;
}

export interface MediaStreamConstraints {
  video?: boolean | MediaTrackConstraints;
  audio?: boolean | MediaTrackConstraints;
}

export interface BlobEvent extends Event {
  data: Blob;
}

// Extend Window interface
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
  }
}
