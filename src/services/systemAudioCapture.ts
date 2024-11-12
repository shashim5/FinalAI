import {
    AudioProcessor,
    AudioNodes,
    VoiceDetectionConfig,
    AudioProcessingResult,
    WorkletProcessorOptions
} from '../types/audio';
import {
    SpeechRecognition,
    SpeechRecognitionEvent,
    SpeechRecognitionErrorEvent
} from '../types/speech';
import { SystemAudioConfig } from '../types/systemAudio';

const DEFAULT_CONFIG: SystemAudioConfig = {
    sampleRate: 48000,
    fftSize: 4096,
    smoothingTimeConstant: 0.85,
    minDecibels: -90,
    maxDecibels: -10,
    noiseThreshold: -55,
    voiceThreshold: -45,
    bandpassLow: 85,
    bandpassHigh: 4000,
    agcTarget: -18,
    agcMaxGain: 12,
    autoGainControl: true,
    echoCancellation: true,
    noiseSuppression: true
};

export class SystemAudioCapture {
    private audioContext: AudioContext | null = null;
    private audioProcessor: AudioProcessor | null = null;
    private recognition: SpeechRecognition | null = null;
    private isCapturing: boolean = false;
    private energyHistory: number[] = [];
    private onTranscriptUpdate: (transcript: string, confidence: number) => void;
    private onStatusUpdate: (status: string) => void;
    private lastTranscript: string = '';
    private confidenceThreshold: number = 0.8;
    private config: SystemAudioConfig;

    constructor(
        onTranscriptUpdate: (transcript: string, confidence: number) => void,
        onStatusUpdate: (status: string) => void,
        config: Partial<SystemAudioConfig> = {}
    ) {
        this.onTranscriptUpdate = onTranscriptUpdate;
        this.onStatusUpdate = onStatusUpdate;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    private async setupSystemAudioCapture(): Promise<MediaStream> {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: false,
                audio: {
                    echoCancellation: this.config.echoCancellation,
                    noiseSuppression: this.config.noiseSuppression,
                    autoGainControl: this.config.autoGainControl,
                    channelCount: 1,
                    sampleRate: this.config.sampleRate
                }
            });

            const audioTrack = stream.getAudioTracks()[0];
            if (!audioTrack) {
                throw new Error('No audio track available');
            }

            const capabilities = audioTrack.getCapabilities();
            if (capabilities.sampleRate) {
                await audioTrack.applyConstraints({
                    sampleRate: { ideal: this.config.sampleRate }
                });
            }

