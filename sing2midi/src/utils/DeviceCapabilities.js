/**
 * Device Capabilities Detection
 * Detects GPU, platform, and TensorFlow backend capabilities
 * Recommends optimal pitch detection method based on device
 */

import { Platform } from 'react-native';
import Logger from './Logger';

class DeviceCapabilities {
  /**
   * Detect GPU and TensorFlow backend capabilities
   * @returns {Promise<Object>} Device capabilities
   */
  static async detectCapabilities() {
    Logger.log('Detecting device capabilities...');

    try {
      if (Platform.OS === 'web') {
        return await this.detectWebCapabilities();
      } else {
        return await this.detectNativeCapabilities();
      }
    } catch (error) {
      Logger.error('Failed to detect capabilities:', error);
      // Fallback to safe defaults
      return {
        hasGPU: false,
        backend: 'cpu',
        platform: Platform.OS,
        recommendedMethod: 'yin',
        reason: 'Detection failed, using safe defaults'
      };
    }
  }

  /**
   * Detect capabilities on web platform
   * @returns {Promise<Object>} Web capabilities
   */
  static async detectWebCapabilities() {
    const tf = require('@tensorflow/tfjs');

    // Wait for TensorFlow to initialize
    await tf.ready();

    const backend = tf.getBackend();
    Logger.log('TensorFlow backend:', backend);

    // Check for WebGL/WebGPU support (GPU acceleration)
    let hasGPU = false;
    let gpuDetails = null;

    if (backend === 'webgl') {
      // WebGL is available - check version
      const webglVersion = tf.env().getNumber('WEBGL_VERSION');
      hasGPU = webglVersion > 0;
      gpuDetails = `WebGL ${webglVersion}`;
      Logger.log(`WebGL version: ${webglVersion}`);
    } else if (backend === 'webgpu') {
      // WebGPU is available (cutting edge)
      hasGPU = true;
      gpuDetails = 'WebGPU';
      Logger.log('WebGPU detected');
    } else if (backend === 'cpu' || backend === 'wasm') {
      // CPU or WASM backend - no GPU
      hasGPU = false;
      gpuDetails = backend.toUpperCase();
      Logger.log(`CPU-only backend: ${backend}`);
    }

    // Additional check: WebGPU API availability
    const hasWebGPUAPI = typeof navigator !== 'undefined' && 'gpu' in navigator;
    if (hasWebGPUAPI && !hasGPU) {
      Logger.log('WebGPU API available but not enabled in TensorFlow');
    }

    const recommendedMethod = hasGPU ? 'hybrid' : 'cepstral';

    Logger.log(`Web capabilities: GPU=${hasGPU}, Backend=${backend}, Recommended=${recommendedMethod}`);

    return {
      hasGPU,
      backend,
      gpuDetails,
      platform: 'web',
      recommendedMethod,
      reason: hasGPU
        ? `GPU detected (${gpuDetails}), using hybrid ONNX+YIN for best quality`
        : `No GPU (${backend}), using cepstral analysis for robust pitch detection`
    };
  }

  /**
   * Detect capabilities on React Native (iOS/Android)
   * @returns {Promise<Object>} Native capabilities
   */
  static async detectNativeCapabilities() {
    const tf = require('@tensorflow/tfjs');
    require('@tensorflow/tfjs-react-native');

    // Wait for TensorFlow to initialize
    await tf.ready();

    const backend = tf.getBackend();
    Logger.log('TensorFlow RN backend:', backend);

    // On iOS/Android, tfjs-react-native typically uses CPU backend
    // GPU support exists but is often slower than CPU (especially in simulator)
    // We'll check if it's actually fast enough

    let hasGPU = false;
    let recommendedMethod = 'yin';
    let reason = '';

    // Check if we're in a simulator (iOS Simulator runs very slowly with ONNX)
    const isSimulator = await this.isRunningInSimulator();

    if (isSimulator) {
      hasGPU = false;
      recommendedMethod = 'cepstral';
      reason = 'iOS Simulator detected, using cepstral for robust detection';
      Logger.log('Running in iOS Simulator - using cepstral for accuracy');
    } else {
      // Real device - tfjs-react-native can use GPU on some devices
      // Check backend to see if GPU is available
      if (backend === 'webgl' || backend === 'gpu') {
        hasGPU = true;
        recommendedMethod = 'hybrid';
        reason = `GPU backend detected (${backend}), using hybrid ONNX+YIN`;
        Logger.log(`Real device with GPU backend: ${backend}`);
      } else {
        hasGPU = false;
        recommendedMethod = 'cepstral';
        reason = `CPU backend (${backend}), using cepstral for robust detection`;
        Logger.log(`Real device with CPU backend: ${backend}`);
      }
    }

    return {
      hasGPU,
      backend,
      gpuDetails: backend,
      platform: Platform.OS,
      isSimulator,
      recommendedMethod,
      reason
    };
  }

