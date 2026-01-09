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
          console.log('TensorFlow.js backend ready:', tf.getBackend());

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
      console.log('PitchDetector.start() called');
      console.log('Platform:', Platform.OS);

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

          // Only run live pitch detection in voice mode
          if (this.props.voiceMode) {
            const detection = this.detectPitchAutocorrelation(inputData, this.audioContext.sampleRate);

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
            // In raw mode, send FFT data for visualization
            const bufferLength = this.analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            this.analyser.getByteFrequencyData(dataArray);

            // Send FFT data to visualizer (throttled to every frame)
            this.props.onFFTData?.(dataArray);
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

        // Set up callback to capture audio data
        this.audioRecorder.onAudioReady((event) => {
          const { buffer, numFrames } = event;
          console.log('AudioRecorder buffer ready:', buffer.duration, 'seconds,', numFrames, 'frames');
          if (buffer && buffer.length > 0) {
            this.recordedBuffers.push(buffer);
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

  runBasicPitch = async (audioBuffer) => {
    console.log('runBasicPitch called');

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
    // DISABLED: Pitch smoothing causes final notes (colorful) to differ from ONNX predictions (dark blue)
    // The ONNX model output should be treated as ground truth and displayed as-is
    // To re-enable: uncomment line below. Current settings are gentle (85% original + 15% median, threshold 1.0 semitones)
    // filtered = this.smoothPitchContour(filtered);

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
