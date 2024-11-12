// audioWorklet.js - Audio processing worklet
class AudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this._bufferSize = 4096;
        this._buffer = new Float32Array(this._bufferSize);
        this._bytesWritten = 0;
    }

    process(inputs, outputs, parameters) {
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
