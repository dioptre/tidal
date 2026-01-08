import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import PitchDetector from './components/PitchDetector.jsx';
import NoteVisualizer from './components/NoteVisualizer.jsx';
import TidalGenerator from './utils/TidalGenerator';
import MIDIExporter from './utils/MIDIExporter';

// Debug mode: Show live detections (green) vs ML predictions (blue) side-by-side
const DEBUG_SHOW_COMPARISON = true;

export default function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [notes, setNotes] = useState([]);
  const [tidalCode, setTidalCode] = useState('');
  const [strudelCode, setStrudelCode] = useState('');
  const [noteNames, setNoteNames] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const pitchDetectorRef = useRef(null);
  const audioContextRef = useRef(null);

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
    }
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
        } else {
          console.warn('No notes detected!');
        }
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

    // Create or reuse audio context
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
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
    setTimeout(() => {
      setIsPlaying(false);
    }, totalDuration);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Sing2MIDI</Text>
        <Text style={styles.subtitle}>Voice to TidalCycles & MIDI</Text>
      </View>

      <View style={styles.visualizerContainer}>
        <NoteVisualizer notes={notes} isRecording={isRecording} debugShowComparison={DEBUG_SHOW_COMPARISON} />
      </View>

      <View style={styles.controls}>
        <View style={styles.buttonRow}>
          {!isRecording ? (
            <TouchableOpacity
              style={[styles.button, styles.recordButton, { marginRight: 10 }]}
              onPress={handleStartRecording}
            >
              <Text style={styles.buttonText}>Start Recording</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.button, styles.stopButton, { marginRight: 10 }]}
              onPress={handleStopRecording}
            >
              <Text style={styles.buttonText}>Stop Recording</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.button, styles.clearButton]}
            onPress={handleClear}
            disabled={notes.length === 0}
          >
            <Text style={styles.buttonText}>Clear</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.buttonRow}>
          <label htmlFor="file-upload" style={{
            display: 'inline-block',
            padding: '15px 30px',
            backgroundColor: '#4444ff',
            color: '#ffffff',
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: 16,
            textAlign: 'center'
          }}>
            Upload Audio File
          </label>
          <input
            id="file-upload"
            type="file"
            accept="audio/*"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
        </View>

        {notes.length > 0 && (
          <>
            <TouchableOpacity
              style={[styles.button, styles.playButton, { marginBottom: 10 }]}
              onPress={handlePlayback}
              disabled={isPlaying}
            >
              <Text style={styles.buttonText}>{isPlaying ? 'Playing...' : 'Play Notes'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.exportButton]}
              onPress={handleExportMIDI}
            >
              <Text style={styles.buttonText}>Export to MIDI</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {noteNames && (
        <View style={styles.codeContainer}>
          <Text style={styles.codeLabel}>Note Names:</Text>
          <ScrollView style={styles.codeScroll}>
            <Text style={styles.noteNamesText}>{noteNames}</Text>
          </ScrollView>
        </View>
      )}

      {tidalCode && (
        <View style={styles.codeContainer}>
          <Text style={styles.codeLabel}>TidalCycles Pattern:</Text>
          <ScrollView style={styles.codeScroll}>
            <Text style={styles.codeText}>{tidalCode}</Text>
          </ScrollView>
        </View>
      )}

      {strudelCode && (
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
        onProcessingComplete={handleProcessingComplete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    padding: 20,
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
    marginBottom: 20,
    overflow: 'hidden',
  },
  controls: {
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 10,
  },
  button: {
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
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
  exportButton: {
    backgroundColor: '#44ff44',
  },
  playButton: {
    backgroundColor: '#4488ff',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
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
});
