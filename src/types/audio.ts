// Basic audio types
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

export interface AudioMessage {
  type: 'buffer';
  buffer: Float32Array;
}
