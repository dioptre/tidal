import { Component } from 'react';
import { Platform } from 'react-native';
import { BasicPitch, addPitchBendsToNoteEvents, noteFramesToTime, outputToNotesPoly } from '@spotify/basic-pitch';

// Import Web Audio API polyfill for React Native
let AudioContext, OfflineAudioContext, AudioRecorder, RecorderAdapterNode, AudioManager;
if (Platform.OS !== 'web') {
  // On React Native, use react-native-audio-api polyfill
  const AudioAPI = require('react-native-audio-api');
  AudioContext = AudioAPI.AudioContext;
  OfflineAudioContext = AudioAPI.OfflineAudioContext;
  AudioRecorder = AudioAPI.AudioRecorder;
  RecorderAdapterNode = AudioAPI.RecorderAdapterNode;
  AudioManager = AudioAPI.AudioManager;
} else {
  // On web, use native Web Audio API
  AudioContext = window.AudioContext || window.webkitAudioContext;
  OfflineAudioContext = window.OfflineAudioContext;
}

// ML-based pitch detection using Spotify's Basic Pitch
class PitchDetector extends Component {
  constructor(props) {
    super(props);
    this.audioContext = null;
    this.microphone = null;
    this.mediaRecorder = null; // For web
    this.audioRecorder = null; // For React Native
    this.recorderAdapter = null; // For React Native
    this.audioChunks = [];
    this.recordedBuffers = []; // For React Native AudioRecorder
    this.startTimeMs = null;
    this.isRecording = false;
    // Lazy-load Basic Pitch model only when needed
    this.basicPitch = null;
    this.basicPitchModelPromise = null;

    // Real-time pitch detection
    this.analyser = null;
    this.scriptProcessor = null;
    this.liveDetections = []; // Store live detections for smoothing
  }

  // Lazy-load BasicPitch model to ensure fetch polyfill is ready
  initBasicPitchModel = async () => {
    if (this.basicPitch) {
      console.log('BasicPitch model already loaded');
      return this.basicPitch;
    }

    if (this.basicPitchModelPromise) {
      console.log('BasicPitch model already loading, waiting...');
      return this.basicPitchModelPromise;
    }

    console.log('Initializing BasicPitch model...');
    console.log('fetch available:', typeof fetch !== 'undefined');
    console.log('Platform:', Platform.OS);

    this.basicPitchModelPromise = (async () => {
      try {
        let modelUrl;

        if (Platform.OS === 'web') {
          // Web: use standard @tensorflow/tfjs (NOT react-native version)
          console.log('Web detected, initializing TensorFlow.js for web...');

          const tf = require('@tensorflow/tfjs');

          // Try to use WebGL backend (GPU) if available
          // TensorFlow.js will automatically fall back to CPU if WebGL is not available
          try {
            await tf.setBackend('webgl');
            console.log('Successfully set backend to WebGL (GPU)');
          } catch (e) {
            console.log('WebGL not available, falling back to CPU:', e.message);
          }

          // Wait for TensorFlow backend to initialize
          await tf.ready();
          console.log('TensorFlow.js backend ready:', tf.getBackend());

          // Use CDN model URL for web - TensorFlow.js will handle the download and cache it
          modelUrl = 'https://cdn.jsdelivr.net/npm/@spotify/basic-pitch@1.0.1/model/model.json';
          console.log('Using CDN model for web (will be cached after first download)');
        } else {
          // React Native: Wait for TensorFlow.js backend to be ready
          console.log('React Native detected, ensuring TensorFlow.js backend is ready...');

          const tf = require('@tensorflow/tfjs');
          require('@tensorflow/tfjs-react-native');

          // Wait for TensorFlow backend to initialize
          await tf.ready();
          const currentBackend = tf.getBackend();
          console.log('TensorFlow.js React Native backend ready:', currentBackend);

          // Note: tfjs-react-native typically uses 'cpu' backend
          // GPU support on mobile is experimental and often slower than CPU
          if (currentBackend !== 'cpu' && currentBackend !== 'webgl') {
            console.log(`Unusual backend detected: ${currentBackend}`);
          }

          // Use CDN model URL - TensorFlow.js will handle the download and cache it
          // The model will be downloaded once and cached by TensorFlow.js
          modelUrl = 'https://cdn.jsdelivr.net/npm/@spotify/basic-pitch@1.0.1/model/model.json';
          console.log('Using CDN model for React Native (will be cached after first download)');
        }

        console.log('Loading BasicPitch model from:', modelUrl);
        this.basicPitch = new BasicPitch(modelUrl);
        console.log('BasicPitch model initialized successfully');

        // Debug: Check what's actually in the model
        if (Platform.OS === 'web') {
          console.log('[DEBUG] Checking loaded model...');
          const model = await this.basicPitch.model;
          console.log('[DEBUG] Model type:', model.constructor.name);
          console.log('[DEBUG] Model has execute:', typeof model.execute);
          console.log('[DEBUG] Model has predict:', typeof model.predict);
          console.log('[DEBUG] Model methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(model)).filter(m => typeof model[m] === 'function'));
        }

        return this.basicPitch;
      } catch (error) {
        console.error('Failed to initialize BasicPitch model:', error);
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          fetchAvailable: typeof fetch !== 'undefined',
          platform: Platform.OS,
          tfBackend: Platform.OS !== 'web' ? require('@tensorflow/tfjs').getBackend() : 'N/A'
        });
        throw error;
      }
    })();

