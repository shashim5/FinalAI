import { audioCaptureService } from './audioCapture';
import { SpeechRecognitionInstance, SpeechRecognitionEvent, SpeechRecognitionError } from '../types';

export class TranscriptionService {
  private recognition: SpeechRecognitionInstance | null = null;
  private isTranscribing: boolean = false;

  constructor() {
    if ('webkitSpeechRecognition' in window) {
      this.recognition = new window.webkitSpeechRecognition();
      this.setupRecognition();
    } else {
      throw new Error('Speech recognition not supported in this browser');
    }
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
      
      console.log('Transcribed text:', transcript.trim());
      // Emit transcript or handle it as needed
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

export const transcriptionService = new TranscriptionService();
