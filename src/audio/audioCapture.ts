import { AudioCaptureError } from './types';

export class SystemAudioCapture {
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private mediaStream: MediaStream | null = null;

  async initialize(): Promise<void> {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      await this.audioContext.audioWorklet.addModule('/audioProcessor.js');
      this.workletNode = new AudioWorkletNode(this.audioContext, 'audio-processor');
    } catch (error) {
      throw new AudioCaptureError('Failed to initialize audio system', error as Error);
    }
  }

  async startCapture(): Promise<void> {
    if (!this.audioContext || !this.workletNode) {
      throw new AudioCaptureError('Audio system not initialized');
    }

    try {
      // Use getDisplayMedia for system audio capture
      this.mediaStream = await navigator.mediaDevices.getDisplayMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        },
        video: false
      });

      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      source.connect(this.workletNode);
      this.workletNode.connect(this.audioContext.destination);
    } catch (error) {
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
