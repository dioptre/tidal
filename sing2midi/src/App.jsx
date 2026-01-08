import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Animated, Image } from 'react-native';
import PitchDetector from './components/PitchDetector.jsx';
import NoteVisualizer from './components/NoteVisualizer.jsx';
import CopyDialog from './components/CopyDialog.jsx';
import SettingsPanel from './components/SettingsPanel.jsx';
import TidalGenerator from './utils/TidalGenerator';
import MIDIExporter from './utils/MIDIExporter';
import Storage from './utils/Storage';

// Debug mode: Show live detections (green) vs ML predictions (blue) side-by-side
const DEBUG_SHOW_COMPARISON = true;

export default function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [notes, setNotes] = useState([]);
  const [tidalCode, setTidalCode] = useState('');
  const [strudelCode, setStrudelCode] = useState('');
  const [noteNames, setNoteNames] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false); // Track recorded audio playback
  const [voiceMode, setVoiceMode] = useState(true); // Toggle for voice-optimized mode
  const [dialogVisible, setDialogVisible] = useState(false);
  const [dialogContent, setDialogContent] = useState({ title: '', content: '' });
  const [currentLiveNote, setCurrentLiveNote] = useState(null); // Current note being detected live
  const [settingsPanelVisible, setSettingsPanelVisible] = useState(false); // Settings panel visibility
  const [isProcessing, setIsProcessing] = useState(false); // Processing state after recording stops
  const [lastAudioBlob, setLastAudioBlob] = useState(null); // Store the last recorded audio blob
  const [hoverNote, setHoverNote] = useState(null); // Note being hovered over
  const [undoStack, setUndoStack] = useState([]); // Undo history
  const [fftData, setFftData] = useState(null); // FFT data for raw mode visualization
  const pitchDetectorRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioElementRef = useRef(null); // For playing recorded audio
  const playbackTimeoutRef = useRef(null); // For stopping playback timeout
  const spinnerRotation = useRef(new Animated.Value(0)).current;
  const saveTimeoutRef = useRef(null); // For debounced save

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

  const showDialog = (title, content) => {
    setDialogContent({ title, content });
    setDialogVisible(true);
  };

  const handleStartRecording = async () => {
    try {
      await pitchDetectorRef.current?.start();
      setIsRecording(true);
      setNotes([]);
      setTidalCode('');
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('Failed to access microphone. Please grant permission.');
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log('Processing uploaded file:', file.name);
    setNotes([]);
    setTidalCode('');

    try {
      await pitchDetectorRef.current?.processFile(file);
    } catch (error) {
      console.error('Failed to process file:', error);
      alert('Failed to process audio file');
    }
  };

  const handleStopRecording = () => {
    pitchDetectorRef.current?.stop();
    setIsRecording(false);
    setIsProcessing(true); // Start showing loading indicator
    console.log('Recording stopped, waiting for processing...');
  };

  const handleNoteDetected = (noteData) => {
    console.log('App received note:', noteData);
    // Mark ML-detected notes with isML flag for debug comparison
    setNotes(prev => [...prev, { ...noteData, isML: true }]);
  };

  const handleLiveDetection = (liveData) => {
    console.log('Live detection received:', liveData);
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

        console.log('Adding live note to visualizer:', formattedLiveNote);
        return [...prev, formattedLiveNote];
      });
    } else {
      console.log('Not recording, ignoring live detection');
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
    console.log('Audio captured:', audioBlob.size, 'bytes');
    setLastAudioBlob(audioBlob);
  };

  const handleProcessingComplete = () => {
    console.log('Processing complete, generating Tidal code...');
    // Use setTimeout to ensure state has updated
    setTimeout(() => {
      setNotes(currentNotes => {
        let finalNotes;

        if (DEBUG_SHOW_COMPARISON) {
          // Keep both live and ML notes for comparison
          finalNotes = currentNotes;
          console.log(`Debug mode: Keeping ${currentNotes.filter(n => n.isLive).length} live notes + ${currentNotes.filter(n => n.isML).length} ML notes for comparison`);
        } else {
          // Filter out live notes - they'll be replaced by ML-detected notes
          finalNotes = currentNotes.filter(n => !n.isLive);
          console.log(`Generating pattern from ${finalNotes.length} notes (removed ${currentNotes.length - finalNotes.length} live notes)`);
        }

        // Generate Tidal pattern only from ML notes
        const mlNotes = currentNotes.filter(n => n.isML);
        if (mlNotes.length > 0) {
          const tidalPattern = TidalGenerator.generatePattern(mlNotes);
          const strudelPattern = TidalGenerator.generateStrudelPattern(mlNotes);
          const noteNamesList = TidalGenerator.generateNoteNames(mlNotes);
          console.log('Generated Tidal pattern:', tidalPattern);
          console.log('Generated Strudel pattern:', strudelPattern);
          console.log('Generated note names:', noteNamesList);
          setTidalCode(tidalPattern);
          setStrudelCode(strudelPattern);
          setNoteNames(noteNamesList);

          // Auto-save session to localStorage
          setTimeout(async () => {
            if (lastAudioBlob) {
              try {
                // Convert audio blob to base64 for storage
                const reader = new FileReader();
                reader.onloadend = () => {
                  const audioBase64 = reader.result;

                  const sessionData = {
                    notes: mlNotes,
                    tidalCode: tidalPattern,
                    strudelCode: strudelPattern,
                    noteNames: noteNamesList,
                    audioBase64: audioBase64,
                    voiceMode: voiceMode,
                  };

                  const sessionId = Storage.saveSession(sessionData);
                  console.log('Session auto-saved:', sessionId);
                };
                reader.readAsDataURL(lastAudioBlob);
              } catch (error) {
                console.error('Failed to auto-save session:', error);
              }
            }
          }, 200);
        } else {
          console.warn('No notes detected!');
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
      console.error('Failed to export MIDI:', error);
      alert('Failed to export MIDI file');
    }
  };

  const handleClear = () => {
    setNotes([]);
    setTidalCode('');
    setStrudelCode('');
    setNoteNames('');
  };

  const handlePlayback = async () => {
    // Stop if already playing
    if (isPlaying) {
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

    // Create new audio context
    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    const audioContext = audioContextRef.current;

    // Sort notes by start time
    const sortedNotes = [...mlNotes].sort((a, b) => a.startTime - b.startTime);

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

    // Calculate total duration
    const lastNote = sortedNotes[sortedNotes.length - 1];
    const totalDuration = (lastNote.startTime + lastNote.duration) * 1000;

    // Reset playing state after playback completes
    playbackTimeoutRef.current = setTimeout(() => {
      setIsPlaying(false);
      playbackTimeoutRef.current = null;
    }, totalDuration);
  };

  const handleDownloadAudio = () => {
    if (!lastAudioBlob) {
      alert('No audio recording available to download!');
      return;
    }

    // Create a download link
    const url = URL.createObjectURL(lastAudioBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sing2midi_${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log('Audio download initiated');
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
      console.error('Audio playback error:', e);
      setIsPlayingAudio(false);
      URL.revokeObjectURL(url);
      alert('Failed to play audio');
    };

    setIsPlayingAudio(true);
    audio.play().catch(err => {
      console.error('Failed to play audio:', err);
      setIsPlayingAudio(false);
      URL.revokeObjectURL(url);
      alert('Failed to play audio');
    });
  };

  const handleLoadSession = (session) => {
    console.log('Loading session:', session.id);

    // Restore notes with ML flag
    const restoredNotes = session.notes.map(note => ({ ...note, isML: true }));
    setNotes(restoredNotes);

    // Restore generated code
    setTidalCode(session.tidalCode || '');
    setStrudelCode(session.strudelCode || '');
    setNoteNames(session.noteNames || '');

    // Restore audio blob if available
    if (session.audioBase64) {
      // Convert base64 back to blob
      fetch(session.audioBase64)
        .then(res => res.blob())
        .then(blob => {
          setLastAudioBlob(blob);
          console.log('Audio restored from session');
        })
        .catch(err => console.error('Failed to restore audio:', err));
    }

    console.log(`Session loaded: ${restoredNotes.length} notes restored`);
  };

  // Handle note changes from visualizer (drag, create, delete)
  const handleNotesChange = (updatedNotes) => {
    // Save current state to undo stack
    setUndoStack(prev => [...prev, notes]);

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

        console.log('Patterns regenerated after note edit');

        // Auto-save session
        if (lastAudioBlob) {
          const reader = new FileReader();
          reader.onloadend = () => {
            const sessionData = {
              notes: mlNotes,
              tidalCode: tidalPattern,
              strudelCode: strudelPattern,
              noteNames: noteNamesList,
              audioBase64: reader.result,
              voiceMode: voiceMode,
            };
            Storage.saveSession(sessionData);
            console.log('Session auto-saved after edit');
          };
          reader.readAsDataURL(lastAudioBlob);
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

  return (
    <View style={styles.container}>
      <View style={styles.visualizerContainer}>
        <NoteVisualizer
          notes={notes}
          isRecording={isRecording}
          debugShowComparison={DEBUG_SHOW_COMPARISON}
          onNotesChange={handleNotesChange}
          hoverNote={hoverNote}
          onHoverNoteChange={setHoverNote}
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
          <View style={styles.liveNoteOverlay}>
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
              <Text style={styles.buttonText}>Start Recording</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.button, styles.stopButton]}
              onPress={handleStopRecording}
            >
              <Text style={styles.buttonText}>Stop Recording</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.button, styles.toggleButton, voiceMode && styles.toggleButtonActive]}
            onPress={() => setVoiceMode(!voiceMode)}
            disabled={isRecording}
          >
            <Text style={[styles.buttonText, styles.smallButtonText]}>
              {voiceMode ? '🎤 Voice' : '🤖 Raw'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Second row: All other buttons */}
        <View style={[styles.buttonRow, styles.secondaryButtonRow]}>
          <label htmlFor="file-upload" style={{
            display: 'inline-block',
            padding: '12px 20px',
            backgroundColor: '#4444ff',
            color: '#ffffff',
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: 14,
            textAlign: 'center',
            marginRight: 8,
            opacity: 1
          }}>
            Upload
          </label>
          <input
            id="file-upload"
            type="file"
            accept="audio/*"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />

          <TouchableOpacity
            style={[styles.button, styles.smallButton, styles.clearButton, notes.length === 0 && styles.disabledButton]}
            onPress={handleClear}
            disabled={notes.length === 0}
          >
            <Text style={[styles.buttonText, styles.smallButtonText]}>🗑️</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.smallButton, styles.undoButton, undoStack.length === 0 && styles.disabledButton]}
            onPress={handleUndo}
            disabled={undoStack.length === 0}
          >
            <Text style={[styles.buttonText, styles.smallButtonText]}>↩️</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.smallButton, styles.playButton, notes.length === 0 && styles.disabledButton]}
            onPress={handlePlayback}
            disabled={notes.length === 0}
          >
            <Text style={[styles.buttonText, styles.smallButtonText]}>{isPlaying ? '■' : '▷'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.smallButton, styles.playAudioButton, (!lastAudioBlob || isPlayingAudio) && styles.disabledButton]}
            onPress={handlePlayAudio}
            disabled={!lastAudioBlob}
          >
            <Text style={[styles.buttonText, styles.smallButtonText]}>{isPlayingAudio ? '■' : '▶'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.smallButton, styles.downloadButton, !lastAudioBlob && styles.disabledButton]}
            onPress={handleDownloadAudio}
            disabled={!lastAudioBlob}
          >
            <Text style={[styles.buttonText, styles.smallButtonText]}>⬇️</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.smallButton, styles.exportButton, notes.length === 0 && styles.disabledButton]}
            onPress={handleExportMIDI}
            disabled={notes.length === 0}
          >
            <Text style={[styles.buttonText, styles.smallButtonText]}>MIDI 🎶</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.smallButton, styles.noteNamesButton, notes.length === 0 && styles.disabledButton]}
            onPress={() => showDialog('Note Names', noteNames || 'No notes available')}
            disabled={notes.length === 0}
          >
            <Text style={[styles.buttonText, styles.smallButtonText]}>Notes 🎼</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.smallButton, styles.tidalButton, notes.length === 0 && styles.disabledButton]}
            onPress={() => showDialog('TidalCycles Pattern', tidalCode || 'No pattern available')}
            disabled={notes.length === 0}
          >
            <View style={styles.buttonWithIcon}>
              <Text style={[styles.buttonText, styles.smallButtonText]}>Tidal</Text>
              <Image
                source={{ uri: '/assets/img/tidal-logo.svg' }}
                style={styles.buttonIcon}
              />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.smallButton, styles.strudelButton, notes.length === 0 && styles.disabledButton]}
            onPress={() => showDialog('Strudel Pattern', strudelCode || 'No pattern available')}
            disabled={notes.length === 0}
          >
            <View style={styles.buttonWithIcon}>
              <Text style={[styles.buttonText, styles.smallButtonText]}>Strudel</Text>
              <Image
                source={{ uri: '/assets/img/strudel-icon.png' }}
                style={styles.buttonIcon}
              />
            </View>
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
      />

      {/* Hamburger menu button - bottom right corner */}
      <TouchableOpacity
        style={styles.hamburgerButton}
        onPress={() => setSettingsPanelVisible(!settingsPanelVisible)}
      >
        <Text style={styles.hamburgerIcon}>☰</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
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
    color: '#ffffff',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: '#888888',
  },
  visualizerContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
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
    fontFamily: 'monospace',
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
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    minWidth: 60,
  },
  recordButton: {
    backgroundColor: '#ff4444',
    flex: 1,
  },
  stopButton: {
    backgroundColor: '#ff4444',
    flex: 1,
  },
  clearButton: {
    backgroundColor: '#444444',
  },
  undoButton: {
    backgroundColor: '#8844ff',
  },
  exportButton: {
    backgroundColor: '#0c500cff',
  },
  playButton: {
    backgroundColor: '#4488ff',
  },
  playAudioButton: {
    backgroundColor: '#44aaff',
  },
  downloadButton: {
    backgroundColor: '#ff8844',
  },
  noteNamesButton: {
    backgroundColor: '#ff8844',
  },
  tidalButton: {
    backgroundColor: '#1b6b8dff',
  },
  strudelButton: {
    backgroundColor: '#ff4488',
  },
  disabledButton: {
    backgroundColor: '#2a2a2a',
    opacity: 0.5,
  },
  toggleButton: {
    backgroundColor: '#555555',
    marginLeft: 10,
    paddingHorizontal: 20,
  },
  toggleButtonActive: {
    backgroundColor: '#8844ff',
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
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  smallButtonText: {
    fontSize: 14,
  },
  codeContainer: {
    backgroundColor: '#0a0a0a',
    borderRadius: 10,
    padding: 15,
    maxHeight: 150,
  },
  codeLabel: {
    color: '#888888',
    fontSize: 12,
    marginBottom: 8,
  },
  codeScroll: {
    maxHeight: 100,
  },
  noteNamesText: {
    color: '#ffffff',
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: '600',
  },
  codeText: {
    color: '#44ff44',
    fontFamily: 'monospace',
    fontSize: 14,
  },
  strudelText: {
    color: '#ff8844',
    fontFamily: 'monospace',
    fontSize: 14,
  },
  hamburgerButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4444ff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  hamburgerIcon: {
    fontSize: 28,
    color: '#ffffff',
    fontWeight: 'bold',
  },
});