    return this.basicPitchModelPromise;
  }

  start = async () => {
    try {
      console.log('========================================');
      console.log('🎤 PitchDetector.start() called');
      console.log('Platform:', Platform.OS);
      console.log('voiceMode:', this.props.voiceMode);
      console.log('pitchDetectionMethod:', this.props.pitchDetectionMethod);
      console.log('========================================');

      // Initialize BasicPitch model first
      console.log('Initializing BasicPitch model...');
      try {
        await this.initBasicPitchModel();
        console.log('BasicPitch model ready');
      } catch (error) {
        console.error('Failed to initialize BasicPitch model:', error);
        throw new Error(`BasicPitch initialization failed: ${error.message}`);
      }

      console.log('Creating AudioContext...');
      // For React Native, create AudioContext with 44100 Hz for iOS compatibility
      if (Platform.OS !== 'web') {
        this.audioContext = new AudioContext({ sampleRate: 44100 });

        // Create AudioRecorder for React Native (do this once during setup)
        if (!this.audioRecorder) {
          console.log('Creating AudioRecorder instance...');
          this.audioRecorder = new AudioRecorder({
            sampleRate: 44100,
            numberOfChannels: 1,
            bufferLengthInSamples: 44100, // 1 second buffers
          });
          console.log('AudioRecorder instance created');
        }
      } else {
        this.audioContext = new AudioContext();
      }
      console.log('AudioContext created, sampleRate:', this.audioContext.sampleRate);

      // Platform-specific microphone setup
      let stream;
      if (Platform.OS === 'web') {
        // Web: Use getUserMedia
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.microphone = this.audioContext.createMediaStreamSource(stream);
      } else {
        // React Native: We don't need getUserMedia, AudioRecorder handles it
        // Create a dummy microphone node (we'll use AudioRecorder instead)
        this.microphone = null;
      }

      // Set up real-time pitch detection with analyser (Web only for now)
      if (Platform.OS === 'web') {
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 2048;
        this.microphone.connect(this.analyser);

        // Use ScriptProcessor for real-time analysis
        const bufferSize = 4096;
        this.scriptProcessor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);
        this.analyser.connect(this.scriptProcessor);
        this.scriptProcessor.connect(this.audioContext.destination);
      }

      // Set up audio processing callback (Web only for now)
      if (Platform.OS === 'web') {
        let frameCount = 0;
        this.scriptProcessor.onaudioprocess = (event) => {
          if (!this.isRecording) return;

          const inputData = event.inputBuffer.getChannelData(0);

          // Log audio level every 10 frames to verify audio is being captured
          frameCount++;
          if (frameCount % 10 === 0) {
            const rms = Math.sqrt(inputData.reduce((sum, val) => sum + val * val, 0) / inputData.length);
            console.log('Audio RMS:', rms.toFixed(4));
          }

          // Run pitch detection based on mode and method
          const method = this.props.pitchDetectionMethod || 'hybrid';

          // Debug logging (only log every 30 frames to avoid spam)
          if (frameCount % 30 === 0) {
            console.log(`[Frame ${frameCount}] voiceMode=${this.props.voiceMode}, method=${method}, liveDetections=${this.liveDetections.length}`);
          }

          if (this.props.voiceMode) {
            // Voice mode: Always do live pitch detection
            const detection = this.detectPitch(inputData, this.audioContext.sampleRate);

            if (detection) {
              const timestamp = (Date.now() - this.startTimeMs) / 1000;
              this.liveDetections.push({
                ...detection,
                timestamp
              });

              console.log('PitchDetector: Live detection -', detection.note, detection.frequency.toFixed(1), 'Hz');

              // Send live detection to visualizer
              this.props.onLiveDetection?.({
                note: detection.note,
                frequency: detection.frequency,
                timestamp,
                isLive: true
              });
            }
          } else {
            // Raw mode: Still do pitch detection if using non-ONNX methods
            // BUT also send FFT data for visualization

            // Send FFT data for spectrum visualization
            const bufferLength = this.analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            this.analyser.getByteFrequencyData(dataArray);
            this.props.onFFTData?.(dataArray);

            // If using non-ONNX methods (yin/fft/pca/cepstral), we need live detections for final notes
            if (method === 'yin' || method === 'fft' || method === 'pca' || method === 'cepstral') {
              const detection = this.detectPitch(inputData, this.audioContext.sampleRate);

              if (detection) {
                const timestamp = (Date.now() - this.startTimeMs) / 1000;
                this.liveDetections.push({
                  ...detection,
                  timestamp
                });

                console.log('PitchDetector (raw mode): Live detection -', detection.note, detection.frequency.toFixed(1), 'Hz');

                // Send live detection to visualizer
                this.props.onLiveDetection?.({
                  note: detection.note,
                  frequency: detection.frequency,
                  timestamp,
                  isLive: true
                });
              }
            }
          }
        };
      }

      // Set up recording - different approach for web vs React Native
      if (Platform.OS === 'web') {
        // Web: Use MediaRecorder
        this.mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm',
        });

        this.mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            this.audioChunks.push(event.data);
          }
        };

        this.mediaRecorder.onstop = async () => {
          await this.processRecording();
        };

        // Start recording
        this.mediaRecorder.start(100); // Collect data every 100ms
      } else {
        // React Native: Set up audio graph with AudioRecorder
        // Based on: https://gist.github.com/mdydek/298bdb700e85127221a78bc56bf98c10
        console.log('Setting up AudioRecorder with audio graph...');

        // IMPORTANT: Deactivate first, then configure session
        // From GitHub issue: needed to put setAudioSessionActivity(false) after setAudioSessionOptions
        try {
          await AudioManager.setAudioSessionActivity(false);
          console.log('Audio session deactivated');
        } catch (e) {
          console.log('Ignoring audio session deactivation error:', e.message);
        }

        // Configure audio session for recording with mixing enabled
        AudioManager.setAudioSessionOptions({
          iosCategory: 'playAndRecord',
          iosMode: 'default',
          iosOptions: [
            'defaultToSpeaker',
            'allowBluetoothA2DP',
            'mixWithOthers', // Allow sharing with other audio
          ],
        });

        console.log('Audio session configured with mixing enabled');

        // Activate audio session
        const activated = await AudioManager.setAudioSessionActivity(true);
        console.log('Audio session activation result:', activated);

        // Ensure AudioContext is running
        if (this.audioContext.state === 'suspended') {
          await this.audioContext.resume();
        }

        console.log('AudioContext state:', this.audioContext.state);

        // Create RecorderAdapterNode and connect AudioRecorder to it
        this.recorderAdapter = this.audioContext.createRecorderAdapter();
        this.audioRecorder.connect(this.recorderAdapter);
        console.log('AudioRecorder connected to RecorderAdapterNode');

        // Create gain node with zero output to prevent feedback
        // This is the key to avoiding Core Audio error 10875
        const gainNode = this.audioContext.createGain();
        gainNode.gain.value = 0; // Silent - no audio output

        // Connect: RecorderAdapter → GainNode → Destination
        this.recorderAdapter.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        console.log('Audio graph connected: AudioRecorder → RecorderAdapter → Gain(0) → Destination');

        // Set up callback to capture audio data and perform live pitch detection
        let frameCount = 0;
        this.audioRecorder.onAudioReady((event) => {
          const { buffer, numFrames } = event;
          console.log('AudioRecorder buffer ready:', buffer.duration, 'seconds,', numFrames, 'frames');
          if (buffer && buffer.length > 0) {
            this.recordedBuffers.push(buffer);

            if (this.isRecording) {
              const audioData = buffer.getChannelData(0); // Get first channel
              const method = this.props.pitchDetectionMethod || 'hybrid';

              if (this.props.voiceMode) {
                // Voice mode: Perform live pitch detection
                const detection = this.detectPitch(audioData, buffer.sampleRate);

                if (detection) {
                  const timestamp = (Date.now() - this.startTimeMs) / 1000;
                  this.liveDetections.push({
                    ...detection,
                    timestamp
                  });

                  console.log('PitchDetector (iOS): Live detection -', detection.note, detection.frequency.toFixed(1), 'Hz');

                  // Send live detection to visualizer
                  this.props.onLiveDetection?.({
                    note: detection.note,
                    frequency: detection.frequency,
                    timestamp,
                    isLive: true
                  });
                }
              } else {
                // Raw mode: If using non-ONNX methods, still collect live detections
                if (method === 'yin' || method === 'fft' || method === 'pca') {
                  const detection = this.detectPitch(audioData, buffer.sampleRate);

                  if (detection) {
                    const timestamp = (Date.now() - this.startTimeMs) / 1000;
                    this.liveDetections.push({
                      ...detection,
                      timestamp
                    });

                    console.log('PitchDetector (iOS, raw mode): Live detection -', detection.note, detection.frequency.toFixed(1), 'Hz');

                    // Send live detection to visualizer
                    this.props.onLiveDetection?.({
                      note: detection.note,
                      frequency: detection.frequency,
                      timestamp,
                      isLive: true
                    });
                  }
                }

                // Raw mode: Compute and send FFT data
                // Throttle to every 3rd frame for performance
                frameCount++;
                if (frameCount % 3 === 0) {
                  const fftData = this.computeFFT(audioData);
                  this.props.onFFTData?.(fftData);
                }
              }
            }
          }
        });

        // Start recording
        this.audioRecorder.start();
        console.log('AudioRecorder started');
      }

      this.audioChunks = [];
      this.recordedBuffers = [];
      this.liveDetections = [];
      this.startTimeMs = Date.now();
      this.isRecording = true;

      console.log('✓ Recording started with live pitch detection + Basic Pitch ML');
      return true;
    } catch (error) {
      console.error('Microphone access error:', error);
      throw error;
    }
  };

  stop = async () => {
    if (this.isRecording) {
      this.isRecording = false;

      // Stop the appropriate recorder
      if (Platform.OS === 'web' && this.mediaRecorder) {
        this.mediaRecorder.stop();
      } else if (Platform.OS !== 'web' && this.audioRecorder) {
        this.audioRecorder.stop();

        // Optional: Reset audio session to playback mode after recording
        AudioManager.setAudioSessionOptions({
          iosCategory: 'playback',
          iosMode: 'default',
        });

        // Process the recorded buffers
        await this.processRecordingFromBuffers();
      }

      if (this.scriptProcessor) {
        this.scriptProcessor.disconnect();
        this.scriptProcessor = null;
      }

      if (this.analyser) {
        this.analyser.disconnect();
        this.analyser = null;
      }

      if (this.recorderAdapter) {
        this.recorderAdapter.disconnect();
        this.recorderAdapter = null;
      }

      if (this.microphone) {
        if (this.microphone.mediaStream) {
          this.microphone.mediaStream.getTracks().forEach(track => track.stop());
        }
        this.microphone = null;
      }

      if (this.audioContext) {
        await this.audioContext.close();
        this.audioContext = null;
      }

      this.audioRecorder = null;
      this.mediaRecorder = null;
    }
  };

  // FFT-based pitch detection using Harmonic Product Spectrum (HPS)
  // HPS finds the fundamental by multiplying downsampled spectra
  // This avoids picking harmonics (which are louder than the fundamental)
  detectPitchFFT(buffer, sampleRate) {
    // Calculate RMS to check if there's enough signal
    const rms = Math.sqrt(buffer.reduce((sum, val) => sum + val * val, 0) / buffer.length);
    if (rms < 0.005) return null;

    const fftSize = 2048;
    const fft = new Float32Array(fftSize);

    // Copy buffer data (zero-pad if needed)
    for (let i = 0; i < fftSize; i++) {
      fft[i] = i < buffer.length ? buffer[i] : 0;
    }

    // Apply Hamming window to reduce spectral leakage
    for (let i = 0; i < fftSize; i++) {
      const windowValue = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / fftSize);
      fft[i] *= windowValue;
    }

    // Compute full magnitude spectrum
    const minFreq = 50;  // Lowest note we care about (G1)
    const maxFreq = 1000; // Highest note we care about (C6)
    const minBin = Math.floor(minFreq * fftSize / sampleRate);
    const maxBin = Math.ceil(maxFreq * fftSize / sampleRate);

    // Compute magnitude spectrum
    const spectrum = new Float32Array(maxBin);
    for (let k = 0; k < maxBin; k++) {
      let real = 0;
      let imag = 0;

      for (let n = 0; n < fftSize; n++) {
        const angle = -2 * Math.PI * k * n / fftSize;
        real += fft[n] * Math.cos(angle);
        imag += fft[n] * Math.sin(angle);
      }

      spectrum[k] = Math.sqrt(real * real + imag * imag);
    }

    // Harmonic Product Spectrum (HPS)
    // Multiply spectrum with downsampled versions to find fundamental
    const hps = new Float32Array(maxBin);
    const numHarmonics = 5; // Use first 5 harmonics

    for (let k = minBin; k < maxBin; k++) {
      hps[k] = spectrum[k]; // Start with original spectrum

      // Multiply with downsampled spectra (harmonics)
      for (let h = 2; h <= numHarmonics; h++) {
        const downsampledBin = Math.floor(k / h);
        if (downsampledBin < spectrum.length) {
          hps[k] *= spectrum[downsampledBin];
        }
      }
    }

    // Find peak in HPS (this is the fundamental)
    let maxHPS = 0;
    let peakBin = 0;

    for (let k = minBin; k < maxBin; k++) {
      if (hps[k] > maxHPS) {
        maxHPS = hps[k];
        peakBin = k;
      }
    }

    if (maxHPS < 0.01) return null; // Not confident enough

    // Convert bin to frequency with parabolic interpolation
    let frequency = peakBin * sampleRate / fftSize;

    if (peakBin > minBin && peakBin < maxBin - 1) {
      const prevMag = hps[peakBin - 1];
      const currMag = hps[peakBin];
      const nextMag = hps[peakBin + 1];

      // Parabolic interpolation for sub-bin accuracy
      const delta = 0.5 * (nextMag - prevMag) / (2 * currMag - nextMag - prevMag);
      frequency = (peakBin + delta) * sampleRate / fftSize;
    }

    // Sanity check
    if (frequency < 50 || frequency > 1000) return null;

    // Confidence based on HPS peak strength relative to spectrum energy
    const totalEnergy = spectrum.reduce((sum, val) => sum + val, 0);
    const confidence = Math.min(maxHPS / (totalEnergy / spectrum.length) / 100, 1.0);

    return {
      frequency: frequency,
      note: this.midiToNoteName(this.frequencyToMidi(frequency)),
      confidence: confidence
    };
  }

  // Spectral PCA: Find fundamental by analyzing harmonic spacing across time
  // This uses frequency-domain PCA to find stable harmonic patterns
  detectPitchPCA(buffer, sampleRate) {
    // Calculate RMS to check if there's enough signal
    const rms = Math.sqrt(buffer.reduce((sum, val) => sum + val * val, 0) / buffer.length);
    if (rms < 0.005) return null;

    // Need multiple frames for PCA
    const windowSize = 1024;
    const hopSize = 256;
    const numWindows = Math.floor((buffer.length - windowSize) / hopSize);

    if (numWindows < 3) {
      // Not enough data for PCA, fall back to FFT+HPS
      return this.detectPitchFFT(buffer, sampleRate);
    }

    const minFreq = 50;
    const maxFreq = 1000;
    const minBin = Math.floor(minFreq * windowSize / sampleRate);
    const maxBin = Math.ceil(maxFreq * windowSize / sampleRate);
    const numBins = maxBin - minBin;

    // Build spectrogram matrix: rows = time frames, columns = frequency bins
    const spectrogram = [];

    for (let w = 0; w < numWindows; w++) {
      const start = w * hopSize;
      const windowData = new Float32Array(windowSize);

      // Copy and window the data
      for (let i = 0; i < windowSize; i++) {
        const sample = i + start < buffer.length ? buffer[i + start] : 0;
        const hammingWindow = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / windowSize);
        windowData[i] = sample * hammingWindow;
      }

      // Compute magnitude spectrum for this window
      const spectrum = new Float32Array(numBins);
      for (let k = minBin; k < maxBin; k++) {
        let real = 0;
        let imag = 0;

        for (let n = 0; n < windowSize; n++) {
          const angle = -2 * Math.PI * k * n / windowSize;
          real += windowData[n] * Math.cos(angle);
          imag += windowData[n] * Math.sin(angle);
        }

        spectrum[k - minBin] = Math.sqrt(real * real + imag * imag);
      }

      spectrogram.push(spectrum);
    }

    // Compute mean spectrum (first step of PCA)
    const meanSpectrum = new Float32Array(numBins);
    for (let i = 0; i < numWindows; i++) {
      for (let j = 0; j < numBins; j++) {
        meanSpectrum[j] += spectrogram[i][j];
      }
    }
    for (let j = 0; j < numBins; j++) {
      meanSpectrum[j] /= numWindows;
    }

    // Find harmonic peaks in mean spectrum using HPS
    const hps = new Float32Array(numBins);
    const numHarmonics = 4;

    for (let k = 0; k < numBins; k++) {
      hps[k] = meanSpectrum[k];

      for (let h = 2; h <= numHarmonics; h++) {
        const downsampledBin = Math.floor(k / h);
        if (downsampledBin < numBins) {
          hps[k] *= meanSpectrum[downsampledBin];
        }
      }
    }

    // Find peak in HPS
    let maxHPS = 0;
    let peakBin = 0;

    for (let k = 0; k < numBins; k++) {
      if (hps[k] > maxHPS) {
        maxHPS = hps[k];
        peakBin = k;
      }
    }

    if (maxHPS < 0.01) return null;

    // Convert bin to frequency
    const actualBin = peakBin + minBin;
    let frequency = actualBin * sampleRate / windowSize;

    // Compute stability (variance of peak across time frames)
    let variance = 0;
    for (let i = 0; i < numWindows; i++) {
      const diff = spectrogram[i][peakBin] - meanSpectrum[peakBin];
      variance += diff * diff;
    }
    variance /= numWindows;

    // Confidence: high if peak is stable across time (low variance)
    const stability = 1.0 / (1.0 + variance / meanSpectrum[peakBin]);
    const confidence = Math.min(stability, 1.0);

    if (frequency < 50 || frequency > 1000) return null;

    return {
      frequency: frequency,
      note: this.midiToNoteName(this.frequencyToMidi(frequency)),
      confidence: confidence
    };
  }

  // Cepstral analysis for pitch detection
  // Separates excitation (pitch) from vocal tract resonances (formants)
  detectPitchCepstral(buffer, sampleRate) {
    const minFreq = 55;  // ~A1 (bass voices can go down to ~80Hz, allow margin)
    const maxFreq = 1000; // ~B5

    // Use power-of-2 window for FFT efficiency
    const windowSize = 2048;
    const halfWindow = windowSize / 2;

    if (buffer.length < windowSize) {
      return null;
    }

    // Apply Hamming window
    const windowed = new Float32Array(windowSize);
    for (let i = 0; i < windowSize; i++) {
      const hamming = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (windowSize - 1));
      windowed[i] = buffer[i] * hamming;
    }

    // STEP 1: Compute power spectrum via DFT
    const powerSpectrum = new Float32Array(halfWindow);
    for (let k = 0; k < halfWindow; k++) {
      let real = 0;
      let imag = 0;
      for (let n = 0; n < windowSize; n++) {
        const angle = (2 * Math.PI * k * n) / windowSize;
        real += windowed[n] * Math.cos(angle);
        imag -= windowed[n] * Math.sin(angle);
      }
      powerSpectrum[k] = real * real + imag * imag;
    }

    // STEP 2: Take log of power spectrum (compress dynamic range)
    const logSpectrum = new Float32Array(halfWindow);
    for (let k = 0; k < halfWindow; k++) {
      // Add small epsilon to avoid log(0)
      logSpectrum[k] = Math.log(powerSpectrum[k] + 1e-10);
    }

    // STEP 3: Compute cepstrum via inverse DFT of log spectrum
    // Cepstrum is "spectrum of the spectrum" - reveals periodicity
    const cepstrum = new Float32Array(halfWindow);
    for (let n = 0; n < halfWindow; n++) {
      let sum = 0;
      for (let k = 0; k < halfWindow; k++) {
        const angle = (2 * Math.PI * k * n) / halfWindow;
        sum += logSpectrum[k] * Math.cos(angle);
      }
      cepstrum[n] = sum / halfWindow;
    }

    // STEP 4: Find peak in cepstrum corresponding to fundamental period
    // Quefrency (cepstral domain "frequency") relates to pitch period
    const minQuefrency = Math.floor(sampleRate / maxFreq);
    const maxQuefrency = Math.floor(sampleRate / minFreq);

    let maxPeak = -Infinity;
    let peakQuefrency = -1;

    for (let q = minQuefrency; q < Math.min(maxQuefrency, halfWindow); q++) {
      if (cepstrum[q] > maxPeak) {
        // Check it's a real peak (higher than neighbors)
        if (q > 0 && q < halfWindow - 1) {
          if (cepstrum[q] > cepstrum[q - 1] && cepstrum[q] > cepstrum[q + 1]) {
            maxPeak = cepstrum[q];
            peakQuefrency = q;
          }
        }
      }
    }

    if (peakQuefrency === -1 || maxPeak < 0) {
      return null; // No clear peak found
    }

    // Parabolic interpolation for sub-sample accuracy
    let refinedQuefrency = peakQuefrency;
    if (peakQuefrency > 0 && peakQuefrency < halfWindow - 1) {
      const y1 = cepstrum[peakQuefrency - 1];
      const y2 = cepstrum[peakQuefrency];
      const y3 = cepstrum[peakQuefrency + 1];
      const offset = 0.5 * (y1 - y3) / (y1 - 2 * y2 + y3);
      refinedQuefrency = peakQuefrency + offset;
    }

    // Convert quefrency to frequency
    const frequency = sampleRate / refinedQuefrency;

    // Confidence based on peak prominence
    const avgCepstrum = cepstrum.slice(minQuefrency, maxQuefrency).reduce((a, b) => a + b, 0) /
                        (maxQuefrency - minQuefrency);
    const confidence = Math.min((maxPeak - avgCepstrum) / Math.abs(avgCepstrum), 1.0);

    if (confidence < 0.2 || frequency < minFreq || frequency > maxFreq) {
      return null;
    }

    return {
      frequency: frequency,
      note: this.midiToNoteName(this.frequencyToMidi(frequency)),
      confidence: confidence
    };
  }

  // Cepstral + KNN with posterior probabilities
  // Processes whole audio buffer with past/future context
  detectPitchCepstralKNN(audioBuffer, sampleRate) {
    console.log('=== Cepstral+KNN with posterior probabilities ===');
    console.log(`Processing ${audioBuffer.length} samples at ${sampleRate}Hz`);

    // STEP 1: Aggressive downsampling to 11025Hz for maximum speed (~8x faster)
    // Nyquist = 5.5kHz, still covers full vocal range (typical max ~4kHz)
    const targetSampleRate = 11025;
    const downsampleFactor = Math.round(sampleRate / targetSampleRate);

    console.log(`Downsampling by ${downsampleFactor}x: ${sampleRate}Hz → ${targetSampleRate}Hz`);

    const downsampled = new Float32Array(Math.floor(audioBuffer.length / downsampleFactor));
    for (let i = 0; i < downsampled.length; i++) {
      downsampled[i] = audioBuffer[i * downsampleFactor];
    }

    console.log(`Downsampled: ${audioBuffer.length} → ${downsampled.length} samples (${(downsampled.length/targetSampleRate).toFixed(2)}s)`);

    // Optimized parameters for speed/accuracy trade-off
    const hopSize = 1024;   // ~93ms at 11.025kHz
    const windowSize = 2048; // Must match detectPitchCepstral requirement
    const contextWindow = 3; // Look at ±3 frames (±279ms context)

    // STEP 2: Run cepstral analysis on downsampled audio with sliding window
    const rawDetections = [];

    for (let i = 0; i < downsampled.length - windowSize; i += hopSize) {
      const frame = downsampled.slice(i, i + windowSize);
      const timestamp = i / targetSampleRate;

      const detection = this.detectPitchCepstral(frame, targetSampleRate);
      if (detection) {
        rawDetections.push({
          timestamp,
          frequency: detection.frequency,
          confidence: detection.confidence,
          frameIndex: Math.floor(i / hopSize)
        });
      }
    }

    console.log(`Cepstral: ${rawDetections.length} raw detections`);

    if (rawDetections.length === 0) return [];

    // STEP 2: Calculate posterior probabilities using past/future context
    const refinedDetections = [];

    for (let i = 0; i < rawDetections.length; i++) {
      const current = rawDetections[i];

      // Get context window (past and future)
      const start = Math.max(0, i - contextWindow);
      const end = Math.min(rawDetections.length, i + contextWindow + 1);
      const contextFrames = rawDetections.slice(start, end);

      // Calculate posterior probability based on context
      const { refinedFrequency, posteriorConfidence } = this.calculatePosterior(
        current,
        contextFrames,
        i - start  // Position of current in context
      );

      refinedDetections.push({
        timestamp: current.timestamp,
        frequency: refinedFrequency,
        confidence: posteriorConfidence,
        note: this.midiToNoteName(this.frequencyToMidi(refinedFrequency))
      });
    }

    console.log(`After posterior refinement: ${refinedDetections.length} detections`);
    return refinedDetections;
  }

  // Calculate posterior probability using Bayesian inference with context
  calculatePosterior(current, contextFrames, currentIndex) {
    // Prior: current frame's detection
    const priorFreq = current.frequency;
    const priorConf = current.confidence;

    // Likelihood: weighted average of context, with recency bias
    let totalWeight = 0;
    let weightedFreqSum = 0;
    let weightedConfSum = 0;

    for (let i = 0; i < contextFrames.length; i++) {
      const frame = contextFrames[i];
      const distance = Math.abs(i - currentIndex);

      // Temporal weight: closer frames have more influence
      // Future frames slightly less weight than past (causal bias)
      const temporalWeight = Math.exp(-distance / 2.0);
      const causalBias = i < currentIndex ? 1.0 : 0.8;

      // Pitch similarity weight: similar pitches reinforce each other
      const freqDiff = Math.abs(this.frequencyToMidi(frame.frequency) -
                                 this.frequencyToMidi(priorFreq));
      const pitchWeight = Math.exp(-freqDiff / 1.0); // 1 semitone decay

      const weight = temporalWeight * causalBias * pitchWeight * frame.confidence;

      totalWeight += weight;
      weightedFreqSum += frame.frequency * weight;
      weightedConfSum += frame.confidence * weight;
    }

    // Posterior: blend prior with likelihood
    const likelihoodFreq = weightedFreqSum / totalWeight;
    const likelihoodConf = weightedConfSum / totalWeight;

    // Bayesian update: prior * likelihood
    const posteriorFreq = (priorFreq * priorConf + likelihoodFreq * likelihoodConf) /
                          (priorConf + likelihoodConf);
    const posteriorConfidence = Math.min(priorConf + likelihoodConf * 0.5, 1.0);

    return {
      refinedFrequency: posteriorFreq,
      posteriorConfidence: posteriorConfidence
    };
  }

  // Dispatcher: Choose detection method based on settings
  detectPitch(buffer, sampleRate) {
    const method = this.props.pitchDetectionMethod || 'yin';

    switch (method) {
      case 'yin':
        return this.detectPitchAutocorrelation(buffer, sampleRate);

      case 'fft':
        return this.detectPitchFFT(buffer, sampleRate);

      case 'pca':
        return this.detectPitchPCA(buffer, sampleRate);

      case 'cepstral':
        return this.detectPitchCepstral(buffer, sampleRate);

      case 'cepstral_knn':
        // This is handled in runBasicPitch, not real-time
        return this.detectPitchCepstral(buffer, sampleRate);

      case 'onnx':
        // ONNX is post-processing only, use YIN for live detection
        return this.detectPitchAutocorrelation(buffer, sampleRate);

      case 'hybrid':
        // Hybrid uses YIN for live, ONNX for post-processing
        return this.detectPitchAutocorrelation(buffer, sampleRate);

      default:
        console.warn(`Unknown pitch detection method: ${method}, falling back to YIN`);
        return this.detectPitchAutocorrelation(buffer, sampleRate);
    }
  }

  // YIN algorithm for pitch detection - more robust for real-time
  detectPitchAutocorrelation(buffer, sampleRate) {
    // Calculate RMS to check if there's enough signal
    const rms = Math.sqrt(buffer.reduce((sum, val) => sum + val * val, 0) / buffer.length);
    if (rms < 0.005) return null; // Lowered from 0.01 to capture quieter notes

    const bufferSize = buffer.length;
    const yinBuffer = new Float32Array(bufferSize / 2);

    // Step 1: Calculate difference function
    yinBuffer[0] = 1;
    for (let tau = 1; tau < yinBuffer.length; tau++) {
      yinBuffer[tau] = 0;
      for (let i = 0; i < yinBuffer.length; i++) {
        const delta = buffer[i] - buffer[i + tau];
        yinBuffer[tau] += delta * delta;
      }
    }

    // Step 2: Cumulative mean normalized difference
    let runningSum = 0;
    yinBuffer[0] = 1;
    for (let tau = 1; tau < yinBuffer.length; tau++) {
      runningSum += yinBuffer[tau];
      yinBuffer[tau] *= tau / runningSum;
    }

    // Step 3: Absolute threshold - find first minimum below threshold
    const threshold = 0.25; // Increased from 0.15 to be more permissive
    let tau = 2;

    // Find first dip below threshold
    while (tau < yinBuffer.length) {
      if (yinBuffer[tau] < threshold) {
        while (tau + 1 < yinBuffer.length && yinBuffer[tau + 1] < yinBuffer[tau]) {
          tau++;
        }
        break;
      }
      tau++;
    }

    if (tau >= yinBuffer.length) return null;

    // Step 4: Parabolic interpolation
    let betterTau = tau;
    if (tau > 0 && tau < yinBuffer.length - 1) {
      const s0 = yinBuffer[tau - 1];
      const s1 = yinBuffer[tau];
      const s2 = yinBuffer[tau + 1];
      betterTau = tau + (s2 - s0) / (2 * (2 * s1 - s2 - s0));
    }

    const frequency = sampleRate / betterTau;

    // Only accept reasonable frequencies for human voice (extended range for bass voices)
    if (frequency < 50 || frequency > 1000) return null;

    return {
      frequency: frequency,
      note: this.midiToNoteName(this.frequencyToMidi(frequency)),
      confidence: 1 - yinBuffer[tau]
    };
  };

  // Compute FFT for raw mode visualization (used on iOS/React Native)
  computeFFT(audioData) {
    // Simple FFT implementation using power spectrum
    const fftSize = 2048;
    const bufferLength = fftSize / 2;
    const fftData = new Uint8Array(bufferLength);

    // Take first fftSize samples (or pad if needed)
    const samples = new Float32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      samples[i] = i < audioData.length ? audioData[i] : 0;
    }

    // Compute magnitude spectrum (simplified - just use absolute values binned by frequency)
    // This is a rough approximation, but sufficient for visualization
    const samplesPerBin = Math.floor(fftSize / bufferLength);

    for (let i = 0; i < bufferLength; i++) {
      let sum = 0;
      for (let j = 0; j < samplesPerBin; j++) {
        const idx = i * samplesPerBin + j;
        if (idx < samples.length) {
          sum += Math.abs(samples[idx]);
        }
      }
      // Normalize to 0-255 range
      const avg = sum / samplesPerBin;
      fftData[i] = Math.min(255, Math.floor(avg * 1000)); // Scale up for visibility
    }

    return fftData;
  };

  frequencyToMidi(frequency) {
    return 69 + 12 * Math.log2(frequency / 440);
  };

  resampleAudioBuffer = async (audioBuffer, targetSampleRate) => {
    const needsResampling = audioBuffer.sampleRate !== targetSampleRate;
    const needsMonoConversion = audioBuffer.numberOfChannels > 1;

    // If no conversion needed, return as is
    if (!needsResampling && !needsMonoConversion) {
      return audioBuffer;
    }

    console.log(`Converting audio: ${audioBuffer.numberOfChannels} channels @ ${audioBuffer.sampleRate}Hz → 1 channel @ ${targetSampleRate}Hz`);

    // Create offline context at target sample rate with mono output
    const offlineContext = new OfflineAudioContext(
      1, // Always output mono
      Math.ceil(audioBuffer.duration * targetSampleRate),
      targetSampleRate
    );

    // Create buffer source
    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineContext.destination);
    source.start(0);

    // Render and return converted buffer
    const convertedBuffer = await offlineContext.startRendering();
    console.log(`✓ Converted to 1 channel @ ${convertedBuffer.sampleRate}Hz`);
    return convertedBuffer;
  };

  // POST-PROCESSING PIPELINE
  // Refines raw detections using statistical analysis and growing notes algorithm
  postProcessDetections(detections, options = {}) {
    const {
      useKNN = false,
      windowSize = 0.3,        // 300ms rolling window
      pitchTolerance = 0.5,    // semitones
      minConfidence = 0.3,
      minNoteDuration = 0.15   // 150ms minimum
    } = options;

    console.log('=== Post-processing detections ===');
    console.log(`Input: ${detections.length} detections, useKNN: ${useKNN}`);

    if (detections.length === 0) return [];

    const sortedDetections = [...detections].sort((a, b) => a.timestamp - b.timestamp);

    // STEP 1: Growing Notes Algorithm
    // Start with each detection, grow it by absorbing nearby similar detections
    const grownNotes = [];
    let currentRegion = null;

    for (let i = 0; i < sortedDetections.length; i++) {
      const detection = sortedDetections[i];
      const midiNote = this.frequencyToMidi(detection.frequency);

      if (!currentRegion) {
        // Start new region
        currentRegion = {
          startTime: detection.timestamp,
          endTime: detection.timestamp,
          pitches: [midiNote],
          frequencies: [detection.frequency],
          confidences: [detection.confidence],
          detectionCount: 1
        };
        continue;
      }

      // Check coherence with current region
      const timeSinceLast = detection.timestamp - currentRegion.endTime;
      const medianPitch = this.getMedian(currentRegion.pitches);
      const pitchDiff = Math.abs(midiNote - medianPitch);

      // Calculate rolling variance (coherence metric)
      const recentPitches = currentRegion.pitches.slice(-5); // Last 5 detections
      const variance = this.calculateVariance(recentPitches);

      // Grow region if coherent
      if (timeSinceLast < windowSize && pitchDiff < pitchTolerance && variance < 1.0) {
        // Extend region
        currentRegion.endTime = detection.timestamp;
        currentRegion.pitches.push(midiNote);
        currentRegion.frequencies.push(detection.frequency);
        currentRegion.confidences.push(detection.confidence);
        currentRegion.detectionCount++;
      } else {
        // Region ended - finalize it
        const duration = currentRegion.endTime - currentRegion.startTime;
        if (duration >= minNoteDuration) {
          grownNotes.push(this.finalizeRegion(currentRegion));
        }

        // Start new region
        currentRegion = {
          startTime: detection.timestamp,
          endTime: detection.timestamp,
          pitches: [midiNote],
          frequencies: [detection.frequency],
          confidences: [detection.confidence],
          detectionCount: 1
        };
      }
    }

    // Finalize last region
    if (currentRegion) {
      const duration = currentRegion.endTime - currentRegion.startTime;
      if (duration >= minNoteDuration) {
        grownNotes.push(this.finalizeRegion(currentRegion));
      }
    }

    console.log(`After growing: ${grownNotes.length} notes`);

    // STEP 2: Optional KNN Clustering
    // Groups nearby notes with similar pitches for further refinement
    let refinedNotes = grownNotes;
    if (useKNN && grownNotes.length > 3) {
      refinedNotes = this.knnClusterNotes(grownNotes, { k: 3, pitchTolerance });
      console.log(`After KNN clustering: ${refinedNotes.length} notes`);
    }

    // STEP 3: Final merge pass - combine adjacent notes of same pitch
    const mergedNotes = [];
    let currentMerged = null;

    for (const note of refinedNotes) {
      if (!currentMerged) {
        currentMerged = { ...note };
      } else {
        const gap = note.startTime - currentMerged.endTime;
        const pitchDiff = Math.abs(Math.round(note.midi) - Math.round(currentMerged.midi));

        // Merge if gap < 300ms and same pitch
        if (gap < 0.3 && pitchDiff < 1) {
          console.log(`Merging adjacent notes: ${currentMerged.midi.toFixed(1)} + ${note.midi.toFixed(1)} (${gap.toFixed(3)}s gap)`);
          currentMerged.endTime = note.endTime;
          currentMerged.duration = currentMerged.endTime - currentMerged.startTime;
        } else {
          mergedNotes.push(currentMerged);
          currentMerged = { ...note };
        }
      }
    }

    if (currentMerged) {
      mergedNotes.push(currentMerged);
    }

    console.log(`Final: ${mergedNotes.length} notes after post-processing`);
    return mergedNotes;
  }

  // Helper: Finalize a region into a note
  finalizeRegion(region) {
    const medianPitch = this.getMedian(region.pitches);
    const medianFrequency = this.getMedian(region.frequencies);
    const avgConfidence = region.confidences.reduce((a, b) => a + b, 0) / region.confidences.length;
    const duration = region.endTime - region.startTime;

    const noteName = this.midiToNoteName(Math.round(medianPitch));

    return {
      startTime: region.startTime,
      endTime: region.endTime,
      duration: duration,
      midi: medianPitch,
      frequency: medianFrequency,
      confidence: avgConfidence,
      detectionCount: region.detectionCount
    };
  }

  // Helper: Calculate variance of array
  calculateVariance(arr) {
    if (arr.length < 2) return 0;
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const squaredDiffs = arr.map(x => (x - mean) ** 2);
    return squaredDiffs.reduce((a, b) => a + b, 0) / arr.length;
  }

  // Optional: K-Nearest Neighbors clustering for note refinement
  knnClusterNotes(notes, options = {}) {
    const { k = 3, pitchTolerance = 0.5 } = options;

    // Build feature vectors: [timestamp, pitch, duration]
    const features = notes.map(note => ({
      note: note,
      vector: [
        note.startTime,           // Temporal position
        note.midi,                 // Pitch
        note.duration * 10         // Duration (weighted more)
      ]
    }));

    const clusters = [];

    // Simple clustering: group notes that are close in feature space
    for (const feature of features) {
      // Find nearest cluster
      let nearestCluster = null;
      let minDistance = Infinity;

      for (const cluster of clusters) {
        const centroid = cluster.centroid;
        const distance = this.euclideanDistance(feature.vector, centroid);

        // Also check pitch similarity
        const pitchDiff = Math.abs(feature.vector[1] - centroid[1]);

        if (distance < minDistance && pitchDiff < pitchTolerance) {
          minDistance = distance;
          nearestCluster = cluster;
        }
      }

      // Add to cluster or create new one
      if (nearestCluster && minDistance < 2.0) {
        nearestCluster.notes.push(feature.note);
        nearestCluster.centroid = this.updateCentroid(nearestCluster.notes);
      } else {
        clusters.push({
          notes: [feature.note],
          centroid: [...feature.vector]
        });
      }
    }

    console.log(`KNN: ${features.length} notes → ${clusters.length} clusters`);

    // Merge notes in each cluster
    const clusteredNotes = clusters.map(cluster => {
      if (cluster.notes.length === 1) {
        return cluster.notes[0];
      }

      // Merge cluster into single note
      const sortedNotes = cluster.notes.sort((a, b) => a.startTime - b.startTime);
      const startTime = sortedNotes[0].startTime;
      const endTime = sortedNotes[sortedNotes.length - 1].endTime;
      const medianMidi = this.getMedian(sortedNotes.map(n => n.midi));
      const avgConfidence = sortedNotes.reduce((sum, n) => sum + n.confidence, 0) / sortedNotes.length;

      return {
        startTime: startTime,
        endTime: endTime,
        duration: endTime - startTime,
        midi: medianMidi,
        frequency: this.midiToFrequency(medianMidi),
        confidence: avgConfidence,
        detectionCount: sortedNotes.reduce((sum, n) => sum + n.detectionCount, 0)
      };
    });

    return clusteredNotes.sort((a, b) => a.startTime - b.startTime);
  }

  // Helper: Euclidean distance between vectors
  euclideanDistance(v1, v2) {
    return Math.sqrt(v1.reduce((sum, val, i) => sum + (val - v2[i]) ** 2, 0));
  }

  // Helper: Update cluster centroid
  updateCentroid(notes) {
    const n = notes.length;
    return [
      notes.reduce((sum, note) => sum + note.startTime, 0) / n,
      notes.reduce((sum, note) => sum + note.midi, 0) / n,
      notes.reduce((sum, note) => sum + note.duration * 10, 0) / n
    ];
  }

  // Convert live detections to note format (for non-ONNX methods)
  // Uses advanced post-processing pipeline with growing notes + optional KNN
  convertLiveDetectionsToNotes() {
    console.log('=== convertLiveDetectionsToNotes called ===');
    console.log('liveDetections:', this.liveDetections?.length || 0, 'detections');

    if (!this.liveDetections || this.liveDetections.length === 0) {
      console.error('⚠️ NO LIVE DETECTIONS! Pitch detection may not have run during recording.');
      console.error('Check: voiceMode prop, pitchDetectionMethod prop, and live detection logic');
      return [];
    }

    console.log(`Converting ${this.liveDetections.length} live detections to notes`);

    // Use new post-processing pipeline
    const method = this.props.pitchDetectionMethod || 'yin';
    const useKNN = method === 'cepstral' || method === 'fft'; // Enable KNN for noisy methods

    const processedNotes = this.postProcessDetections(this.liveDetections, {
      useKNN: useKNN,
      windowSize: 0.3,
      pitchTolerance: 0.5,
      minConfidence: 0.3,
      minNoteDuration: 0.15
    });

    // Convert to final note format
    return processedNotes.map(note => this.convertProcessedNoteToFinalFormat(note));
  }

  // Helper: Convert processed note to final format expected by App.jsx
  convertProcessedNoteToFinalFormat(note) {
    const noteName = this.midiToNoteName(Math.round(note.midi));

    console.log(`Note: ${noteName} @ ${note.startTime.toFixed(2)}s, dur=${note.duration.toFixed(2)}s, detections=${note.detectionCount}, conf=${note.confidence.toFixed(2)}`);

    return {
      startTimeSeconds: note.startTime,
      durationSeconds: note.duration,
      pitchMidi: note.midi,
      amplitude: note.confidence,
      pitchBends: [],
      note: noteName,
      originalNote: {
        startTime: note.startTime,
        duration: note.duration,
        midiNote: note.midi
      }
    };
  }

  // OLD VERSION - Keep for reference/fallback
  convertLiveDetectionsToNotes_OLD() {
    console.log('=== convertLiveDetectionsToNotes_OLD called ===');
    console.log('liveDetections:', this.liveDetections?.length || 0, 'detections');

    if (!this.liveDetections || this.liveDetections.length === 0) {
      console.error('⚠️ NO LIVE DETECTIONS! Pitch detection may not have run during recording.');
      console.error('Check: voiceMode prop, pitchDetectionMethod prop, and live detection logic');
      return [];
    }

    console.log(`Converting ${this.liveDetections.length} live detections to notes`);

    const sortedDetections = [...this.liveDetections].sort((a, b) => a.timestamp - b.timestamp);

    // STEP 1: Group detections into sustained notes (FIRST PASS - very forgiving)
    // HPS/FFT can be fragmented, so we merge aggressively first
    const notes = [];
    let currentNote = null;

    for (let i = 0; i < sortedDetections.length; i++) {
      const detection = sortedDetections[i];
      const midiNote = this.frequencyToMidi(detection.frequency);

      if (!currentNote) {
        // Start first note
        currentNote = {
          startTime: detection.timestamp,
          endTime: detection.timestamp,
          pitches: [midiNote],
          frequencies: [detection.frequency],
          detectionCount: 1
        };
      } else {
        const timeSinceLast = detection.timestamp - currentNote.endTime;
        const currentMedianPitch = this.getMedian(currentNote.pitches);
        const pitchDiff = Math.abs(Math.round(midiNote) - Math.round(currentMedianPitch));

        // Continue note if:
        // - Time gap < 500ms (very forgiving - merge fragments)
        // - Pitch within 1 semitone (HPS can drift slightly)
        if (timeSinceLast < 0.5 && pitchDiff < 1.0) {
          // Extend current note
          currentNote.endTime = detection.timestamp;
          currentNote.pitches.push(midiNote);
          currentNote.frequencies.push(detection.frequency);
          currentNote.detectionCount++;
        } else {
          // Note ended - save it (no duration filter yet)
          notes.push(this.finalizeNote(currentNote));

          // Start new note
          currentNote = {
            startTime: detection.timestamp,
            endTime: detection.timestamp,
            pitches: [midiNote],
            frequencies: [detection.frequency],
            detectionCount: 1
          };
        }
      }
    }

    // Save last note
    if (currentNote) {
      notes.push(this.finalizeNote(currentNote));
    }

    console.log(`First pass: ${notes.length} raw notes`);

    // STEP 2: Post-process to merge adjacent notes of same pitch
    // This catches cases where there was a brief silence/gap but it's the same sung note
    const mergedNotes = [];
    let currentMerged = null;

    for (const note of notes) {
      if (!currentMerged) {
        currentMerged = { ...note };
      } else {
        const gap = note.startTime - currentMerged.endTime;
        const pitchDiff = Math.abs(Math.round(note.midi) - Math.round(currentMerged.midi));

        // Merge if gap < 300ms and same pitch
        if (gap < 0.3 && pitchDiff < 1) {
          console.log(`Merging notes: ${currentMerged.midi.toFixed(1)} (${gap.toFixed(3)}s gap)`);
          currentMerged.endTime = note.endTime;
          currentMerged.duration = currentMerged.endTime - currentMerged.startTime;
        } else {
          mergedNotes.push(currentMerged);
          currentMerged = { ...note };
        }
      }
    }

    if (currentMerged) {
      mergedNotes.push(currentMerged);
    }

    console.log(`After merging: ${mergedNotes.length} notes`);

    // STEP 3: Filter out very short notes (< 150ms)
    const finalNotes = mergedNotes.filter(note => {
      if (note.duration < 0.15) {
        console.log(`Filtered out short note: ${note.duration.toFixed(3)}s at ${note.midi.toFixed(1)}`);
        return false;
      }
      return true;
    });

    console.log(`Final: ${finalNotes.length} notes (filtered short notes)`);
    return finalNotes;
  }

  // Helper: Get median value from array
  getMedian(arr) {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }

  // Helper: Finalize a note by using median pitch and adding realistic duration
  finalizeNote(noteData) {
    // Use median pitch to avoid outliers from vibrato/noise
    const medianPitch = this.getMedian(noteData.pitches);

    // Real duration from detections
    const duration = noteData.endTime - noteData.startTime;

    // For very stable notes (many detections over time), increase confidence
    const confidence = Math.min(noteData.detectionCount / 10, 1.0);

    const noteName = this.midiToNoteName(Math.round(medianPitch));
    console.log(`Note: ${noteName} @ ${noteData.startTime.toFixed(2)}s, dur=${duration.toFixed(2)}s, detections=${noteData.detectionCount}, conf=${confidence.toFixed(2)}`);

    return {
      startTimeSeconds: noteData.startTime,
      durationSeconds: duration,
      pitchMidi: medianPitch,
      amplitude: confidence,  // Use confidence for amplitude
      pitchBends: [],
      note: noteName,  // Add note name for rendering
      originalNote: {
        startTime: noteData.startTime,
        duration: duration,
        midiNote: medianPitch
      }
    };
  }

  // Helper: Calculate average
  average(arr) {
    return arr.reduce((sum, val) => sum + val, 0) / arr.length;
  }

  // Helper: Convert MIDI note to frequency
  midiToFrequency(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  runBasicPitch = async (audioBuffer) => {
    console.log('runBasicPitch called');

    const method = this.props.pitchDetectionMethod || 'hybrid';
    console.log(`Pitch detection method: ${method}`);

    // Cepstral+KNN: Process whole audio buffer with posterior probabilities
    if (method === 'cepstral_knn') {
      console.log('Method cepstral_knn: Processing whole audio with posterior probabilities');

      // Get raw audio data
      const audioData = audioBuffer.getChannelData(0);
      const sampleRate = audioBuffer.sampleRate;

      // Run cepstral+KNN on whole buffer
      const refinedDetections = this.detectPitchCepstralKNN(audioData, sampleRate);

      // Apply post-processing pipeline with KNN
      const processedNotes = this.postProcessDetections(refinedDetections, {
        useKNN: true,
        windowSize: 0.3,
        pitchTolerance: 0.5,
        minConfidence: 0.3,
        minNoteDuration: 0.15
      });

      // Convert to final note format
      return processedNotes.map(note => this.convertProcessedNoteToFinalFormat(note));
    }

    // For non-ONNX methods, skip ML model and use live detections only
    if (method === 'yin' || method === 'fft' || method === 'pca' || method === 'cepstral') {
      console.log(`Method ${method}: Using live detections only, skipping ONNX`);
      return this.convertLiveDetectionsToNotes();
    }

    // For ONNX and hybrid methods, run the ML model
    console.log(`Method ${method}: Running ONNX model`);

    // Ensure model is loaded
    if (!this.basicPitch) {
      console.log('BasicPitch model not loaded, initializing...');
      await this.initBasicPitchModel();
    }

    const frames = [];
    const onsets = [];
    const contours = [];

    console.log('Resampling audio buffer to 22050 Hz...');
    // Resample to 22050 Hz (required by Basic Pitch)
    const resampledBuffer = await this.resampleAudioBuffer(audioBuffer, 22050);
    console.log('Resampled buffer length:', resampledBuffer.length);

    console.log('Running BasicPitch evaluateModel...');
    // Run Basic Pitch model
    await this.basicPitch.evaluateModel(
      resampledBuffer,
      (f, o, c) => {
        frames.push(...f);
        onsets.push(...o);
        contours.push(...c);
      },
      (percent) => {
        console.log(`Basic Pitch processing: ${(percent * 100).toFixed(0)}%`);
      }
    );

    // Convert frames and onsets to notes
    const noteEvents = outputToNotesPoly(frames, onsets, 0.25, 0.25, 5);
    const notesWithPitchBends = addPitchBendsToNoteEvents(contours, noteEvents);
    let notes = noteFramesToTime(notesWithPitchBends, frames, 22050 / 256);

    // If voice mode is enabled and we have live detections, use them to smooth/filter the ML results
    if (this.props.voiceMode && this.liveDetections.length > 0) {
      console.log(`Voice mode ON: Smoothing ${notes.length} ML notes with ${this.liveDetections.length} live detections`);
      notes = this.smoothWithLiveDetections(notes);
    } else if (!this.props.voiceMode) {
      console.log(`Voice mode OFF: Using raw ONNX output (${notes.length} notes)`);
    }

    return notes;
  };

  // Smooth Basic Pitch results using live autocorrelation detections
  smoothWithLiveDetections(mlNotes) {
    if (!this.liveDetections || this.liveDetections.length === 0) {
      return mlNotes;
    }

    const smoothed = [];

    for (const mlNote of mlNotes) {
      // Store original note for visualization comparison
      const originalNote = {
        startTime: mlNote.startTimeSeconds,
        duration: mlNote.durationSeconds,
        midiNote: mlNote.pitchMidi
      };

      // Find live detections near this ML note (within 1.0s window before/after to catch delayed detections)
      const timeWindow = 1.0; // Increased from 0.5s to catch notes that start slightly early/late
      const noteStart = mlNote.startTimeSeconds;
      const noteEnd = mlNote.startTimeSeconds + mlNote.durationSeconds;

      const nearby = this.liveDetections.filter(live => {
        return live.timestamp >= noteStart - timeWindow &&
               live.timestamp <= noteEnd + timeWindow;
      });

      if (nearby.length > 0) {
        // Calculate average frequency from nearby live detections
        const avgFreq = nearby.reduce((sum, d) => sum + d.frequency, 0) / nearby.length;
        const avgMidi = this.frequencyToMidi(avgFreq);

        // If ML and live detections are close (within 3 semitones), blend them
        const midiDiff = Math.abs(mlNote.pitchMidi - avgMidi);

        if (midiDiff < 3) {
          // Close match - blend 80% ML, 20% live (trust ML more for accuracy)
          const blendedMidi = mlNote.pitchMidi * 0.8 + avgMidi * 0.2;
          smoothed.push({
            ...mlNote,
            pitchMidi: blendedMidi,
            smoothed: true,
            originalNote // Store original for debug visualization
          });
        } else if (midiDiff < 6) {
          // Moderate difference - trust ML but note the variance
          smoothed.push({
            ...mlNote,
            confidence: 0.9,
            originalNote // Store original for debug visualization
          });
        } else {
          // Large difference - might be octave error, but trust ML
          smoothed.push({
            ...mlNote,
            originalNote // Store original for debug visualization
          });
        }
      } else {
        // No nearby live detections - likely spurious detection
        // Filter out notes without any live support (they're usually artifacts/harmonics)
        console.log(`Filtering ML note without live support: ${this.midiToNoteName(mlNote.pitchMidi)} @ ${mlNote.startTimeSeconds.toFixed(2)}s (duration: ${(mlNote.durationSeconds * 1000).toFixed(0)}ms)`);
      }
    }

    // Filter out very short notes that might be artifacts (< 50ms)
    let filtered = smoothed.filter(note => note.durationSeconds >= 0.05);

    // Synthesize missing notes from continuous live detections that ML missed
    filtered = this.synthesizeMissingNotes(filtered);

    // Remove duplicate notes at the same time - keep only the note closest to previous pitch
    filtered = this.removeDuplicateNotes(filtered);

    // Apply pitch smoothing to make scales more uniform
    // ENABLED with gentle settings: 85% original + 15% median, threshold 1.0 semitones
    // This provides subtle smoothing while preserving the ONNX model predictions
    // To disable: comment out the line below
    filtered = this.smoothPitchContour(filtered);

    // Merge consecutive notes with same/similar pitch (this fixes "f-3 f-3" -> "f-3" and fills dark green gaps)
    filtered = this.mergeConsecutiveNotes(filtered);

    console.log(`Filtered ${mlNotes.length - filtered.length} artifacts, kept ${filtered.length} notes`);
    return filtered;
  };

  // Remove duplicate notes that occur at the same time, keeping the one closest to the previous note
  removeDuplicateNotes(notes) {
    if (notes.length === 0) return notes;

    // Sort by start time first
    const sorted = [...notes].sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);
    const result = [];
    let prevMidi = null;

    for (let i = 0; i < sorted.length; i++) {
      const currentNote = sorted[i];

      // Look for overlapping notes (notes that start before this one ends)
      const overlapping = [];
      overlapping.push(currentNote);

      // Check subsequent notes for overlaps
      for (let j = i + 1; j < sorted.length; j++) {
        const nextNote = sorted[j];
        const currentEnd = currentNote.startTimeSeconds + currentNote.durationSeconds;

        // If next note starts before current ends (with small tolerance), it overlaps
        if (nextNote.startTimeSeconds < currentEnd + 0.2) {
          overlapping.push(nextNote);
        } else {
          break; // No more overlaps possible
        }
      }

      if (overlapping.length === 1) {
        // No overlaps - but check if this is an exact duplicate pitch of the previous note
        if (prevMidi !== null && Math.round(currentNote.pitchMidi) === Math.round(prevMidi)) {
          // Same pitch as previous note - check if they're very close in time
          const prevNote = result[result.length - 1];
          const prevEnd = prevNote.startTimeSeconds + prevNote.durationSeconds;
          const gap = currentNote.startTimeSeconds - prevEnd;

          // If gap is tiny (< 100ms), this is likely a duplicate - skip it
          if (gap < 0.1) {
            console.log(`Skipping duplicate consecutive ${this.midiToNoteName(currentNote.pitchMidi)} at ${currentNote.startTimeSeconds.toFixed(2)}s (${(gap * 1000).toFixed(0)}ms after previous)`);
            continue; // Skip this note
          }
        }

        result.push(currentNote);
        prevMidi = currentNote.pitchMidi;
      } else {
        // Multiple overlapping notes - filter them

        // First, remove octave duplicates (same pitch class)
        const uniquePitches = new Map();
        for (const note of overlapping) {
          const pitchClass = Math.round(note.pitchMidi) % 12;
          const existing = uniquePitches.get(pitchClass);
          if (!existing || note.durationSeconds > existing.durationSeconds) {
            uniquePitches.set(pitchClass, note);
          }
        }
        let filtered = Array.from(uniquePitches.values());

        // Then, keep the one closest to previous note or longest if no previous
        let chosen;
        if (prevMidi !== null && filtered.length > 1) {
          // Keep note closest to previous pitch (melodic continuity)
          chosen = filtered[0];
          let minDiff = Math.abs(filtered[0].pitchMidi - prevMidi);

          for (let k = 1; k < filtered.length; k++) {
            const diff = Math.abs(filtered[k].pitchMidi - prevMidi);
            if (diff < minDiff) {
              minDiff = diff;
              chosen = filtered[k];
            }
          }
        } else {
          // No previous note - keep the longest one
          chosen = filtered.reduce((longest, note) =>
            note.durationSeconds > longest.durationSeconds ? note : longest
          );
        }

        result.push(chosen);
        prevMidi = chosen.pitchMidi;

        if (overlapping.length > 1) {
          console.log(`Removed ${overlapping.length - 1} overlapping notes at ${currentNote.startTimeSeconds.toFixed(1)}s, kept ${this.midiToNoteName(chosen.pitchMidi)}`);
        }

        // Skip the overlapping notes we just processed
        i += overlapping.length - 1;
      }
    }

    return result;
  };

  // Merge consecutive notes with same/similar pitch into single notes
  // Also extends notes to cover nearby live detections (dark green gaps)
  // ENSURES ONLY ONE NOTE PER TIME INTERVAL
  mergeConsecutiveNotes(notes) {
    if (notes.length === 0) return notes;
    if (notes.length === 1) {
      return [this.extendToLiveDetections(notes[0])];
    }

    // Sort by start time
    const sorted = [...notes].sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);
    const result = [];
    let currentMerged = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
      const nextNote = sorted[i];
      const currentEnd = currentMerged.startTimeSeconds + currentMerged.durationSeconds;
      const gap = nextNote.startTimeSeconds - currentEnd;
      const pitchDiff = Math.abs(Math.round(currentMerged.pitchMidi) - Math.round(nextNote.pitchMidi));

      // Check if notes overlap in time (gap is negative or very small)
      const notesOverlap = gap < 0.05; // Overlap if next note starts within 50ms of current ending

      // Check if there are live detections in the gap that match our pitch
      const hasLiveBridge = this.liveDetections && this.liveDetections.some(live => {
        const liveTime = live.timestamp;
        const liveMidi = this.frequencyToMidi(live.frequency);
        const livePitchDiff = Math.abs(Math.round(liveMidi) - Math.round(currentMerged.pitchMidi));

        // Live detection is in the gap and matches pitch EXACTLY (0 semitone difference)
        return liveTime >= currentEnd &&
               liveTime <= nextNote.startTimeSeconds &&
               livePitchDiff === 0; // Must be EXACT same pitch, not within 1 semitone
      });

      // STRICT merging: only merge notes that are EXACT same pitch
      // CRITICAL: We must respect the dark blue ML predictions - don't merge different pitches
      // 1. Notes overlap in time AND SAME PITCH (within 1 semitone)
      // 2. EXACT same pitch (0 semitone diff) AND gap < 0.5s
      // 3. EXACT same pitch AND there's a live detection bridge
      const shouldMerge = (notesOverlap && pitchDiff <= 1) ||
                          (pitchDiff === 0 && gap < 0.5) ||
                          (pitchDiff === 0 && hasLiveBridge);

      // DEBUG: Log merge decisions
      if (shouldMerge) {
        const reason = notesOverlap && pitchDiff <= 1 ? 'overlap+same-pitch' :
                       pitchDiff === 0 && gap < 0.5 ? 'exact-pitch+close-time' :
                       'exact-pitch+live-bridge';
        console.log(`🔗 MERGE ${this.midiToNoteName(currentMerged.pitchMidi)} + ${this.midiToNoteName(nextNote.pitchMidi)} (reason: ${reason}, gap: ${(gap*1000).toFixed(0)}ms, pitch diff: ${pitchDiff})`);
      } else {
        console.log(`⛔ NO MERGE ${this.midiToNoteName(currentMerged.pitchMidi)} → ${this.midiToNoteName(nextNote.pitchMidi)} (gap: ${(gap*1000).toFixed(0)}ms, pitch diff: ${pitchDiff}, overlap: ${notesOverlap})`);
      }

      if (shouldMerge) {
        // If pitches differ significantly, choose based on live detection support
        if (pitchDiff > 1 && notesOverlap) {
          // Overlapping but different pitches - use live detections to decide which to keep
          const overlapStart = nextNote.startTimeSeconds;
          const overlapEnd = Math.min(currentEnd, nextNote.startTimeSeconds + nextNote.durationSeconds);

          // Count live detections during overlap that support each note
          const currentSupport = this.liveDetections ? this.liveDetections.filter(live => {
            const liveTime = live.timestamp;
            const liveMidi = Math.round(this.frequencyToMidi(live.frequency));
            const pitchDiff = Math.abs(liveMidi - Math.round(currentMerged.pitchMidi));
            return liveTime >= overlapStart && liveTime <= overlapEnd && pitchDiff <= 1;
          }).length : 0;

          const nextSupport = this.liveDetections ? this.liveDetections.filter(live => {
            const liveTime = live.timestamp;
            const liveMidi = Math.round(this.frequencyToMidi(live.frequency));
            const pitchDiff = Math.abs(liveMidi - Math.round(nextNote.pitchMidi));
            return liveTime >= overlapStart && liveTime <= overlapEnd && pitchDiff <= 1;
          }).length : 0;

          // Keep the note with more live detection support (or closest pitch if tied)
          if (nextSupport > currentSupport) {
            console.log(`Overlap: Replacing ${this.midiToNoteName(currentMerged.pitchMidi)} with ${this.midiToNoteName(nextNote.pitchMidi)} (live support: ${currentSupport} vs ${nextSupport})`);
            currentMerged = nextNote;
          } else if (nextSupport === currentSupport && nextSupport > 0) {
            // Tied - find closest live detection pitch
            const liveInOverlap = this.liveDetections.filter(live => {
              const liveTime = live.timestamp;
              return liveTime >= overlapStart && liveTime <= overlapEnd;
            });
            if (liveInOverlap.length > 0) {
              const avgLiveMidi = liveInOverlap.reduce((sum, live) =>
                sum + this.frequencyToMidi(live.frequency), 0) / liveInOverlap.length;
              const currentDiff = Math.abs(Math.round(currentMerged.pitchMidi) - Math.round(avgLiveMidi));
              const nextDiff = Math.abs(Math.round(nextNote.pitchMidi) - Math.round(avgLiveMidi));
              if (nextDiff < currentDiff) {
                console.log(`Overlap: Replacing ${this.midiToNoteName(currentMerged.pitchMidi)} with ${this.midiToNoteName(nextNote.pitchMidi)} (closer to live pitch)`);
                currentMerged = nextNote;
              } else {
                console.log(`Overlap: Keeping ${this.midiToNoteName(currentMerged.pitchMidi)} over ${this.midiToNoteName(nextNote.pitchMidi)} (closer to live pitch)`);
                // Extend current to cover next if needed
                const nextEnd = nextNote.startTimeSeconds + nextNote.durationSeconds;
                if (nextEnd > currentEnd) {
                  currentMerged = {
                    ...currentMerged,
                    durationSeconds: nextEnd - currentMerged.startTimeSeconds,
                    merged: true,
                    originalNote: currentMerged.originalNote // Preserve original unchanged
                  };
                }
              }
            } else {
              console.log(`Overlap: Keeping ${this.midiToNoteName(currentMerged.pitchMidi)} over ${this.midiToNoteName(nextNote.pitchMidi)} (no live support for either)`);
            }
          } else {
            console.log(`Overlap: Keeping ${this.midiToNoteName(currentMerged.pitchMidi)} over ${this.midiToNoteName(nextNote.pitchMidi)} (live support: ${currentSupport} vs ${nextSupport})`);
            // Extend current to cover next if needed
            const nextEnd = nextNote.startTimeSeconds + nextNote.durationSeconds;
            if (nextEnd > currentEnd) {
              currentMerged = {
                ...currentMerged,
                durationSeconds: nextEnd - currentMerged.startTimeSeconds,
                merged: true,
                originalNote: currentMerged.originalNote // Preserve original unchanged
              };
            }
          }
        } else {
          // Same pitch or close - merge them
          const mergedEnd = Math.max(
            currentEnd,
            nextNote.startTimeSeconds + nextNote.durationSeconds
          );
          currentMerged = {
            ...currentMerged,
            durationSeconds: mergedEnd - currentMerged.startTimeSeconds,
            merged: true,
            originalNote: currentMerged.originalNote // Preserve original unchanged
          };
          console.log(`Merged ${this.midiToNoteName(currentMerged.pitchMidi)} with next note (gap: ${(gap * 1000).toFixed(0)}ms, pitch diff: ${pitchDiff} semitones${hasLiveBridge ? ', has live bridge' : ''})`);
        }
      } else {
        // Before pushing, extend edges if there are live detections nearby
        currentMerged = this.extendToLiveDetections(currentMerged);
        result.push(currentMerged);
        currentMerged = nextNote;
      }
    }

    // Extend final note to live detections too
    currentMerged = this.extendToLiveDetections(currentMerged);
    result.push(currentMerged);

    console.log(`Merge complete: ${sorted.length} notes → ${result.length} notes`);
    return result;
  };

  // Extend a note's start/end times to cover nearby live detections of EXACT SAME pitch
  // CRITICAL: Dark blue boxes (originalNote) are ground truth - only extend if matching their pitch
  extendToLiveDetections(note) {
    if (!this.liveDetections || this.liveDetections.length === 0) return note;

    const noteEnd = note.startTimeSeconds + note.durationSeconds;
    // Use the ORIGINAL note's pitch for matching, not the potentially smoothed pitch
    const originalPitch = note.originalNote ? note.originalNote.midiNote : note.pitchMidi;
    const noteMidi = Math.round(originalPitch);
    const tolerance = 0.3; // Time tolerance for nearby detections

    let newStart = note.startTimeSeconds;
    let newEnd = noteEnd;

    // Find live detections near the start - MUST be exact same note with VERY strict frequency matching
    const nearStart = this.liveDetections.filter(live => {
      const liveTime = live.timestamp;
      const liveMidi = this.frequencyToMidi(live.frequency);
      const liveMidiRounded = Math.round(liveMidi);

      // Live detection is before note start, within tolerance, and EXACT same pitch
      // Use 0.15 semitone tolerance (15 cents) to prevent ANY pitch mismatches
      return liveTime < note.startTimeSeconds &&
             liveTime >= note.startTimeSeconds - tolerance &&
             liveMidiRounded === noteMidi &&
             Math.abs(liveMidi - originalPitch) < 0.15; // VERY strict: within 15 cents
    });

    // Find live detections near the end - MUST be exact same note with VERY strict frequency matching
    const nearEnd = this.liveDetections.filter(live => {
      const liveTime = live.timestamp;
      const liveMidi = this.frequencyToMidi(live.frequency);
      const liveMidiRounded = Math.round(liveMidi);

      const timeMatch = liveTime > noteEnd && liveTime <= noteEnd + tolerance;
      const roundedMatch = liveMidiRounded === noteMidi;
      const centsMatch = Math.abs(liveMidi - originalPitch) < 0.15;

      // DEBUG: Log what's happening
      if (timeMatch && roundedMatch && !centsMatch) {
        console.log(`⚠️ REJECTED live detection for ${this.midiToNoteName(originalPitch)}: liveMidi=${liveMidi.toFixed(2)} (${this.midiToNoteName(liveMidi)}), diff=${Math.abs(liveMidi - originalPitch).toFixed(3)} semitones (> 0.15)`);
      }

      // Live detection is after note end, within tolerance, and EXACT same pitch
      // Use 0.15 semitone tolerance (15 cents) to prevent ANY pitch mismatches
      return timeMatch && roundedMatch && centsMatch;
    });

    // Extend to earliest live detection before start
    if (nearStart.length > 0) {
      const earliestStart = Math.min(...nearStart.map(l => l.timestamp));
      if (earliestStart < newStart) {
        newStart = earliestStart;
        console.log(`Extended ${this.midiToNoteName(note.pitchMidi)} start by ${((note.startTimeSeconds - earliestStart) * 1000).toFixed(0)}ms to cover ${nearStart.length} exact-pitch live detections`);
      }
    }

    // Extend to latest live detection after end
    if (nearEnd.length > 0) {
      const latestEnd = Math.max(...nearEnd.map(l => l.timestamp));
      if (latestEnd > newEnd) {
        newEnd = latestEnd;
        console.log(`Extended ${this.midiToNoteName(note.pitchMidi)} end by ${((latestEnd - noteEnd) * 1000).toFixed(0)}ms to cover ${nearEnd.length} exact-pitch live detections`);
      }
    }

    // IMPORTANT: Preserve originalNote unchanged - it should always reflect the true original ML prediction
    return {
      ...note,
      startTimeSeconds: newStart,
      durationSeconds: newEnd - newStart,
      extended: newStart !== note.startTimeSeconds || newEnd !== noteEnd,
      originalNote: note.originalNote // Explicitly preserve original, don't let spread operator create a new reference
    };
  };

  // Synthesize missing notes from continuous live detections that ML model missed
  synthesizeMissingNotes(mlNotes) {
    if (!this.liveDetections || this.liveDetections.length === 0) {
      console.log('No live detections available for synthesis');
      return mlNotes;
    }

    console.log(`Synthesizing missing notes from ${this.liveDetections.length} live detections`);

    // Sort ML notes by time
    const sortedMLNotes = [...mlNotes].sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);

    // Find gaps between ML notes where we might need to synthesize
    const gaps = [];

    // Gap before first note
    if (sortedMLNotes.length > 0 && sortedMLNotes[0].startTimeSeconds > 0.5) {
      gaps.push({
        start: 0,
        end: sortedMLNotes[0].startTimeSeconds
      });
    }

    // Gaps between notes (use original ML boundaries, not extended boundaries)
    for (let i = 0; i < sortedMLNotes.length - 1; i++) {
      const currentNote = sortedMLNotes[i];
      const nextNote = sortedMLNotes[i + 1];

      // Use originalNote boundaries if available, otherwise use current boundaries
      const currentEnd = currentNote.originalNote
        ? (currentNote.originalNote.startTime + currentNote.originalNote.duration)
        : (currentNote.startTimeSeconds + currentNote.durationSeconds);
      const nextStart = nextNote.originalNote
        ? nextNote.originalNote.startTime
        : nextNote.startTimeSeconds;

      const gapSize = nextStart - currentEnd;

      // Only consider significant gaps (> 100ms)
      if (gapSize > 0.1) {
        gaps.push({
          start: currentEnd,
          end: nextStart
        });
      }
    }

    console.log(`Found ${gaps.length} gaps to check for synthesis`);

    // For each gap, look for continuous sequences of live detections
    const synthesizedNotes = [];

    gaps.forEach((gap, gapIndex) => {
      // Get live detections in this gap
      const liveInGap = this.liveDetections.filter(live =>
        live.timestamp >= gap.start && live.timestamp <= gap.end
      );

      if (liveInGap.length === 0) return;

      console.log(`Gap ${gapIndex} (${gap.start.toFixed(2)}s - ${gap.end.toFixed(2)}s): ${liveInGap.length} live detections`);

      // Group consecutive live detections by pitch (within 1 semitone) and time proximity (< 150ms gap)
      const clusters = [];
      let currentCluster = null;

      liveInGap.sort((a, b) => a.timestamp - b.timestamp);

      liveInGap.forEach((live) => {
        const liveMidi = this.frequencyToMidi(live.frequency);

        if (!currentCluster) {
          // Start new cluster
          currentCluster = {
            detections: [live],
            startTime: live.timestamp,
            endTime: live.timestamp,
            pitches: [liveMidi]
          };
        } else {
          const timeSinceLast = live.timestamp - currentCluster.endTime;
          const avgPitch = currentCluster.pitches.reduce((sum, p) => sum + p, 0) / currentCluster.pitches.length;
          const pitchDiff = Math.abs(Math.round(liveMidi) - Math.round(avgPitch));

          // Continue cluster if time gap < 150ms and pitch is similar (within 1 semitone)
          if (timeSinceLast < 0.15 && pitchDiff <= 1) {
            currentCluster.detections.push(live);
            currentCluster.endTime = live.timestamp;
            currentCluster.pitches.push(liveMidi);
          } else {
            // Cluster ended, save it and start new one
            clusters.push(currentCluster);
            currentCluster = {
              detections: [live],
              startTime: live.timestamp,
              endTime: live.timestamp,
              pitches: [liveMidi]
            };
          }
        }
      });

      // Don't forget the last cluster
      if (currentCluster) {
        clusters.push(currentCluster);
      }

      console.log(`  Found ${clusters.length} live detection clusters in this gap`);

      // Create synthetic notes from clusters that are long enough (> 50ms minimum)
      clusters.forEach((cluster, clusterIndex) => {
        const duration = cluster.endTime - cluster.startTime;

        // Accept single detections if they're isolated (in a gap)
        // OR require 2+ detections, OR duration > 50ms for a valid note
        if (cluster.detections.length >= 1) {
          // Calculate median pitch for the cluster
          const sortedPitches = [...cluster.pitches].sort((a, b) => a - b);
          const medianPitch = sortedPitches[Math.floor(sortedPitches.length / 2)];

          // Create synthetic note with extended duration to cover the whole cluster
          const syntheticNote = {
            startTimeSeconds: cluster.startTime,
            durationSeconds: Math.max(duration, 0.1), // At least 100ms
            pitchMidi: medianPitch,
            synthesized: true,
            liveDetectionCount: cluster.detections.length,
            // Synthetic notes need an originalNote for debug visualization
            // Use the note itself as the "original" since there's no ML prediction
            originalNote: {
              startTime: cluster.startTime,
              duration: Math.max(duration, 0.1),
              midiNote: medianPitch
            }
          };

          synthesizedNotes.push(syntheticNote);
          console.log(`  Created synthetic note: ${this.midiToNoteName(medianPitch)} @ ${cluster.startTime.toFixed(2)}s, duration: ${(duration * 1000).toFixed(0)}ms (${cluster.detections.length} live detections)`);
        } else {
          console.log(`  Skipped cluster ${clusterIndex}: too short (${(duration * 1000).toFixed(0)}ms, ${cluster.detections.length} detections)`);
        }
      });
    });

    console.log(`Synthesized ${synthesizedNotes.length} missing notes from live detections`);

    // Combine original ML notes with synthesized notes
    return [...mlNotes, ...synthesizedNotes];
  }

  // Smooth pitch contour using median filtering for cleaner scales
  smoothPitchContour(notes) {
    if (notes.length < 3) return notes;

    const result = [];
    const sorted = [...notes].sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);

    for (let i = 0; i < sorted.length; i++) {
      const note = sorted[i];

      // For notes in the middle, apply median filtering with neighbors
      if (i > 0 && i < sorted.length - 1) {
        const prevNote = sorted[i - 1];
        const nextNote = sorted[i + 1];

        // Get the three pitches
        const pitches = [prevNote.pitchMidi, note.pitchMidi, nextNote.pitchMidi];
        pitches.sort((a, b) => a - b);
        const medianPitch = pitches[1]; // Middle value

        // If current note differs significantly from median, adjust it SLIGHTLY
        const diff = Math.abs(note.pitchMidi - medianPitch);
        // Increased threshold from 0.5 to 1.0 (only smooth if difference is >= 1 semitone)
        // Reduced smoothing strength: 85% original + 15% median (was 40% + 60%)
        if (diff > 1.0 && diff < 3) {
          // Very gentle smoothing to preserve ONNX predictions
          const smoothedPitch = note.pitchMidi * 0.85 + medianPitch * 0.15;
          result.push({
            ...note,
            pitchMidi: smoothedPitch,
            smoothedPitch: true
          });
          console.log(`Smoothed ${this.midiToNoteName(note.pitchMidi)} → ${this.midiToNoteName(smoothedPitch)}`);
        } else {
          result.push(note);
        }
      } else {
        // Keep first and last notes as-is
        result.push(note);
      }
    }

    return result;
  };

  processFile = async (file) => {
    try {
      console.log(`Processing file: ${file.name} (${file.size} bytes)`);

      // Read the file as an ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();

      // Create an AudioContext and decode the audio data
      const tempAudioContext = new AudioContext();
      const audioBuffer = await tempAudioContext.decodeAudioData(arrayBuffer);

      console.log(`AudioBuffer duration: ${audioBuffer.duration}s, sample rate: ${audioBuffer.sampleRate}Hz`);

      // Run Basic Pitch inference
      console.log('Running Basic Pitch model on uploaded file...');
      const notes = await this.runBasicPitch(audioBuffer);

      console.log(`✓ Basic Pitch detected ${notes.length} notes from file`);

      // Convert Basic Pitch notes to our format
      notes.forEach((note, index) => {
        const { startTimeSeconds, durationSeconds, pitchMidi, amplitude, originalNote, synthesized } = note;

        const noteData = {
          note: this.midiToNoteName(pitchMidi),
          frequency: this.midiToFrequency(pitchMidi),
          startTime: startTimeSeconds,
          duration: durationSeconds,
          midiNote: Math.round(pitchMidi),
          amplitude: amplitude,
          originalNote: originalNote, // Include original ML prediction for visualization
          synthesized: synthesized, // Mark if this was synthesized from live detections
        };

        // Send each detected note to the parent component
        console.log(`Note ${index + 1}/${notes.length}: ${noteData.note} @ ${startTimeSeconds.toFixed(2)}s, ${durationSeconds.toFixed(2)}s, ${noteData.frequency.toFixed(1)} Hz${synthesized ? ' (synthesized)' : ''}`);
        this.props.onNoteDetected?.(noteData);
      });

      await tempAudioContext.close();

      // Signal that processing is complete
      console.log('✓ File processing complete');
      this.props.onProcessingComplete?.();

    } catch (error) {
      console.error('File processing error:', error);
      this.props.onProcessingComplete?.();
      throw error;
    }
  };

  processRecording = async () => {
    try {
      console.log('Processing audio with Basic Pitch...');

      // Convert audio chunks to blob
      const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
      console.log(`Audio blob size: ${audioBlob.size} bytes`);

      // Send audio blob to parent if callback exists
      this.props.onAudioCaptured?.(audioBlob);

      // Convert blob to AudioBuffer
      const arrayBuffer = await audioBlob.arrayBuffer();
      const tempAudioContext = new AudioContext();
      const audioBuffer = await tempAudioContext.decodeAudioData(arrayBuffer);
      console.log(`AudioBuffer duration: ${audioBuffer.duration}s, sample rate: ${audioBuffer.sampleRate}Hz`);

      // Run Basic Pitch inference
      console.log('Running Basic Pitch model...');
      const notes = await this.runBasicPitch(audioBuffer);

      console.log(`✓ Basic Pitch detected ${notes.length} notes`);

      // Convert Basic Pitch notes to our format
      notes.forEach((note, index) => {
        const { startTimeSeconds, durationSeconds, pitchMidi, amplitude, originalNote, synthesized } = note;

        const noteData = {
          note: this.midiToNoteName(pitchMidi),
          frequency: this.midiToFrequency(pitchMidi),
          startTime: startTimeSeconds,
          duration: durationSeconds,
          midiNote: Math.round(pitchMidi),
          amplitude: amplitude,
          originalNote: originalNote, // Include original ML prediction for visualization
          synthesized: synthesized, // Mark if this was synthesized from live detections
        };

        // Send each detected note to the parent component
        console.log(`Note ${index + 1}/${notes.length}: ${noteData.note} @ ${startTimeSeconds.toFixed(2)}s, ${durationSeconds.toFixed(2)}s, ${noteData.frequency.toFixed(1)} Hz${synthesized ? ' (synthesized)' : ''}`);
        this.props.onNoteDetected?.(noteData);
      });

      await tempAudioContext.close();

      // Signal that processing is complete
      console.log('✓ Processing complete');
      this.props.onProcessingComplete?.();

    } catch (error) {
      console.error('Basic Pitch processing error:', error);
      this.props.onProcessingComplete?.();
      throw error;
    }
  };

  // Process recording from React Native AudioRecorder buffers
  processRecordingFromBuffers = async () => {
    try {
      console.log('Processing audio from buffers with Basic Pitch...');
      console.log(`Recorded ${this.recordedBuffers.length} audio buffers`);

      if (this.recordedBuffers.length === 0) {
        console.warn('No audio buffers recorded');
        this.props.onProcessingComplete?.();
        return;
      }

      // Concatenate all buffers into a single AudioBuffer
      const firstBuffer = this.recordedBuffers[0];
      const totalLength = this.recordedBuffers.reduce((sum, buf) => sum + buf.length, 0);
      const sampleRate = firstBuffer.sampleRate;
      const numberOfChannels = firstBuffer.numberOfChannels;

      console.log(`Creating combined buffer: ${totalLength} samples, ${sampleRate}Hz, ${numberOfChannels} channels`);

      // Create a new offline context to build the combined buffer
      const tempAudioContext = new AudioContext();
      const combinedBuffer = tempAudioContext.createBuffer(numberOfChannels, totalLength, sampleRate);

      // Copy all buffer data into combined buffer
      let offset = 0;
      for (const buffer of this.recordedBuffers) {
        for (let channel = 0; channel < numberOfChannels; channel++) {
          const sourceData = buffer.getChannelData(channel);
          const destData = combinedBuffer.getChannelData(channel);
          destData.set(sourceData, offset);
        }
        offset += buffer.length;
      }

      console.log(`Combined AudioBuffer duration: ${combinedBuffer.duration}s`);

      // Convert to blob for parent component (if needed)
      // Note: We skip blob creation for React Native since we already have the AudioBuffer
      this.props.onAudioCaptured?.(combinedBuffer);

      // Run Basic Pitch inference
      console.log('Running Basic Pitch model...');
      const notes = await this.runBasicPitch(combinedBuffer);

      console.log(`✓ Basic Pitch detected ${notes.length} notes`);

      // Convert Basic Pitch notes to our format
      notes.forEach((note, index) => {
        const { startTimeSeconds, durationSeconds, pitchMidi, amplitude, originalNote, synthesized } = note;

        const noteData = {
          note: this.midiToNoteName(pitchMidi),
          frequency: this.midiToFrequency(pitchMidi),
          startTime: startTimeSeconds,
          duration: durationSeconds,
          midiNote: Math.round(pitchMidi),
          amplitude: amplitude,
          originalNote: originalNote,
          synthesized: synthesized,
        };

        console.log(`Note ${index + 1}/${notes.length}: ${noteData.note} @ ${startTimeSeconds.toFixed(2)}s, ${durationSeconds.toFixed(2)}s, ${noteData.frequency.toFixed(1)} Hz${synthesized ? ' (synthesized)' : ''}`);
        this.props.onNoteDetected?.(noteData);
      });

      await tempAudioContext.close();

      // Signal that processing is complete
      console.log('✓ Processing complete');
      this.props.onProcessingComplete?.();

    } catch (error) {
      console.error('Buffer processing error:', error);
      this.props.onProcessingComplete?.();
      throw error;
    }
  };

  midiToFrequency = (midi) => {
    return 440 * Math.pow(2, (midi - 69) / 12);
  };

  midiToNoteName = (midi) => {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const midiRounded = Math.round(midi);
    const octave = Math.floor((midiRounded - 12) / 12);
    const noteName = noteNames[midiRounded % 12];
    return `${noteName}${octave}`;
  };

  noteToMidi = (note) => {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const match = note.match(/^([A-G]#?)(-?\d+)$/);
    if (!match) return 60; // Default to middle C

    const [, noteName, octaveStr] = match;
    const octave = parseInt(octaveStr);
    const noteIndex = noteNames.indexOf(noteName);

    return (octave + 1) * 12 + noteIndex;
  };

  render() {
    return null; // Headless component
  }
}

export default PitchDetector;