  /**
   * Check if running in iOS Simulator (heuristic-based)
   * @returns {Promise<boolean>} True if running in simulator
   */
  static async isRunningInSimulator() {
    if (Platform.OS !== 'ios') {
      return false;
    }

    // On iOS, we can use Platform.isPad, Platform.isTVOS, but not .isSimulator
    // Heuristic: Check if DeviceInfo is available (common in RN apps)
    // For now, we'll assume false (real device) and let TF backend tell us

    // TODO: Could use react-native-device-info if available
    // For now, rely on backend detection

    return false;
  }

  /**
   * Get human-readable description of detection method
   * @param {string} method - Detection method ('yin', 'pca', 'fft', 'cepstral', 'onnx', 'hybrid')
   * @returns {Object} Method description
   */
  static getMethodDescription(method) {
    const descriptions = {
      raw: {
        name: 'Raw (No Detection)',
        description: 'Show frequency spectrum only, no pitch detection',
        speed: 'instant',
        accuracy: 'n/a',
        gpuRequired: false
      },
      yin: {
        name: 'YIN (Autocorrelation)',
        description: 'Fast real-time pitch detection using autocorrelation. Best for low-end devices.',
        speed: 'very fast',
        accuracy: 'good',
        gpuRequired: false
      },
      pca: {
        name: 'Spectral PCA',
        description: 'Temporal averaging with HPS. Good for vibrato and pitch stability.',
        speed: 'moderate',
        accuracy: 'good',
        gpuRequired: false
      },
      fft: {
        name: 'FFT+HPS',
        description: 'Harmonic Product Spectrum. Finds fundamental frequency, avoids harmonics.',
        speed: 'fast',
        accuracy: 'good',
        gpuRequired: false
      },
      cepstral: {
        name: 'Cepstral Analysis',
        description: 'Separates pitch from vocal formants. Robust against harmonics and noise.',
        speed: 'moderate',
        accuracy: 'very good',
        gpuRequired: false
      },
      cepstral_knn: {
        name: 'Cepstral+KNN (Posterior)',
        description: 'Cepstral analysis with Bayesian posterior probabilities using past/future context. Highest accuracy for singing.',
        speed: 'slower',
        accuracy: 'excellent',
        gpuRequired: false
      },
      onnx: {
        name: 'ONNX (ML Model Only)',
        description: 'Spotify BasicPitch neural network only. High accuracy but slow without GPU.',
        speed: 'slow',
        accuracy: 'excellent',
        gpuRequired: true
      },
      hybrid: {
        name: 'Hybrid (YIN + ONNX)',
        description: 'Combines real-time YIN with ML post-processing. Best quality, requires GPU.',
        speed: 'moderate',
        accuracy: 'excellent',
        gpuRequired: true
      }
    };

    return descriptions[method] || descriptions.hybrid;
  }

  /**
   * Validate if a method is suitable for current device
   * @param {string} method - Detection method
   * @param {Object} capabilities - Device capabilities
   * @returns {Object} Validation result
   */
  static validateMethod(method, capabilities) {
    const methodDesc = this.getMethodDescription(method);

    if (methodDesc.gpuRequired && !capabilities.hasGPU) {
      return {
        valid: false,
        warning: `${methodDesc.name} requires GPU acceleration. Your device uses ${capabilities.backend} backend. Performance may be poor.`,
        suggestion: 'Consider using YIN or FFT instead for better performance.'
      };
    }

    return {
      valid: true,
      warning: null,
      suggestion: null
    };
  }
}

export default DeviceCapabilities;
