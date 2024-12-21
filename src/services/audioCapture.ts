import { MediaStreamConstraints } from '../types';

export class AudioCaptureService {
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private audioData: Blob[] = [];

  async startScreenShareAudioCapture(): Promise<void> {
    try {
      // Request screen sharing with audio
      this.mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      } as MediaStreamConstraints);

      // Extract audio track from screen share
      const audioTrack = this.mediaStream.getAudioTracks()[0];
      if (!audioTrack) {
        throw new Error('No audio track available from screen share');
      }

      // Create new stream with only audio
      const audioStream = new MediaStream([audioTrack]);

      // Initialize audio context
      this.audioContext = new AudioContext();
      const source = this.audioContext.createMediaStreamSource(audioStream);
      const processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      // Connect audio nodes
      source.connect(processor);
      processor.connect(this.audioContext.destination);

      // Initialize MediaRecorder for the audio stream
      this.mediaRecorder = new MediaRecorder(audioStream);
      this.audioData = [];

      // Set up MediaRecorder event handlers
      this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          this.audioData.push(event.data);
        }
      };

      // Start recording
      this.mediaRecorder.start(100); // Collect data every 100ms

      console.log('Screen share audio capture started');
    } catch (error) {
      console.error('Error starting screen share audio capture:', error);
      throw error;
    }
  }

  stopCapture(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
    }

    if (this.audioContext) {
      this.audioContext.close();
    }

    this.mediaStream = null;
    this.mediaRecorder = null;
    this.audioContext = null;
    console.log('Screen share audio capture stopped');
  }

  getAudioData(): Blob[] {
    return this.audioData;
  }

  clearAudioData(): void {
    this.audioData = [];
  }
}

export const audioCaptureService = new AudioCaptureService();
