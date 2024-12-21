import { AudioCaptureError } from './types';

export class SystemAudioCapture {
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private mediaStream: MediaStream | null = null;

  async initialize(): Promise<void> {
    try {
      // Check browser compatibility
      if (!window.AudioContext && !(window as any).webkitAudioContext) {
        throw new AudioCaptureError('Your browser does not support AudioContext. Please use a modern browser like Chrome.');
      }

      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

      // Check for AudioWorklet support
      if (!this.audioContext.audioWorklet) {
        throw new AudioCaptureError('Your browser does not support AudioWorklet. Please use Chrome version 66 or later.');
      }

      try {
        await this.audioContext.audioWorklet.addModule('/audioProcessor.js');
      } catch (error) {
        throw new AudioCaptureError('Failed to load audio processor. Please check your internet connection.', error as Error);
      }

      this.workletNode = new AudioWorkletNode(this.audioContext, 'audio-processor');
    } catch (error) {
      if (error instanceof AudioCaptureError) {
        throw error;
      }
      throw new AudioCaptureError('Failed to initialize audio system. Please refresh and try again.', error as Error);
    }
  }

  async startCapture(): Promise<void> {
    if (!this.audioContext || !this.workletNode) {
      throw new AudioCaptureError('Audio system not initialized. Please refresh the page and try again.');
    }

    try {
      // Check if getDisplayMedia is supported
      if (!navigator.mediaDevices?.getDisplayMedia) {
        throw new AudioCaptureError('System audio capture is not supported in your browser. Please use Chrome.');
      }

      // Request system audio capture through screen sharing
      this.mediaStream = await navigator.mediaDevices.getDisplayMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        },
        video: {
          displaySurface: 'browser',
          width: { ideal: 640 },
          height: { ideal: 360 }
        }
      });

      // Check if we got an audio track
      if (!this.mediaStream.getAudioTracks().length) {
        throw new AudioCaptureError('No audio track available. Please enable system audio sharing when prompted.');
      }

      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      source.connect(this.workletNode);
      this.workletNode.connect(this.audioContext.destination);
    } catch (error) {
      // Handle user cancellation separately
      if ((error as Error).name === 'NotAllowedError') {
        throw new AudioCaptureError('Permission denied. Please allow system audio sharing when prompted.');
      }
      throw new AudioCaptureError(
        'Failed to capture system audio. Please ensure you enable system audio sharing when prompted.',
        error as Error
      );
    }
  }

  async stopCapture(): Promise<void> {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }

    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }
  }

  isInitialized(): boolean {
    return this.audioContext !== null && this.workletNode !== null;
  }

  isCapturing(): boolean {
    return this.mediaStream !== null && this.mediaStream.active;
  }
}
