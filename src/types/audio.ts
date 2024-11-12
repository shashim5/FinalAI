// Basic audio types
export interface FrequencyBand {
    start: number;
    end: number;
}

export interface AudioConfig {
    // Core audio processing parameters
    sampleRate: number;
    fftSize: number;
    smoothingTimeConstant: number;
    minDecibels: number;
    maxDecibels: number;

    // Voice detection parameters
    noiseThreshold: number;
    voiceThreshold: number;
    bandpassLow: number;
    bandpassHigh: number;

    // Automatic gain control
    agcTarget: number;
    agcMaxGain: number;
}

export interface AudioProcessingOptions {
    noiseReduction: boolean;
    autoGainControl: boolean;
    voiceActivityDetection: boolean;
    preEmphasis: boolean;
}

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

export interface AudioNodes {
    analyser: AnalyserNode;
    compressor: DynamicsCompressorNode;
    gainNode: GainNode;
    highPassFilter: BiquadFilterNode;
    workletNode?: AudioWorkletNode;
}

export interface AudioProcessor {
    context: AudioContext;
    source: MediaStreamAudioSourceNode;
    nodes: AudioNodes;
    stream: MediaStream;
    cleanup: () => void;
}

export interface VoiceDetectionConfig {
    bands: FrequencyBand[];
    weights: number[];
    historySize: number;
    minEnergy: number;
    adaptiveThreshold: boolean;
    smoothing: number;
}

export interface AudioProcessingResult {
    isVoiceDetected: boolean;
    energy: number;
    timestamp: number;
    confidence: number;
    noiseLevel: number;
}

// Audio worklet types
export interface WorkletProcessorOptions extends AudioWorkletNodeOptions {
    processorOptions: {
        sampleRate: number;
        fftSize: number;
        processingConfig: ProcessingConfig;
    };
}

export interface ProcessorMessage {
    type: 'config' | 'data' | 'error' | 'voiceActivity';
    payload: {
        buffer?: Float32Array;
        isVoiceActive?: boolean;
        energy?: number;
        error?: string;
        config?: ProcessingConfig;
    };
}
