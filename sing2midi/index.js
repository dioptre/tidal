/**
 * @format
 */

// IMPORTANT: Import fetch polyfill before anything else
import 'whatwg-fetch';

import { AppRegistry, Platform } from 'react-native';
import App from './src/App';
import { name as appName } from './app.json';

// Initialize TensorFlow.js for React Native
if (Platform.OS !== 'web') {
  // Import TensorFlow.js and React Native platform
  const tf = require('@tensorflow/tfjs');
  require('@tensorflow/tfjs-react-native');

  // Set up TensorFlow backend for React Native
  (async () => {
    try {
      console.log('Initializing TensorFlow.js React Native backend...');
      await tf.ready();
      console.log('TensorFlow.js backend ready:', tf.getBackend());
    } catch (error) {
      console.error('Failed to initialize TensorFlow.js:', error);
    }
  })();
}

AppRegistry.registerComponent(appName, () => App);
