import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Animated, Image, Platform } from 'react-native';
import PitchDetector from './components/PitchDetector.jsx';
import NoteVisualizerWrapper from './components/NoteVisualizerWrapper.jsx';
import CopyDialog from './components/CopyDialog.jsx';
import SettingsPanel from './components/SettingsPanel.jsx';
import TidalGenerator from './utils/TidalGenerator';
import MIDIExporter from './utils/MIDIExporter';
import Storage from './utils/Storage';
import Settings from './utils/Settings';
import Logger from './utils/Logger';
import * as Colors from './styles/colors';
import { getAssetSource } from './config';

// Import AudioContext for both platforms
let AudioContext;
if (Platform.OS !== 'web') {
  const AudioAPI = require('react-native-audio-api');
  AudioContext = AudioAPI.AudioContext;
} else {
  AudioContext = window.AudioContext || window.webkitAudioContext;
}
import {
  ListMusicIcon,
  PlayIcon,
  SquareIcon,
  KeyboardMusicIcon,
  Trash2Icon,
  RotateCcwIcon,
  UploadIcon,
  DownloadIcon,
  WaveformIcon,
  MenuIcon,
  CircleHelpIcon
} from './components/Icons.jsx';

// Debug mode: Show live detections (green) vs ML predictions (blue) side-by-side
const DEBUG_SHOW_COMPARISON = false;

