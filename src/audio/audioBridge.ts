import { AudioCaptureError } from './types';

export class AudioBridge {
  private mediaRecorder: MediaRecorder | null = null;
  private recognition: any = null;
  private onTranscriptCallback: ((transcript: string, isFinal: boolean) => void) | null = null;
  private onErrorCallback: ((error: Error) => void) | null = null;

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

  async connectStream(stream: MediaStream): Promise<void> {
    if (!this.recognition) {
      throw new AudioCaptureError('Speech recognition not supported');
    }

    try {
      // Create a new audio context
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);

      // Create and connect audio worklet
      await audioContext.audioWorklet.addModule('/audioProcessor.js');
      const workletNode = new AudioWorkletNode(audioContext, 'audio-processor');
      source.connect(workletNode).connect(audioContext.destination);

      // Connect the stream to the recognition
      this.recognition.audioStream = stream;

      // Create a media recorder for backup
      this.mediaRecorder = new MediaRecorder(stream);

      // Start recognition
      this.recognition.start();
    } catch (error) {
      throw new AudioCaptureError('Failed to connect audio stream', error as Error);
    }
  }

  onTranscript(callback: (transcript: string, isFinal: boolean) => void): void {
    this.onTranscriptCallback = callback;
  }

  onError(callback: (error: Error) => void): void {
    this.onErrorCallback = callback;
  }

  stop(): void {
    if (this.recognition) {
      this.recognition.stop();
    }
    if (this.mediaRecorder) {
      this.mediaRecorder.stop();
    }
  }

  isSupported(): boolean {
    return 'webkitSpeechRecognition' in window;
  }
}
