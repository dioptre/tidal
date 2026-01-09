// Mock module for react-native-audio-api on web
// This is imported when webpack tries to resolve react-native-audio-api
// The actual import is guarded by Platform.OS !== 'web' so this should never execute

export const AudioContext = null;
export const OfflineAudioContext = null;
export const AudioRecorder = null;
export const RecorderAdapterNode = null;
export const AudioManager = null;
