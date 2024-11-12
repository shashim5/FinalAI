import { RecognitionResult } from './recognition';
import {
    AudioProcessor,
    AudioNodes,
    VoiceDetectionConfig,
    AudioProcessingResult
} from './audio';

// System audio capture types
export interface SystemAudioConfig {
    // Core audio settings from AudioConfig
    sampleRate: number;
    fftSize: number;
    smoothingTimeConstant: number;
    minDecibels: number;
    maxDecibels: number;
    noiseThreshold: number;
    voiceThreshold: number;
    bandpassLow: number;
    bandpassHigh: number;
    agcTarget: number;
    agcMaxGain: number;

    // Additional system-specific settings
    deviceId?: string;
    autoGainControl?: boolean;
    echoCancellation?: boolean;
    noiseSuppression?: boolean;
}

export interface SystemAudioProcessor extends AudioProcessor {
    isActive: boolean;
    nodes: AudioNodes;
    voiceDetection: {
        config: VoiceDetectionConfig;
        process: () => AudioProcessingResult;
    };
}

export interface SystemRecognitionResult extends RecognitionResult {
    audioProcessor: SystemAudioProcessor | null;
    confidence: number;
    isFinal: boolean;
}

// Helper type for audio processing options
export interface AudioProcessingOptions {
    noiseReduction: boolean;
    autoGainControl: boolean;
    voiceActivityDetection: boolean;
    preEmphasis: boolean;
}

// Audio processing configuration
export interface ProcessingConfig {
    options: AudioProcessingOptions;
    thresholds: {
        noise: number;
        voice: number;
        confidence: number;
    };
    filters: {
        preEmphasis: number;
        bandpassLow: number;
        bandpassHigh: number;
    };
}
