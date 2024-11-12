import { GoogleGenerativeAI } from '@google/generative-ai';
import { SystemAudioConfig, SystemAudioProcessor, SystemRecognitionResult } from '../types/systemAudio';
import '../types/speech';

const API_KEY = 'AIzaSyDfbugjoSRGIb40hn4JoxT8kLL39tIzCzM';
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

const defaultSystemAudioConfig: SystemAudioConfig = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  channelCount: 2,
  sampleRate: 48000,
  fftSize: 2048,
  smoothingTimeConstant: 0.8,
  minDecibels: -90,
  maxDecibels: -10,
  noiseThreshold: -50,
  voiceThreshold: -40
};

export const generateAIResponse = async (text: string): Promise<string> => {
  try {
    const result = await model.generateContent(text);
    const response = result.response;
    return response.text();
  } catch (error) {
    console.error('Error generating AI response:', error);
    return 'Error generating response. Please try again.';
  }
};

interface DisplayMediaStreamOptions {
  video: {
    displaySurface: string;
    width: { ideal: number };
    height: { ideal: number };
  };
  audio: {
    echoCancellation: boolean;
    noiseSuppression: boolean;
    autoGainControl: boolean;
  };
}

declare global {
  interface Navigator {
    mediaDevices: {
      getDisplayMedia(constraints?: DisplayMediaStreamOptions): Promise<MediaStream>;
    };
  }
}

export const setupSystemAudioCapture = async (): Promise<MediaStream | null> => {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        displaySurface: 'browser',
        width: { ideal: 1 },
        height: { ideal: 1 }
      },
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    });

    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) {
      throw new Error('No audio track available');
    }

    const audioStream = new MediaStream([audioTrack]);
    stream.getVideoTracks().forEach(track => track.stop());

    return audioStream;
  } catch (error) {
    console.error('Error capturing system audio:', error);
    return null;
  }
};

export const setupSpeechRecognition = async (
  onStart: () => void,
  onResult: (transcript: string) => void,
  onError: (error: string) => void,
  onEnd: () => void
): Promise<SystemRecognitionResult> => {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    onError('Speech recognition not supported in this browser.');
    throw new Error('Speech recognition not supported');
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  let audioStream: MediaStream | null = null;
  let audioContext: AudioContext | null = null;
  let source: MediaStreamAudioSourceNode | null = null;

  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 3;
  recognition.lang = 'en-US';

  const cleanup = () => {
    if (audioStream) {
      audioStream.getTracks().forEach(track => track.stop());
      audioStream = null;
    }
    if (source) {
      source.disconnect();
      source = null;
    }
    if (audioContext) {
      audioContext.close();
      audioContext = null;
    }
    try {
      recognition.stop();
    } catch (error) {
      console.error('Error stopping recognition:', error);
    }
  };

  try {
    audioStream = await setupSystemAudioCapture();
    if (!audioStream) {
      throw new Error('Failed to capture system audio');
    }

    audioContext = new AudioContext({
      latencyHint: 'interactive',
      sampleRate: defaultSystemAudioConfig.sampleRate
    });
    source = audioContext.createMediaStreamSource(audioStream);

    // Create audio processing nodes
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = defaultSystemAudioConfig.fftSize;
    analyser.smoothingTimeConstant = defaultSystemAudioConfig.smoothingTimeConstant;
    analyser.minDecibels = defaultSystemAudioConfig.minDecibels;
    analyser.maxDecibels = defaultSystemAudioConfig.maxDecibels;

    const compressor = audioContext.createDynamicsCompressor();
    compressor.threshold.value = -50;
    compressor.knee.value = 40;
    compressor.ratio.value = 12;
    compressor.attack.value = 0;
    compressor.release.value = 0.25;

    const gainNode = audioContext.createGain();
    gainNode.gain.value = 1.5;

    const highPassFilter = audioContext.createBiquadFilter();
    highPassFilter.type = 'highpass';
    highPassFilter.frequency.value = 80;
    highPassFilter.Q.value = 0.7;

    // Connect audio processing chain
    source.connect(highPassFilter);
    highPassFilter.connect(compressor);
    compressor.connect(gainNode);
    gainNode.connect(analyser);
    analyser.connect(audioContext.destination);

    // Create buffer for frequency analysis
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);
    const energyHistory: number[] = [];

    // Improved voice activity detection with multi-band analysis
    const detectVoice = () => {
      analyser.getFloatFrequencyData(dataArray);

      // Calculate energy in different frequency bands
      const bands = [
        { start: 300, end: 1000 },   // Low speech frequencies
        { start: 1000, end: 2000 },  // Mid speech frequencies
        { start: 2000, end: 3400 }   // High speech frequencies
      ];
      const weights = [0.4, 0.4, 0.2]; // More weight on low and mid frequencies

      const bandEnergies = bands.map(band => {
        const startBin = Math.floor(band.start / (defaultSystemAudioConfig.sampleRate / defaultSystemAudioConfig.fftSize));
        const endBin = Math.floor(band.end / (defaultSystemAudioConfig.sampleRate / defaultSystemAudioConfig.fftSize));
        let sum = 0;
        let count = 0;

        for (let i = startBin; i < endBin; i++) {
          if (dataArray[i] > defaultSystemAudioConfig.noiseThreshold) {
            const magnitude = Math.pow(10, dataArray[i] / 20);
            sum += magnitude * magnitude;
            count++;
          }
        }

        return count > 0 ? sum / count : 0;
      });

      const weightedEnergy = bandEnergies.reduce((acc, energy, i) => acc + energy * weights[i], 0);

      energyHistory.push(weightedEnergy);
      if (energyHistory.length > 5) energyHistory.shift();

      const averageEnergy = energyHistory.reduce((a, b) => a + b, 0) / energyHistory.length;
      const dynamicThreshold = Math.pow(10, defaultSystemAudioConfig.voiceThreshold / 20) *
                              (1 + Math.log10(1 + averageEnergy));

      if (averageEnergy > dynamicThreshold && !recognition.continuous) {
        recognition.continuous = true;
        try {
          recognition.start();
        } catch (error) {
          console.error('Error starting recognition:', error);
        }
      }
    };

    const processInterval = setInterval(detectVoice, 50);

    recognition.onstart = () => {
      console.log('Speech recognition started');
      onStart();
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const results = Array.from(event.results);
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < results.length; ++i) {
        // Get the best alternative based on confidence
        let bestAlternative = results[i][0];
        for (let j = 1; j < results[i].length; j++) {
          if (results[i][j].confidence > bestAlternative.confidence) {
            bestAlternative = results[i][j];
          }
        }

        const transcript = bestAlternative.transcript;
        if (results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }

      console.log('Transcript:', finalTranscript + interimTranscript);
      onResult(finalTranscript + interimTranscript);
    };

    recognition.onerror = (event: SpeechRecognitionError) => {
      let errorMessage = 'An error occurred. ';
      switch (event.error) {
        case 'network':
          errorMessage += 'Network error. Please check your internet connection.';
          break;
        case 'not-allowed':
          errorMessage += 'System audio access denied. Please check your system audio settings.';
          break;
        case 'no-speech':
          return;
        default:
          errorMessage += `Error: ${event.error}. Please try again.`;
      }
      console.error('Recognition error:', errorMessage);
      onError(errorMessage);
    };

    recognition.onend = () => {
      console.log('Speech recognition ended');
      onEnd();
    };

    return { recognition, cleanup, audioProcessor: null };
  } catch (error) {
    console.error('Error setting up speech recognition:', error);
    cleanup();
    throw error;
  }
};
