import { AudioCaptureError } from './types';

export class AudioBridge {
  private mediaRecorder: MediaRecorder | null = null;
  private recognition: any = null;
  private audioContext: AudioContext | null = null;
  private audioSource: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private onTranscriptCallback: ((transcript: string, isFinal: boolean) => void) | null = null;
  private onErrorCallback: ((error: Error) => void) | null = null;
  private onVolumeCallback: ((volume: number) => void) | null = null;

  constructor() {
    if ('webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      this.setupRecognition();
    }
  }

  private setupRecognition(): void {
    if (!this.recognition) return;

    this.recognition.continuous = true;
    this.recognition.interimResults = true;

    this.recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0].transcript)
        .join('');

      const isFinal = event.results[event.results.length - 1].isFinal;
      this.onTranscriptCallback?.(transcript, isFinal);
    };

    this.recognition.onerror = (event: any) => {
      this.onErrorCallback?.(new AudioCaptureError(`Speech recognition error: ${event.error}`));
    };
  }

  async connectMicrophone(): Promise<void> {
    if (!this.recognition) {
      throw new AudioCaptureError('Speech recognition not supported');
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });

      await this.connectStream(stream);
    } catch (error) {
      throw new AudioCaptureError('Failed to access microphone. Please ensure microphone permissions are granted.', error as Error);
    }
  }

  async connectStream(stream: MediaStream): Promise<void> {
    if (!this.recognition) {
      throw new AudioCaptureError('Speech recognition not supported');
    }

    try {
      // Check browser compatibility
      if (!window.AudioContext && !(window as any).webkitAudioContext) {
        throw new AudioCaptureError('AudioContext not supported in this browser');
      }

      // Initialize audio context if not already done
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      // Clean up any existing connections
      if (this.audioSource) {
        this.audioSource.disconnect();
      }
      if (this.analyser) {
        this.analyser.disconnect();
      }

      // Create and connect audio source
      this.audioSource = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;

      const processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      // Connect the audio processing pipeline
      this.audioSource.connect(this.analyser);
      this.analyser.connect(processor);
      processor.connect(this.audioContext.destination);

      // Set up media recorder for backup
      this.mediaRecorder = new MediaRecorder(stream);

      // Start recognition
      this.recognition.start();

      // Monitor audio volume
      const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      const checkVolume = () => {
        if (this.analyser) {
          this.analyser.getByteFrequencyData(dataArray);
          const volume = dataArray.reduce((acc, val) => acc + val, 0) / dataArray.length;
          this.onVolumeCallback?.(volume);
          if (this.isCapturing()) {
            requestAnimationFrame(checkVolume);
          }
        }
      };
      checkVolume();

      // Handle audio processing
      processor.onaudioprocess = () => {
        // Audio is already being processed through the analyser node
        // Additional processing can be added here if needed
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new AudioCaptureError(`Failed to connect audio stream: ${message}`, error as Error);
    }
  }

  onTranscript(callback: (transcript: string, isFinal: boolean) => void): void {
    this.onTranscriptCallback = callback;
  }

  onError(callback: (error: Error) => void): void {
    this.onErrorCallback = callback;
  }

  onVolume(callback: (volume: number) => void): void {
    this.onVolumeCallback = callback;
  }

  stop(): void {
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (error) {
        console.error('Error stopping recognition:', error);
      }
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch (error) {
        console.error('Error stopping media recorder:', error);
      }
    }

    if (this.audioSource) {
      this.audioSource.disconnect();
      this.audioSource = null;
    }

    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }

    if (this.audioContext) {
      this.audioContext.close().catch(error => {
        console.error('Error closing audio context:', error);
      });
      this.audioContext = null;
    }
  }

  isSupported(): boolean {
    return 'webkitSpeechRecognition' in window &&
           (window.AudioContext || (window as any).webkitAudioContext) !== undefined;
  }

  isCapturing(): boolean {
    return this.mediaRecorder !== null && this.mediaRecorder.state === 'recording';
  }
}
