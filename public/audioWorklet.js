class AudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this._bufferSize = 2048;
        this._buffer = new Float32Array(this._bufferSize);
        this._bytesWritten = 0;

        this._energyThreshold = -45;
        this._vadHistory = new Array(15).fill(0);
        this._vadIndex = 0;
        this._smoothingFactor = 0.85;
        this._vadConfidence = 0;
        this._minVoiceFrames = 3;
        this._consecutiveVoiceFrames = 0;

        this._noiseFloor = -60;
        this._noiseEstimate = new Float32Array(128).fill(-60);
        this._prevSample = 0;
        this._preEmphasis = 0.97;
        this._noiseReductionFactor = 0.98;

        this._threshold = -50;
        this._ratio = 4;
        this._knee = 10;
        this._attack = 0.003;
        this._release = 0.25;
        this._prevGain = 1.0;
    }

    processCompression(sample, time) {
        const inputDb = 20 * Math.log10(Math.abs(sample) + 1e-6);
        const slope = this._ratio - 1;
        let gainDb = 0;

        if (inputDb <= this._threshold - this._knee / 2) {
            gainDb = 0;
        } else if (inputDb > this._threshold + this._knee / 2) {
            gainDb = -(slope) * (inputDb - this._threshold);
        } else {
            const t = inputDb - (this._threshold - this._knee / 2);
            gainDb = -slope * Math.pow(t, 2) / (2 * this._knee);
        }

        const gainLinear = Math.pow(10, gainDb / 20);
        const timeConstant = gainLinear > this._prevGain ? this._attack : this._release;
        this._prevGain = this._prevGain + (gainLinear - this._prevGain) * (1 - Math.exp(-time / timeConstant));

        return sample * this._prevGain;
    }

    detectVoiceActivity(frame) {
        let energy = 0;
        const sampleRate = 48000;
        for (let i = 0; i < frame.length; i++) {
            const freq = (i * sampleRate) / frame.length;
            let weight = 1.0;
            if (freq >= 85 && freq <= 4000) {
                weight = 1.5;
            }
            energy += frame[i] * frame[i] * weight;
        }
        energy = 10 * Math.log10(energy / frame.length + 1e-6);

        this._vadHistory[this._vadIndex] = energy;
        this._vadIndex = (this._vadIndex + 1) % this._vadHistory.length;

        const sortedEnergies = [...this._vadHistory].sort((a, b) => a - b);
        const noiseLevel = sortedEnergies[Math.floor(sortedEnergies.length * 0.1)];
        this._noiseFloor = this._noiseFloor * this._smoothingFactor + noiseLevel * (1 - this._smoothingFactor);

        const threshold = this._noiseFloor + this._energyThreshold;
        const isActive = energy > threshold;

        if (isActive) {
            this._consecutiveVoiceFrames++;
        } else {
            this._consecutiveVoiceFrames = Math.max(0, this._consecutiveVoiceFrames - 1);
        }

        this._vadConfidence = Math.min(1.0, this._consecutiveVoiceFrames / this._minVoiceFrames);

        return {
            isVoiceActive: this._consecutiveVoiceFrames >= this._minVoiceFrames,
            confidence: this._vadConfidence,
            energy: energy,
            noiseFloor: this._noiseFloor
        };
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        const output = outputs[0];

        if (!input || !input[0] || !output || !output[0]) return true;

        const inputChannel = input[0];
        const outputChannel = output[0];
        const processedBuffer = new Float32Array(inputChannel.length);

        for (let i = 0; i < inputChannel.length; i++) {
            let sample = inputChannel[i];
            sample = sample - this._preEmphasis * this._prevSample;
            this._prevSample = inputChannel[i];

            const magnitude = Math.abs(sample);
            const noiseLevel = this._noiseEstimate[i % this._noiseEstimate.length];

            if (magnitude < Math.pow(10, noiseLevel / 20)) {
                this._noiseEstimate[i % this._noiseEstimate.length] =
                    this._noiseEstimate[i % this._noiseEstimate.length] * this._noiseReductionFactor +
                    (20 * Math.log10(magnitude + 1e-6)) * (1 - this._noiseReductionFactor);
            }

            const cleanMagnitude = Math.max(0, magnitude - Math.pow(10, noiseLevel / 20));
            sample = sample * (cleanMagnitude / (magnitude + 1e-6));

            sample = this.processCompression(sample, i / 48000);
            processedBuffer[i] = sample;
        }

        const vadResult = this.detectVoiceActivity(processedBuffer);

        for (let i = 0; i < processedBuffer.length; i++) {
            this._buffer[this._bytesWritten] = vadResult.isVoiceActive ?
                processedBuffer[i] * vadResult.confidence : 0;
            this._bytesWritten++;

            if (this._bytesWritten >= this._bufferSize) {
                this.port.postMessage({
                    type: 'buffer',
                    buffer: this._buffer.slice(0),
                    isVoiceActive: vadResult.isVoiceActive,
                    confidence: vadResult.confidence,
                    energy: vadResult.energy,
                    noiseFloor: vadResult.noiseFloor
                });
                this._bytesWritten = 0;
            }
        }

        for (let i = 0; i < processedBuffer.length; i++) {
            outputChannel[i] = processedBuffer[i];
        }

        return true;
    }
}

registerProcessor('audio-processor', AudioProcessor);

registerProcessor('audio-processor', AudioProcessor);
            // Pre-emphasis filter
            let sample = inputChannel[i];
            sample = sample - this._preEmphasis * this._prevSample;
            this._prevSample = inputChannel[i];

            // Adaptive noise reduction
            const magnitude = Math.abs(sample);
            const noiseLevel = this._noiseEstimate[i % this._noiseEstimate.length];

            // Update noise estimate during silence
            if (magnitude < Math.pow(10, noiseLevel / 20)) {
                this._noiseEstimate[i % this._noiseEstimate.length] =
                    this._noiseEstimate[i % this._noiseEstimate.length] * this._noiseReductionFactor +
                    (20 * Math.log10(magnitude + 1e-6)) * (1 - this._noiseReductionFactor);
            }

            // Apply noise reduction
            const cleanMagnitude = Math.max(0, magnitude - Math.pow(10, noiseLevel / 20));
            sample = sample * (cleanMagnitude / (magnitude + 1e-6));

            // Dynamic range compression
            sample = this.processCompression(sample, i / sampleRate);
            processedBuffer[i] = sample;
        }

        // Enhanced voice activity detection
        const vadResult = this.detectVoiceActivity(processedBuffer);

        // Buffer processed audio with confidence-based gating
        for (let i = 0; i < processedBuffer.length; i++) {
            this._buffer[this._bytesWritten] = vadResult.isVoiceActive ?
                processedBuffer[i] * vadResult.confidence : 0;
            this._bytesWritten++;

            if (this._bytesWritten >= this._bufferSize) {
                this.port.postMessage({
                    type: 'buffer',
                    buffer: this._buffer.slice(0),
                    isVoiceActive: vadResult.isVoiceActive,
                    confidence: vadResult.confidence,
                    energy: vadResult.energy,
                    noiseFloor: vadResult.noiseFloor
                });
                this._bytesWritten = 0;
            }
        }

        // Copy processed audio to output
        for (let i = 0; i < processedBuffer.length; i++) {
            outputChannel[i] = processedBuffer[i];
        }

        return true;
    }
}

registerProcessor('audio-processor', AudioProcessor);
