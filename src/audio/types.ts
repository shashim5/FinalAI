export class AudioCaptureError extends Error {
  constructor(message: string, public readonly originalError?: Error) {
    super(message);
    this.name = 'AudioCaptureError';
  }
}

export interface AudioCaptureStatus {
  isInitialized: boolean;
  isCapturing: boolean;
  error?: string;
}

declare global {
  interface Window {
    chrome?: {
      runtime?: {
        id?: string;
        sendMessage?: (message: any, callback?: (response: any) => void) => void;
        lastError?: { message: string };
      };
      tabCapture?: {
        capture: (options: {
          audio: boolean;
          video: boolean;
          audioConstraints?: {
            mandatory: {
              chromeMediaSource: string;
              echoCancellation?: boolean;
              noiseSuppression?: boolean;
              autoGainControl?: boolean;
            };
          };
        }, callback: (stream: MediaStream | null) => void) => void;
      };
    };
  }

  interface MediaTrackConstraintSet {
    echoCancellation?: ConstrainBoolean;
    noiseSuppression?: ConstrainBoolean;
    autoGainControl?: ConstrainBoolean;
  }
}