export default function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [notes, setNotes] = useState([]);
  const [tidalCode, setTidalCode] = useState('');
  const [strudelCode, setStrudelCode] = useState('');
  const [noteNames, setNoteNames] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [playheadPosition, setPlayheadPosition] = useState(null); // Playback position in seconds
  const [isPlayingAudio, setIsPlayingAudio] = useState(false); // Track recorded audio playback
  const [voiceMode, setVoiceMode] = useState(true); // Toggle for voice-optimized mode
  const [dialogVisible, setDialogVisible] = useState(false);
  const [dialogContent, setDialogContent] = useState({ title: '', content: '' });
  const [currentLiveNote, setCurrentLiveNote] = useState(null); // Current note being detected live
  const [settingsPanelVisible, setSettingsPanelVisible] = useState(false); // Settings panel visibility
  const [settingsPanelInitialTab, setSettingsPanelInitialTab] = useState('history'); // Initial tab for settings panel
  const [isProcessing, setIsProcessing] = useState(false); // Processing state after recording stops
  const [lastAudioBlob, setLastAudioBlob] = useState(null); // Store the last recorded audio blob
  const [hoverNote, setHoverNote] = useState(null); // Note being hovered over
  const [isHoveringRealNote, setIsHoveringRealNote] = useState(false); // Whether hovering over an actual note object
  const [undoStack, setUndoStack] = useState([]); // Undo history
  const [currentSessionId, setCurrentSessionId] = useState(null); // ID of currently loaded session from history
  const [fftData, setFftData] = useState(null); // FFT data for raw mode visualization
  const [pitchDetectionMethod, setPitchDetectionMethod] = useState('hybrid'); // Auto-detected pitch detection method
  const [lastClickedNoteIndex, setLastClickedNoteIndex] = useState(null); // Track last clicked note for delete
  const pitchDetectorRef = useRef(null);

  // Helper: Get note color from note name
  const getNoteColor = (noteName) => {
    if (!noteName) return 'rgba(68, 136, 255, 0.9)';

    // Only color if we're actually hovering over a real note object
    if (!isHoveringRealNote) return 'rgba(68, 136, 255, 0.9)'; // Default blue for cursor notes

    // Parse note name to get MIDI note number
    const noteMap = { 'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11 };
    const match = noteName.match(/^([A-G]#?)(-?\d+)$/);
    if (!match) return 'rgba(68, 136, 255, 0.9)';

    const [, note, octave] = match;
    const midiNote = (parseInt(octave) + 1) * 12 + noteMap[note];
    const hue = ((midiNote % 12) / 12) * 360;

    return `hsla(${hue}, 100%, 65%, 0.9)`;
  };
  const audioContextRef = useRef(null);
  const audioElementRef = useRef(null); // For playing recorded audio
  const playbackTimeoutRef = useRef(null); // For stopping playback timeout
  const playbackAnimationRef = useRef(null); // For requestAnimationFrame
  const playbackStartTimeRef = useRef(null); // When playback started
  const playbackDurationRef = useRef(null); // Total duration of playback
  const shouldLoopRef = useRef(false); // Track if playback should loop
  const notesRef = useRef(notes); // Keep current notes ref for playback loop
  const spinnerRotation = useRef(new Animated.Value(0)).current;
  const saveTimeoutRef = useRef(null); // For debounced save

  // Update notesRef whenever notes change
  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  // Animate spinner rotation
  useEffect(() => {
    if (isProcessing) {
      spinnerRotation.setValue(0);
      Animated.loop(
        Animated.timing(spinnerRotation, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        })
      ).start();
    }
  }, [isProcessing, spinnerRotation]);

  // Initialize settings and auto-detect optimal pitch detection method
  useEffect(() => {
    async function initializeApp() {
      try {
        Logger.log('Initializing app settings...');
        const settings = await Settings.initializeSettings();
        setPitchDetectionMethod(settings.pitchDetectionMethod);
        Logger.log(`Pitch detection method: ${settings.pitchDetectionMethod}`);

        if (settings.deviceCapabilities) {
          Logger.log('Device capabilities:', settings.deviceCapabilities);
          Logger.log('→', settings.deviceCapabilities.reason);
        }
      } catch (error) {
        Logger.error('Failed to initialize settings:', error);
        // Fallback to hybrid
        setPitchDetectionMethod('hybrid');
      }
    }

    initializeApp();
  }, []);

  const showDialog = (title, content) => {
    setDialogContent({ title, content });
    setDialogVisible(true);
  };

  const handleStartRecording = async () => {
    Logger.log('handleStartRecording called');
    Logger.log('pitchDetectorRef.current:', pitchDetectorRef.current);

    if (!pitchDetectorRef.current) {
      Logger.error('PitchDetector ref is null!');
      alert('PitchDetector not initialized');
      return;
    }

    try {
      Logger.log('Calling pitchDetectorRef.current.start()...');
      await pitchDetectorRef.current.start();
      Logger.log('PitchDetector started successfully');
      setIsRecording(true);
      setNotes([]);
      setTidalCode('');
    } catch (error) {
      Logger.error('Failed to start recording:', error);
      Logger.error('Error stack:', error.stack);
      alert(`Failed to access microphone: ${error.message}`);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Logger.log('Processing uploaded file:', file.name);
    setNotes([]);
    setTidalCode('');

    try {
      await pitchDetectorRef.current?.processFile(file);
    } catch (error) {
      Logger.error('Failed to process file:', error);
      alert('Failed to process audio file');
    }
  };

  const handleStopRecording = () => {
    pitchDetectorRef.current?.stop();
    setIsRecording(false);
    setIsProcessing(true); // Start showing loading indicator
    Logger.log('Recording stopped, waiting for processing...');
  };

  const handleNoteDetected = (noteData) => {
    Logger.log('App received note:', noteData);
    // Mark ML-detected notes with isML flag for debug comparison
    setNotes(prev => [...prev, { ...noteData, isML: true }]);
  };

  const handleLiveDetection = (liveData) => {
    Logger.log('Live detection received:', liveData);
    // Only show live detections during recording
    if (isRecording) {
      // Update the current live note display
      setCurrentLiveNote(liveData.note);

      setNotes(prev => {
        // Keep all existing notes (both live and processed)
        // Just add the new live detection
        const formattedLiveNote = {
          note: liveData.note,
          frequency: liveData.frequency,
          startTime: liveData.timestamp,
          duration: 0.1, // Small duration for visualization
          midiNote: Math.round(69 + 12 * Math.log2(liveData.frequency / 440)),
          isLive: true
        };

        Logger.log('Adding live note to visualizer:', formattedLiveNote);
        return [...prev, formattedLiveNote];
      });
    } else {
      Logger.log('Not recording, ignoring live detection');
      setCurrentLiveNote(null);
    }
  };

  const handleFFTData = (dataArray) => {
    // Update FFT data for raw mode visualization
    if (isRecording && !voiceMode) {
      setFftData(dataArray);
    }
  };

  const handleAudioCaptured = (audioBlob) => {
    Logger.log('Audio captured:', audioBlob.size, 'bytes');
    setLastAudioBlob(audioBlob);
  };

  const handleProcessingComplete = () => {
    Logger.log('Processing complete, generating Tidal code...');
    // Use setTimeout to ensure state has updated
    setTimeout(() => {
      setNotes(currentNotes => {
        let finalNotes;

        if (DEBUG_SHOW_COMPARISON) {
          // Keep both live and ML notes for comparison
          finalNotes = currentNotes;
          Logger.log(`Debug mode: Keeping ${currentNotes.filter(n => n.isLive).length} live notes + ${currentNotes.filter(n => n.isML).length} ML notes for comparison`);
        } else {
          // Filter out live notes - they'll be replaced by ML-detected notes
          finalNotes = currentNotes.filter(n => !n.isLive);
          Logger.log(`Generating pattern from ${finalNotes.length} notes (removed ${currentNotes.length - finalNotes.length} live notes)`);
        }

        // Generate Tidal pattern only from ML notes
        const mlNotes = currentNotes.filter(n => n.isML);
        if (mlNotes.length > 0) {
          const tidalPattern = TidalGenerator.generatePattern(mlNotes);
          const strudelPattern = TidalGenerator.generateStrudelPattern(mlNotes);
          const noteNamesList = TidalGenerator.generateNoteNames(mlNotes);
          Logger.log('Generated Tidal pattern:', tidalPattern);
          Logger.log('Generated Strudel pattern:', strudelPattern);
          Logger.log('Generated note names:', noteNamesList);
          setTidalCode(tidalPattern);
          setStrudelCode(strudelPattern);
          setNoteNames(noteNamesList);

          // Auto-save session to localStorage (save to history after recording)
          setTimeout(async () => {
            if (lastAudioBlob) {
              try {
                // Convert audio blob to base64 for storage
                const reader = new FileReader();
                reader.onloadend = async () => {
                  const audioBase64 = reader.result;

                  const sessionData = {
                    notes: mlNotes,
                    tidalCode: tidalPattern,
                    strudelCode: strudelPattern,
                    noteNames: noteNamesList,
                    audioBase64: audioBase64,
                    voiceMode: voiceMode,
                    undoStack: [], // Empty undo stack for new recordings
                  };

                  // Save to both current session (for editing) and history (for later retrieval)
                  await Storage.saveCurrentSession(sessionData);
                  const sessionId = await Storage.saveSession(sessionData);
                  setCurrentSessionId(sessionId); // Track new session
                  Logger.log('Session saved to history:', sessionId);
                };
                reader.readAsDataURL(lastAudioBlob);
              } catch (error) {
                Logger.error('Failed to auto-save session:', error);
              }
            }
          }, 200);
        } else {
          Logger.warn('No notes detected!');
        }

        // Stop showing loading indicator
        setIsProcessing(false);

        return finalNotes;
      });
    }, 100);
  };

  const handleExportMIDI = () => {
    if (notes.length === 0) {
      alert('No notes to export!');
      return;
    }

    try {
      MIDIExporter.exportToMIDI(notes, 'sing2midi-recording.mid');
    } catch (error) {
      Logger.error('Failed to export MIDI:', error);
      alert('Failed to export MIDI file');
    }
  };

  const handleClear = () => {
    // Save current state to undo stack before clearing
    if (notes.length > 0) {
      setUndoStack(prev => [...prev, notes]);
    }
    setNotes([]);
    setTidalCode('');
    setStrudelCode('');
    setNoteNames('');
    setLastAudioBlob(null);
    setLastClickedNoteIndex(null); // Clear last clicked note
  };

  const handlePlayback = async () => {
    // Stop if already playing
    if (isPlaying) {
      // Stop looping
      shouldLoopRef.current = false;

      // Clear animation frame
      if (playbackAnimationRef.current) {
        cancelAnimationFrame(playbackAnimationRef.current);
        playbackAnimationRef.current = null;
      }

      // Clear timeout
      if (playbackTimeoutRef.current) {
        clearTimeout(playbackTimeoutRef.current);
        playbackTimeoutRef.current = null;
      }

      // Close and recreate audio context to stop all oscillators
      if (audioContextRef.current) {
        await audioContextRef.current.close();
        audioContextRef.current = null;
      }

      setIsPlaying(false);
      setPlayheadPosition(null); // Hide playhead
      return;
    }

    if (notes.length === 0) {
      alert('No notes to play!');
      return;
    }

    // Get only ML notes for playback
    const mlNotes = notes.filter(n => n.isML);
    if (mlNotes.length === 0) {
      alert('No notes to play!');
      return;
    }

    setIsPlaying(true);
    shouldLoopRef.current = true;

    // Start looping playback
    const playLoop = async () => {
      // Check if we should still be playing
      if (!shouldLoopRef.current) return;

      // Get fresh notes from ref (allows edits during playback)
      const currentMlNotes = notesRef.current.filter(n => n.isML);
      if (currentMlNotes.length === 0) {
        shouldLoopRef.current = false;
        return;
      }

      // Sort notes by start time
      const sortedNotes = [...currentMlNotes].sort((a, b) => a.startTime - b.startTime);

      // Calculate total duration
      const lastNote = sortedNotes[sortedNotes.length - 1];
      const totalDuration = lastNote.startTime + lastNote.duration;
      playbackDurationRef.current = totalDuration;

      // Close previous audio context if exists
      if (audioContextRef.current) {
        await audioContextRef.current.close();
      }

      // Create new audio context
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      // Resume audio context if it's suspended (required on mobile browsers)
      if (audioContext.state === 'suspended' && audioContext.resume) {
        await audioContext.resume();
      }

      // Play each note
      const startTime = audioContext.currentTime;
      sortedNotes.forEach(note => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Set frequency from MIDI note
        const frequency = 440 * Math.pow(2, (note.midiNote - 69) / 12);
        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';

        // ADSR envelope
        const noteStart = startTime + note.startTime;
        const noteEnd = noteStart + note.duration;

        gainNode.gain.setValueAtTime(0, noteStart);
        gainNode.gain.linearRampToValueAtTime(0.3, noteStart + 0.01); // Attack
        gainNode.gain.linearRampToValueAtTime(0.2, noteStart + 0.05); // Decay
        gainNode.gain.setValueAtTime(0.2, noteEnd - 0.05); // Sustain
        gainNode.gain.linearRampToValueAtTime(0, noteEnd); // Release

        oscillator.start(noteStart);
        oscillator.stop(noteEnd);
      });

      // Record when this loop started (use AudioContext time for sync)
      playbackStartTimeRef.current = startTime;

      // Schedule next loop
      playbackTimeoutRef.current = setTimeout(() => {
        playLoop(); // Loop again
      }, totalDuration * 1000);
    };

    // Start first loop
    playLoop();

    // Animate playhead synced to AudioContext time
    const animatePlayhead = () => {
      if (!shouldLoopRef.current) {
        playbackAnimationRef.current = null;
        return;
      }

      // Use AudioContext's currentTime for perfect sync with audio
      if (audioContextRef.current && playbackDurationRef.current) {
        const elapsed = audioContextRef.current.currentTime - playbackStartTimeRef.current;
        const position = elapsed % playbackDurationRef.current; // Loop position
        setPlayheadPosition(position);
      }

      playbackAnimationRef.current = requestAnimationFrame(animatePlayhead);
    };
    animatePlayhead();
  };

  const handleDownloadAudio = () => {
    if (!lastAudioBlob) {
      alert('No audio recording available to download!');
      return;
    }

    // Web only - React Native needs different approach for file downloads
    if (Platform.OS === 'web') {
      // Create a download link
      const url = URL.createObjectURL(lastAudioBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sing2midi_${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      Logger.log('Audio download initiated');
    } else {
      // TODO: Implement file download for React Native using react-native-fs or similar
      alert('Audio download not yet supported on mobile');
    }
  };

  const handlePlayAudio = () => {
    if (!lastAudioBlob) {
      alert('No audio recording available to play!');
      return;
    }

    // Stop if already playing
    if (isPlayingAudio && audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = 0;
      setIsPlayingAudio(false);
      return;
    }

    // Create audio element if it doesn't exist
    if (!audioElementRef.current) {
      audioElementRef.current = new Audio();
    }

    const audio = audioElementRef.current;
    const url = URL.createObjectURL(lastAudioBlob);

    audio.src = url;
    audio.onended = () => {
      setIsPlayingAudio(false);
      URL.revokeObjectURL(url);
    };
    audio.onerror = (e) => {
      Logger.error('Audio playback error:', e);
      setIsPlayingAudio(false);
      URL.revokeObjectURL(url);
      alert('Failed to play audio');
    };

    setIsPlayingAudio(true);
    audio.play().catch(err => {
      Logger.error('Failed to play audio:', err);
      setIsPlayingAudio(false);
      URL.revokeObjectURL(url);
      alert('Failed to play audio');
    });
  };

  const handleLoadSession = (session) => {
    Logger.log('Loading session:', session.id);

    // Track which session is loaded so we can update it later
    setCurrentSessionId(session.id);

    // Restore notes with ML flag
    const restoredNotes = session.notes.map(note => ({ ...note, isML: true }));
    setNotes(restoredNotes);

    // Restore undo stack if available
    if (session.undoStack && Array.isArray(session.undoStack)) {
      setUndoStack(session.undoStack);
      Logger.log('Undo stack restored:', session.undoStack.length, 'states');
    } else {
      // If no undo stack in session, clear it
      setUndoStack([]);
    }

    // Restore generated code
    setTidalCode(session.tidalCode || '');
    setStrudelCode(session.strudelCode || '');
    setNoteNames(session.noteNames || '');

    // Restore audio blob if available
    if (session.audioBase64) {
      // Convert base64 data URL directly to blob (works in both web and React Native)
      try {
        const base64Data = session.audioBase64.split(',')[1];
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'audio/wav' });
        setLastAudioBlob(blob);
        Logger.log('Audio restored from session');
      } catch (err) {
        Logger.error('Failed to restore audio:', err);
      }
    }

    Logger.log(`Session loaded: ${restoredNotes.length} notes restored`);
  };

  // Handle note changes from visualizer (drag, create, delete)
  // isIntermediate: true during drag/resize, false on final mouseup
  const handleNotesChange = (updatedNotes, isIntermediate = false) => {
    // Only save to undo stack on final changes (not intermediate drag updates)
    if (!isIntermediate) {
      setUndoStack(prev => [...prev, notes]);
    }

    // Clear last clicked note if it no longer exists or notes array changed
    if (lastClickedNoteIndex !== null && (lastClickedNoteIndex >= updatedNotes.length || updatedNotes.length !== notes.length)) {
      setLastClickedNoteIndex(null);
    }

    // Update notes
    setNotes(updatedNotes);

    // Regenerate patterns with debounce
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      const mlNotes = updatedNotes.filter(n => n.isML);
      if (mlNotes.length > 0) {
        const tidalPattern = TidalGenerator.generatePattern(mlNotes);
        const strudelPattern = TidalGenerator.generateStrudelPattern(mlNotes);
        const noteNamesList = TidalGenerator.generateNoteNames(mlNotes);

        setTidalCode(tidalPattern);
        setStrudelCode(strudelPattern);
        setNoteNames(noteNamesList);

        Logger.log('Patterns regenerated after note edit');

        // Auto-save session
        if (lastAudioBlob) {
          const reader = new FileReader();
          reader.onloadend = async () => {
            try {
              const sessionData = {
                notes: mlNotes,
                tidalCode: tidalPattern,
                strudelCode: strudelPattern,
                noteNames: noteNamesList,
                audioBase64: reader.result,
                voiceMode: voiceMode,
                undoStack: undoStack, // Save undo history
              };

              // Always save to current session
              await Storage.saveCurrentSession(sessionData);

              // If we have a loaded session from history, update it too
              if (currentSessionId) {
                await Storage.updateSession(currentSessionId, sessionData);
                Logger.log('Session updated in history:', currentSessionId);
              }

              Logger.log('Session auto-saved after edit');
            } catch (error) {
              Logger.error('Failed to auto-save after edit:', error);
            }
          };
          reader.onerror = (error) => {
            Logger.error('Failed to read audio blob:', error);
          };
          reader.readAsDataURL(lastAudioBlob);
        } else {
          // Manual mode: save without audio (user is creating notes manually)
          try {
            const sessionData = {
              notes: mlNotes,
              tidalCode: tidalPattern,
              strudelCode: strudelPattern,
              noteNames: noteNamesList,
              audioBase64: null, // No audio in manual mode
              voiceMode: voiceMode,
              undoStack: undoStack,
            };

            // If no current session, create a new one for manual mode
            if (!currentSessionId) {
              Storage.saveSession(sessionData).then(newSessionId => {
                setCurrentSessionId(newSessionId);
                Logger.log('New manual session created:', newSessionId);
              });
            } else {
              // Update existing session
              Storage.updateSession(currentSessionId, sessionData);
              Logger.log('Manual session updated:', currentSessionId);
            }

            // Always save to current session
            Storage.saveCurrentSession(sessionData);
            Logger.log('Manual mode session auto-saved');
          } catch (error) {
            Logger.error('Failed to auto-save manual session:', error);
          }
        }
      }
    }, 1000); // 1 second debounce
  };

  // Handle undo
  const handleUndo = () => {
    if (undoStack.length === 0) return;

    const previousNotes = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));
    setNotes(previousNotes);
    setLastClickedNoteIndex(null); // Clear last clicked note on undo

    // Regenerate patterns immediately
    const mlNotes = previousNotes.filter(n => n.isML);
    if (mlNotes.length > 0) {
      const tidalPattern = TidalGenerator.generatePattern(mlNotes);
      const strudelPattern = TidalGenerator.generateStrudelPattern(mlNotes);
      const noteNamesList = TidalGenerator.generateNoteNames(mlNotes);

      setTidalCode(tidalPattern);
      setStrudelCode(strudelPattern);
      setNoteNames(noteNamesList);
    }
  };

  // Handle note click (track for delete key)
  const handleNoteClick = (noteIndex) => {
    setLastClickedNoteIndex(noteIndex);
  };

  // Handle delete key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Delete or Backspace key
      if ((e.key === 'Delete' || e.key === 'Backspace') && lastClickedNoteIndex !== null) {
        // Check if the note still exists at that index
        if (lastClickedNoteIndex < notes.length) {
          // Save to undo stack
          setUndoStack(prev => [...prev, notes]);

          // Delete the note
          const updatedNotes = notes.filter((_, i) => i !== lastClickedNoteIndex);
          setNotes(updatedNotes);

          // Clear the last clicked note so pressing delete again does nothing
          setLastClickedNoteIndex(null);

          // Regenerate patterns
          const mlNotes = updatedNotes.filter(n => n.isML);
          if (mlNotes.length > 0) {
            const tidalPattern = TidalGenerator.generatePattern(mlNotes);
            const strudelPattern = TidalGenerator.generateStrudelPattern(mlNotes);
            const noteNamesList = TidalGenerator.generateNoteNames(mlNotes);

            setTidalCode(tidalPattern);
            setStrudelCode(strudelPattern);
            setNoteNames(noteNamesList);
          } else {
            setTidalCode('');
            setStrudelCode('');
            setNoteNames('');
          }
        } else {
          // Note no longer exists, clear the last clicked note
          setLastClickedNoteIndex(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lastClickedNoteIndex, notes]);

  return (
    <View style={styles.container}>
      <View style={styles.visualizerContainer}>
        <NoteVisualizerWrapper
          notes={notes}
          isRecording={isRecording}
          debugShowComparison={DEBUG_SHOW_COMPARISON}
          onNotesChange={handleNotesChange}
          hoverNote={hoverNote}
          playheadPosition={playheadPosition}
          onHoverNoteChange={(noteName, isRealNote) => {
            setHoverNote(noteName);
            setIsHoveringRealNote(isRealNote);
          }}
          onNoteClick={handleNoteClick}
          fftData={fftData}
          voiceMode={voiceMode}
        />

        {/* Live note overlay - top left during recording */}
        {isRecording && currentLiveNote && (
          <View style={styles.liveNoteOverlay}>
            <Text style={styles.liveNoteText}>{currentLiveNote}</Text>
          </View>
        )}

        {/* Hover note overlay - top left when not recording */}
        {!isRecording && hoverNote && (
          <View style={[styles.liveNoteOverlay, { backgroundColor: getNoteColor(hoverNote) }]}>
            <Text style={styles.liveNoteText}>{hoverNote}</Text>
          </View>
        )}

        {/* Loading indicator during processing */}
        {isProcessing && (
          <View style={styles.loadingOverlay}>
            <Animated.View
              style={[
                styles.spinner,
                {
                  transform: [{
                    rotate: spinnerRotation.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '360deg'],
                    }),
                  }],
                },
              ]}
            >
              <View style={styles.spinnerInner} />
            </Animated.View>
            <Text style={styles.loadingText}>Processing audio...</Text>
          </View>
        )}
      </View>

      <View style={styles.controls}>
        {/* First row: Record/Stop button and voice mode toggle */}
        <View style={styles.buttonRow}>
          {!isRecording ? (
            <TouchableOpacity
              style={[styles.button, styles.recordButton]}
              onPress={handleStartRecording}
            >
              <Text style={styles.buttonText}>● Start Recording</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.button, styles.stopButton]}
              onPress={handleStopRecording}
            >
              <Text style={styles.buttonText}>■ Stop Recording</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.button, styles.toggleButton, voiceMode && styles.toggleButtonActive]}
            onPress={() => setVoiceMode(!voiceMode)}
            disabled={isRecording}
          >
            <View style={styles.buttonWithIcon}>
              {voiceMode ? (
                <Image
                  source={getAssetSource('mic-vocal')}
                  style={[{ width: 18, height: 18 }, styles.whiteIcon]}
                />
              ) : (
                <WaveformIcon size={18} />
              )}
              <Text style={[styles.buttonText, styles.smallButtonText]}>
                {voiceMode ? 'Voice' : 'Raw'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Second row: All other buttons */}
        <View style={[styles.buttonRow, styles.secondaryButtonRow]}>
          {/* Hide file upload on iOS/Android - only show on web */}
          {Platform.OS === 'web' && (
            <>
              <TouchableOpacity
                style={[styles.button, styles.smallButton, styles.uploadButton]}
                onPress={() => document.getElementById('file-upload').click()}
              >
                <UploadIcon size={16} />
              </TouchableOpacity>
              <input
                id="file-upload"
                type="file"
                accept="audio/*"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
            </>
          )}

          <TouchableOpacity
            style={[styles.button, styles.smallButton, styles.clearButton, notes.length === 0 && styles.disabledButton]}
            onPress={handleClear}
            disabled={notes.length === 0}
          >
            <Trash2Icon size={16} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.smallButton, styles.undoButton, undoStack.length === 0 && styles.disabledButton]}
            onPress={handleUndo}
            disabled={undoStack.length === 0}
          >
            <RotateCcwIcon size={16} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.smallButton, styles.playButton, notes.length === 0 && styles.disabledButton]}
            onPress={handlePlayback}
            disabled={notes.length === 0}
          >
            {isPlaying ? <SquareIcon size={16} filled={true} /> : <PlayIcon size={16} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.smallButton, styles.playAudioButton, (!lastAudioBlob || isPlayingAudio) && styles.disabledButton]}
            onPress={handlePlayAudio}
            disabled={!lastAudioBlob || isPlayingAudio}
          >
            {isPlayingAudio ? <SquareIcon size={16} filled={true} /> : <PlayIcon size={16} filled={true} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.smallButton, styles.downloadButton, !lastAudioBlob && styles.disabledButton]}
            onPress={handleDownloadAudio}
            disabled={!lastAudioBlob}
          >
            <DownloadIcon size={16} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.smallButton, styles.noteNamesButton, notes.length === 0 && styles.disabledButton]}
            onPress={() => showDialog('Note Names', noteNames || 'No notes available')}
            disabled={notes.length === 0}
          >
            <ListMusicIcon size={16} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.smallButton, styles.tidalButton, notes.length === 0 && styles.disabledButton]}
            onPress={() => showDialog('TidalCycles Pattern', tidalCode || 'No pattern available')}
            disabled={notes.length === 0}
          >
            <View style={styles.buttonWithIcon}>
              <Image
                source={getAssetSource('list-music')}
                style={[{ width: 16, height: 16 }, styles.whiteIcon]}
              />
              <Text style={[styles.buttonText, styles.smallButtonText]}>Tidal</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.smallButton, styles.strudelButton, notes.length === 0 && styles.disabledButton]}
            onPress={() => showDialog('Strudel Pattern', strudelCode || 'No pattern available')}
            disabled={notes.length === 0}
          >
            <View style={styles.buttonWithIcon}>
              <Image
                source={getAssetSource('list-music')}
                style={[{ width: 16, height: 16 }, styles.whiteIcon]}
              />
              <Text style={[styles.buttonText, styles.smallButtonText]}>Strudel</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.smallButton, styles.exportButton, notes.length === 0 && styles.disabledButton]}
            onPress={handleExportMIDI}
            disabled={notes.length === 0}
          >
            <View style={styles.buttonWithIcon}>
              <Image
                source={getAssetSource('keyboard-music')}
                style={[{ width: 16, height: 16 }, styles.whiteIcon]}
              />
              <Text style={[styles.buttonText, styles.smallButtonText]}>MIDI</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.smallButton, styles.helpButton]}
            onPress={() => {
              setSettingsPanelInitialTab('help');
              setSettingsPanelVisible(true);
            }}
          >
            <CircleHelpIcon size={16} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Hidden for now - using dialogs instead */}
      {false && noteNames && (
        <View style={styles.codeContainer}>
          <Text style={styles.codeLabel}>Note Names:</Text>
          <ScrollView style={styles.codeScroll}>
            <Text style={styles.noteNamesText}>{noteNames}</Text>
          </ScrollView>
        </View>
      )}

      {false && tidalCode && (
        <View style={styles.codeContainer}>
          <Text style={styles.codeLabel}>TidalCycles Pattern:</Text>
          <ScrollView style={styles.codeScroll}>
            <Text style={styles.codeText}>{tidalCode}</Text>
          </ScrollView>
        </View>
      )}

      {false && strudelCode && (
        <View style={styles.codeContainer}>
          <Text style={styles.codeLabel}>Strudel (JavaScript):</Text>
          <ScrollView style={styles.codeScroll}>
            <Text style={styles.strudelText}>{strudelCode}</Text>
          </ScrollView>
        </View>
      )}

      <PitchDetector
        ref={pitchDetectorRef}
        onNoteDetected={handleNoteDetected}
        onLiveDetection={handleLiveDetection}
        onFFTData={handleFFTData}
        onProcessingComplete={handleProcessingComplete}
        onAudioCaptured={handleAudioCaptured}
        voiceMode={voiceMode}
        pitchDetectionMethod={pitchDetectionMethod}
      />

      <CopyDialog
        visible={dialogVisible}
        onClose={() => setDialogVisible(false)}
        title={dialogContent.title}
        content={dialogContent.content}
      />

      <SettingsPanel
        visible={settingsPanelVisible}
        onClose={() => setSettingsPanelVisible(false)}
        onLoadSession={handleLoadSession}
        onMethodChange={(method) => {
          Logger.log(`Pitch detection method changed to: ${method}`);
          setPitchDetectionMethod(method);
        }}
        initialTab={settingsPanelInitialTab}
      />

      {/* Menu button - bottom right corner */}
      <TouchableOpacity
        style={styles.hamburgerButton}
        onPress={() => {
          setSettingsPanelInitialTab('history');
          setSettingsPanelVisible(!settingsPanelVisible);
        }}
      >
        <MenuIcon size={20} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.BG_SECONDARY,
    padding: 20,
    height: '100vh',
    maxHeight: '100vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.TEXT_PRIMARY,
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.TEXT_SECONDARY,
  },
  visualizerContainer: {
    flex: 1,
    backgroundColor: Colors.BG_PRIMARY,
    borderRadius: 10,
    marginBottom: 10,
    overflow: 'hidden',
    position: 'relative',
    minHeight: 0,
  },
  liveNoteOverlay: {
    position: 'absolute',
    top: 20,
    left: 20,
    backgroundColor: 'rgba(68, 136, 255, 0.9)',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#4488ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 5,
  },
  liveNoteText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    fontFamily: Colors.FONT_TECHNICAL,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: 'rgba(68, 136, 255, 0.3)',
    borderTopColor: '#4488ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  spinnerInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(68, 136, 255, 0.1)',
  },
  loadingText: {
    fontSize: 18,
    color: '#ffffff',
    fontWeight: '600',
    fontFamily: Colors.FONT_UI,
  },
  controls: {
    flexShrink: 0,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 10,
  },
  secondaryButtonRow: {
    flexWrap: 'wrap',
    gap: 8,
  },
  button: {
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 60,
    borderWidth: 1,
    borderColor: Colors.SLATE_GRAY,
  },
  recordButton: {
    backgroundColor: Colors.BTN_RECORD,
    flex: 1,
  },
  stopButton: {
    backgroundColor: Colors.BTN_STOP,
    flex: 1,
  },
  clearButton: {
    backgroundColor: Colors.BG_SECONDARY,
  },
  undoButton: {
    backgroundColor: Colors.BG_SECONDARY,
  },
  exportButton: {
    backgroundColor: Colors.BG_SECONDARY,
  },
  playButton: {
    backgroundColor: Colors.BG_SECONDARY,
  },
  playAudioButton: {
    backgroundColor: Colors.BG_SECONDARY,
  },
  downloadButton: {
    backgroundColor: Colors.BG_SECONDARY,
  },
  uploadButton: {
    backgroundColor: Colors.BG_SECONDARY,
  },
  noteNamesButton: {
    backgroundColor: Colors.BG_SECONDARY,
  },
  tidalButton: {
    backgroundColor: Colors.BG_SECONDARY,
  },
  strudelButton: {
    backgroundColor: Colors.BG_SECONDARY,
  },
  helpButton: {
    backgroundColor: Colors.BG_SECONDARY,
  },
  disabledButton: {
    backgroundColor: Colors.BTN_DISABLED,
    opacity: 0.5,
  },
  toggleButton: {
    backgroundColor: Colors.BTN_TOGGLE,
    marginLeft: 10,
    paddingHorizontal: 20,
  },
  toggleButtonActive: {
    backgroundColor: Colors.BTN_TOGGLE_ACTIVE,
  },
  buttonWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  buttonIcon: {
    width: 16,
    height: 16,
  },
  whiteIcon: {
    filter: 'brightness(0) invert(1)',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: Colors.FONT_UI,
  },
  smallButtonText: {
    fontSize: 14,
  },
  codeContainer: {
    backgroundColor: Colors.BG_PRIMARY,
    borderRadius: 10,
    padding: 15,
    maxHeight: 150,
  },
  codeLabel: {
    color: Colors.TEXT_SECONDARY,
    fontSize: 12,
    marginBottom: 8,
  },
  codeScroll: {
    maxHeight: 100,
  },
  noteNamesText: {
    color: '#ffffff',
    fontFamily: Colors.FONT_TECHNICAL,
    fontSize: 14,
    fontWeight: '600',
  },
  codeText: {
    color: '#44ff44',
    fontFamily: Colors.FONT_TECHNICAL,
    fontSize: 14,
  },
  strudelText: {
    color: '#ff8844',
    fontFamily: Colors.FONT_TECHNICAL,
    fontSize: 14,
  },
  hamburgerButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.BG_SECONDARY,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 1000,
  },
});