            return stream;
        } catch (error) {
            console.error('Error capturing system audio:', error);
            throw error;
        }
    }

    private async createAudioProcessor(audioContext: AudioContext, source: MediaStreamAudioSourceNode): Promise<AudioProcessor> {
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = this.config.fftSize;
        analyser.smoothingTimeConstant = this.config.smoothingTimeConstant;
        analyser.minDecibels = this.config.minDecibels;
        analyser.maxDecibels = this.config.maxDecibels;

        const compressor = audioContext.createDynamicsCompressor();
        compressor.threshold.value = -50;
        compressor.knee.value = 30;
        compressor.ratio.value = 12;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.25;

        const gainNode = audioContext.createGain();
        gainNode.gain.value = 1.5;

        const highPassFilter = audioContext.createBiquadFilter();
        highPassFilter.type = 'highpass';
        highPassFilter.frequency.value = this.config.bandpassLow;
        highPassFilter.Q.value = 0.7;

        const bandpassFilter = audioContext.createBiquadFilter();
        bandpassFilter.type = 'bandpass';
        bandpassFilter.frequency.value = 1000;
        bandpassFilter.Q.value = 0.5;

        await audioContext.audioWorklet.addModule('/audioWorklet.js');
        const workletNode = new AudioWorkletNode(audioContext, 'audio-processor', {
            processorOptions: {
                sampleRate: this.config.sampleRate,
                fftSize: this.config.fftSize,
                noiseThreshold: this.config.noiseThreshold,
                voiceThreshold: this.config.voiceThreshold,
                smoothingTimeConstant: this.config.smoothingTimeConstant,
                preEmphasis: 0.97,
                agcTarget: this.config.agcTarget,
                agcMaxGain: this.config.agcMaxGain,
                bandpassLow: this.config.bandpassLow,
                bandpassHigh: this.config.bandpassHigh
            }
        });

        workletNode.port.onmessage = (event) => {
            if (event.data.type === 'buffer' && event.data.isVoiceActive) {
                const buffer = event.data.buffer;
                if (buffer && buffer.length > 0) {
                    const energy = buffer.reduce((sum, val) => sum + val * val, 0) / buffer.length;
                    this.energyHistory.push(energy);
                    if (this.energyHistory.length > 50) {
                        this.energyHistory.shift();
                    }
                }
            }
        };

        source.connect(highPassFilter);
        highPassFilter.connect(bandpassFilter);
        bandpassFilter.connect(compressor);
        compressor.connect(workletNode);
        workletNode.connect(gainNode);
        gainNode.connect(analyser);
        analyser.connect(audioContext.destination);

        return {
            context: audioContext,
            source,
            nodes: {
                analyser,
                compressor,
                gainNode,
                highPassFilter,
                workletNode
            },
            stream: source.mediaStream,
            cleanup: () => {
                source.disconnect();
                highPassFilter.disconnect();
                bandpassFilter.disconnect();
                compressor.disconnect();
                workletNode.disconnect();
                gainNode.disconnect();
                analyser.disconnect();
            }
        };
    }

    private setupSpeechRecognition(): SpeechRecognition {
        const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognitionImpl();

        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 3;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            this.onStatusUpdate('Listening...');
        };

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            let finalTranscript = '';
            let interimTranscript = '';
            let maxConfidence = 0;

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                const result = event.results[i];
                let bestAlternative = result[0];

                for (let j = 1; j < result.length; j++) {
                    if (result[j].confidence > bestAlternative.confidence) {
                        bestAlternative = result[j];
                    }
                }

                if (bestAlternative.confidence >= this.confidenceThreshold) {
                    if (result.isFinal) {
                        finalTranscript += bestAlternative.transcript + ' ';
                        maxConfidence = Math.max(maxConfidence, bestAlternative.confidence);
                    } else {
                        interimTranscript += bestAlternative.transcript;
                    }
                }
            }

            const fullTranscript = finalTranscript + interimTranscript;
            if (fullTranscript !== this.lastTranscript) {
                this.lastTranscript = fullTranscript;
                this.onTranscriptUpdate(fullTranscript, maxConfidence);
            }
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            console.error('Recognition error:', event.error);
            this.onStatusUpdate(`Error: ${event.error}`);

            if (this.isCapturing) {
                setTimeout(() => {
                    if (this.isCapturing && this.recognition) {
                        this.recognition.start();
                    }
                }, 1000);
            }
        };

        recognition.onend = () => {
            if (this.isCapturing && this.recognition) {
                this.recognition.start();
            } else {
                this.onStatusUpdate('Stopped');
            }
        };

        return recognition;
    }

    public async start(): Promise<void> {
        try {
            this.isCapturing = true;
            this.onStatusUpdate('Starting...');

            this.audioContext = new AudioContext({
                latencyHint: 'interactive',
                sampleRate: this.config.sampleRate
            });

            const audioStream = await this.setupSystemAudioCapture();
            const source = this.audioContext.createMediaStreamSource(audioStream);
            this.audioProcessor = await this.createAudioProcessor(this.audioContext, source);

            this.recognition = this.setupSpeechRecognition();
            this.recognition.start();

        } catch (error) {
            console.error('Error starting capture:', error);
            this.onStatusUpdate(`Error: ${(error as Error).message}`);
            this.stop();
            throw error;
        }
    }

    public stop(): void {
        this.isCapturing = false;
        if (this.recognition) {
            this.recognition.stop();
        }
        if (this.audioProcessor) {
            this.audioProcessor.cleanup();
        }
        if (this.audioContext) {
            this.audioContext.close();
        }
        this.onStatusUpdate('Stopped');
    }

    public isActive(): boolean {
        return this.isCapturing;
    }
}
