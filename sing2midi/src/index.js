import { AppRegistry } from 'react-native';
import App from './App.jsx';

AppRegistry.registerComponent('Sing2MIDI', () => App);
AppRegistry.runApplication('Sing2MIDI', {
  rootTag: document.getElementById('root'),
});
