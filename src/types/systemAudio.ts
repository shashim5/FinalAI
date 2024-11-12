import { AudioConfig, AudioProcessor, AudioMessage } from './audio';
import { RecognitionResult } from './recognition';

// System audio capture types
export interface SystemAudioConfig extends AudioConfig {
  deviceId?: string;
}

export interface SystemAudioProcessor extends AudioProcessor {
  isActive: boolean;
}

export interface SystemRecognitionResult extends RecognitionResult {
  audioProcessor: SystemAudioProcessor | null;
}

export interface SystemAudioMessage extends AudioMessage {
  source: 'system';
}

export type { AudioConfig, AudioProcessor, AudioMessage };
