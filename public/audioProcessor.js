class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.isProcessing = true;

    // Handle messages from the main thread
    this.port.onmessage = (event) => {
      if (event.data.type === 'STOP') {
        this.isProcessing = false;
      }
    };
  }

  process(inputs, outputs) {
    // Skip processing if no input is available
    if (inputs.length === 0 || inputs[0].length === 0) {
      return this.isProcessing;
    }

    const input = inputs[0];
    const output = outputs[0];

    // Process each channel
    for (let channel = 0; channel < input.length; ++channel) {
      const inputChannel = input[channel];
      const outputChannel = output[channel];

      // Copy input samples to output
      for (let i = 0; i < inputChannel.length; ++i) {
        outputChannel[i] = inputChannel[i];
      }
    }

    // Continue processing
    return this.isProcessing;
  }
}

registerProcessor('audio-processor', AudioProcessor);
