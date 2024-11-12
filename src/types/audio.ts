// Audio types for the application
export interface AudioConfig {
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
  channelCount?: number;
  sampleRate?: number;
}

export interface AudioProcessor {
  context: AudioContext;
  source: MediaStreamAudioSourceNode;
  workletNode: AudioWorkletNode;
  stream: MediaStream;
}

export interface RecognitionResult {
  recognition: any; // SpeechRecognition type is not available in TypeScript by default
  cleanup: () => void;
}

export interface AudioMessage {
  type: 'buffer';
  buffer: Float32Array;
}

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}
