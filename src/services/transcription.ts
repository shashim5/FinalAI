import { AudioCaptureService } from './audioCapture';
import { SpeechRecognitionInstance, SpeechRecognitionEvent, SpeechRecognitionError } from '../types';

const audioCaptureService = new AudioCaptureService();

type TranscriptionCallback = (transcript: string) => void;

export class TranscriptionService {
  private recognition: SpeechRecognitionInstance | null = null;
  private isTranscribing: boolean = false;
  private transcriptionCallbacks: TranscriptionCallback[] = [];
  private currentTranscript: string = '';

  public getCurrentTranscript(): string {
    return this.currentTranscript;
  }

  constructor() {
    if ('webkitSpeechRecognition' in window) {
      this.recognition = new window.webkitSpeechRecognition();
      this.setupRecognition();
    } else {
      throw new Error('Speech recognition not supported in this browser');
    }
  }

  public onTranscription(callback: TranscriptionCallback): void {
    this.transcriptionCallbacks.push(callback);
  }

  private emitTranscription(transcript: string): void {
    this.currentTranscript = transcript;
    this.transcriptionCallbacks.forEach(callback => callback(transcript));
  }

  private setupRecognition(): void {
    if (!this.recognition) return;

    this.recognition.continuous = true;
    this.recognition.interimResults = true;

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results.item(i);
        if (result && result[0]) {
          transcript += result[0].transcript + ' ';
        }
      }
      
      const trimmedTranscript = transcript.trim();
      console.log('Transcribed text:', trimmedTranscript);
      this.emitTranscription(trimmedTranscript);
    };

    this.recognition.onerror = (event: SpeechRecognitionError) => {
      console.error('Transcription error:', event.error);
      if (event.error === 'not-allowed') {
        console.error('Microphone access denied. Please allow microphone access.');
      }
    };
  }

  async startTranscription(): Promise<void> {
    if (this.isTranscribing) return;

    try {
      // Start screen share audio capture
      await audioCaptureService.startScreenShareAudioCapture();
      
      // Start speech recognition
      if (this.recognition) {
        this.recognition.start();
        this.isTranscribing = true;
        console.log('Transcription started');
      }
    } catch (error) {
      console.error('Error starting transcription:', error);
      audioCaptureService.stopCapture(); // Cleanup if recognition fails
      throw error;
    }
  }

  stopTranscription(): void {
    if (!this.isTranscribing) return;

    if (this.recognition) {
      this.recognition.stop();
    }
    
    audioCaptureService.stopCapture();
    this.isTranscribing = false;
    console.log('Transcription stopped');
  }
}

// Service instance is exported from index.ts
