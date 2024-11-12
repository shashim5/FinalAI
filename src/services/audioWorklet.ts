// audioWorklet.ts - Audio processing worklet
class AudioProcessor extends AudioWorkletProcessor {
  private _bufferSize: number;
  private _buffer: Float32Array;
  private _bytesWritten: number;

  constructor() {
    super();
    this._bufferSize = 4096;
    this._buffer = new Float32Array(this._bufferSize);
    this._bytesWritten = 0;
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const inputChannel = input[0];

    // Process audio data
    for (let i = 0; i < inputChannel.length; i++) {
      this._buffer[this._bytesWritten] = inputChannel[i];
      this._bytesWritten++;

      if (this._bytesWritten >= this._bufferSize) {
        // Send buffer to main thread for processing
        this.port.postMessage({
          type: 'buffer',
          buffer: this._buffer.slice(0)
        });
        this._bytesWritten = 0;
      }
    }

    return true;
  }
}

registerProcessor('audio-processor', AudioProcessor);

export {};
