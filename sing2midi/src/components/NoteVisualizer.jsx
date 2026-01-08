import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';

const NoteVisualizer = ({ notes, isRecording, debugShowComparison, onNotesChange, hoverNote, onHoverNoteChange, fftData, voiceMode }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const [dragState, setDragState] = useState(null); // { noteIndex, originalNote, startX, startY, isCreatingNew }
  const [ghostNote, setGhostNote] = useState(null); // Original position during drag
  const holdTimerRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    // Set canvas size
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const render = () => {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      // Clear canvas
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, width, height);

      // Draw FFT visualization in raw mode recording (before notes)
      if (isRecording && !voiceMode && fftData) {
        drawFFTVisualization(ctx, fftData, width, height);
      }

      if (notes.length === 0) {
        // Show placeholder text (only if not showing FFT)
        if (!isRecording || voiceMode || !fftData) {
          ctx.fillStyle = '#444444';
          ctx.font = '16px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(
            isRecording ? 'Listening...' : 'Press "Start Recording" to begin',
            width / 2,
            height / 2
          );
        }
      } else {
        // Draw notes
        drawNotes(ctx, notes, width, height);
      }

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [notes, isRecording, debugShowComparison, ghostNote, fftData, voiceMode]);

  const drawFFTVisualization = (ctx, dataArray, width, height) => {
    const bufferLength = dataArray.length;
    const numBars = 64; // Number of frequency bars
    const barWidth = width / numBars;

    // Draw frequency bars from bottom up
    for (let i = 0; i < numBars; i++) {
      // Map to frequency data (focus on lower-mid frequencies for music)
      const dataIndex = Math.floor((i / numBars) * (bufferLength * 0.5));
      const value = dataArray[dataIndex] / 255.0; // Normalize to 0-1

      const barHeight = value * height * 0.8; // Max 80% of canvas height
      const x = i * barWidth;
      const y = height - barHeight;

      // Color based on frequency (blue to red gradient)
      const hue = 200 - (i / numBars) * 160; // Blue (200) to red (40)
      const saturation = 70 + value * 30;
      const lightness = 40 + value * 30;

      ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
      ctx.fillRect(x, y, barWidth - 1, barHeight);
    }
  };

  const drawNotes = (ctx, notes, width, height) => {
    if (notes.length === 0) return;

    // Find note range for vertical scaling
    const midiNotes = notes.map(n => n.midiNote).filter(m => m != null);
    if (midiNotes.length === 0) return;

    const minMidi = Math.min(...midiNotes) - 2;
    const maxMidi = Math.max(...midiNotes) + 2;
    const midiRange = maxMidi - minMidi || 12;

    // Find time range for horizontal scaling
    const maxTime = Math.max(...notes.map(n => (n.startTime || 0) + (n.duration || 0)));

    // During recording, show a 5-second sliding window
    // After recording, show all notes
    let timeScale, timeOffset;
    if (isRecording) {
      const windowSize = 5; // 5 second window
      timeScale = width / windowSize;
      // Center the window on the most recent note
      timeOffset = Math.max(0, maxTime - windowSize + 1);
    } else {
      const totalTime = Math.max(maxTime, 5);
      timeScale = width / totalTime;
      timeOffset = 0;
    }

    // Draw grid lines (octave markers)
    ctx.strokeStyle = '#222222';
    ctx.lineWidth = 1;
    for (let midi = minMidi; midi <= maxMidi; midi++) {
      if (midi % 12 === 0) { // C notes
        const y = height - ((midi - minMidi) / midiRange) * height;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();

        // Label
        const octave = Math.floor((midi - 12) / 12);
        ctx.fillStyle = '#444444';
        ctx.font = '12px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`C${octave}`, 5, y);
      }
    }

    // Draw notes as rectangles
    // In debug mode after recording, draw in 3 passes: live (green) bottom, ML (blue) middle, final (colorful) top
    if (debugShowComparison && !isRecording) {
      // Pass 1: Draw live detections in dark green (bottom layer)
      notes.filter(n => n.isLive).forEach((note) => {
        const noteStart = (note.startTime || 0);
        const x = (noteStart - timeOffset) * timeScale;
        if (x + (note.duration || 0.1) * timeScale < 0 || x > width) return;

        const noteWidth = (note.duration || 0.1) * timeScale;
        const y = height - ((note.midiNote - minMidi) / midiRange) * height;
        const noteHeight = (height / midiRange) * 1.0; // Full height for bottom layer

        ctx.fillStyle = '#2d5016'; // Dark green
        ctx.shadowBlur = 0;
        ctx.fillRect(x, y - noteHeight / 2, Math.max(noteWidth, 3), noteHeight);
      });

      // Pass 2: Draw original ML predictions in dark blue (middle layer, on top of green)
      notes.filter(n => n.isML && n.originalNote).forEach((note) => {
        const noteStart = (note.originalNote.startTime || 0);
        const x = (noteStart - timeOffset) * timeScale;
        if (x + (note.originalNote.duration || 0.1) * timeScale < 0 || x > width) return;

        const noteWidth = (note.originalNote.duration || 0.1) * timeScale;
        const y = height - ((note.originalNote.midiNote - minMidi) / midiRange) * height;
        const noteHeight = (height / midiRange) * 0.85; // Slightly smaller to show green underneath

        ctx.fillStyle = '#1a3d5c'; // Dark blue
        ctx.shadowBlur = 0;
        ctx.fillRect(x, y - noteHeight / 2, Math.max(noteWidth, 3), noteHeight);
      });

      // Pass 3: Draw final merged notes in colorful (top layer)
      notes.filter(n => n.isML).forEach((note) => {
        const noteStart = (note.startTime || 0);
        const x = (noteStart - timeOffset) * timeScale;
        if (x + (note.duration || 0.1) * timeScale < 0 || x > width) return;

        const noteWidth = (note.duration || 0.1) * timeScale;
        const y = height - ((note.midiNote - minMidi) / midiRange) * height;
        const noteHeight = (height / midiRange) * 0.7; // Smallest to show all layers below

        const hue = ((note.midiNote % 12) / 12) * 360;
        ctx.fillStyle = `hsl(${hue}, 80%, 55%)`;
        ctx.shadowBlur = 0;
        ctx.fillRect(x, y - noteHeight / 2, Math.max(noteWidth, 3), noteHeight);

        // Note label on top layer
        if (noteWidth > 30) {
          ctx.fillStyle = '#ffffff';
          ctx.font = '11px monospace';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(note.note, x + 3, y);
        }
      });
    } else {
      // Normal rendering (during recording or without debug mode)
      notes.forEach((note, index) => {
        const noteStart = (note.startTime || 0);
        const x = (noteStart - timeOffset) * timeScale;

        // Skip notes outside the visible window
        if (x + (note.duration || 0.1) * timeScale < 0 || x > width) return;

        const noteWidth = (note.duration || 0.1) * timeScale;
        const y = height - ((note.midiNote - minMidi) / midiRange) * height;
        const noteHeight = (height / midiRange) * 0.8;

        // Note rectangle
        const hue = ((note.midiNote % 12) / 12) * 360;

        // Colorful display during recording
        if (note.isLive) {
          ctx.fillStyle = `hsl(${hue}, 100%, 60%)`;
          ctx.shadowBlur = 20;
          ctx.shadowColor = `hsl(${hue}, 100%, 50%)`;
        } else {
          ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
          ctx.shadowBlur = 0;
        }

        ctx.fillRect(x, y - noteHeight / 2, Math.max(noteWidth, 3), noteHeight);
        ctx.shadowBlur = 0; // Reset shadow

        // Note label
        if (noteWidth > 30 || note.isLive) {
          ctx.fillStyle = note.isLive ? '#ffffff' : '#ffffff';
          ctx.font = note.isLive ? 'bold 12px monospace' : '11px monospace';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(note.note, x + 3, y);
        }
      });
    }

    // Draw ghost note during drag (original position)
    if (ghostNote && !isRecording) {
      const noteStart = (ghostNote.startTime || 0);
      const x = (noteStart - timeOffset) * timeScale;
      const noteWidth = (ghostNote.duration || 0.1) * timeScale;
      const y = height - ((ghostNote.midiNote - minMidi) / midiRange) * height;
      const noteHeight = (height / midiRange) * 0.8;

      // Draw ghost as semi-transparent with dashed outline
      ctx.strokeStyle = '#888888';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.globalAlpha = 0.3;
      const hue = ((ghostNote.midiNote % 12) / 12) * 360;
      ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
      ctx.fillRect(x, y - noteHeight / 2, Math.max(noteWidth, 3), noteHeight);
      ctx.strokeRect(x, y - noteHeight / 2, Math.max(noteWidth, 3), noteHeight);
      ctx.globalAlpha = 1.0;
      ctx.setLineDash([]);
    }

    // Draw time cursor if recording
    if (isRecording && maxTime > 0) {
      const cursorX = (maxTime - timeOffset) * timeScale;
      ctx.strokeStyle = '#ff4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cursorX, 0);
      ctx.lineTo(cursorX, height);
      ctx.stroke();
    }

    // Draw time labels
    ctx.fillStyle = '#888888';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const visibleTime = width / timeScale;
    const timeStep = Math.max(1, Math.ceil(visibleTime / 10));
    for (let t = Math.ceil(timeOffset); t <= timeOffset + visibleTime; t += timeStep) {
      const x = (t - timeOffset) * timeScale;
      if (x >= 0 && x <= width) {
        ctx.fillText(`${t.toFixed(1)}s`, x, height - 5);
      }
    }
  };

  // Helper: Convert screen coordinates to note parameters
  const screenToNoteParams = (canvas, clientX, clientY) => {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const width = rect.width;
    const height = rect.height;

    if (notes.length === 0) return null;

    // Use ALL notes for MIDI range calculation (same as drawNotes)
    const allMidiNotes = notes.map(n => n.midiNote).filter(m => m != null);
    if (allMidiNotes.length === 0) return null;

    const minMidi = Math.min(...allMidiNotes) - 2;
    const maxMidi = Math.max(...allMidiNotes) + 2;
    const midiRange = maxMidi - minMidi || 12;

    const maxTime = Math.max(...notes.map(n => (n.startTime || 0) + (n.duration || 0)));
    const totalTime = Math.max(maxTime, 5);
    const timeScale = width / totalTime;

    // Convert x to time
    const time = x / timeScale;

    // Convert y to MIDI note (snap to semitones)
    const midiFloat = minMidi + ((height - y) / height) * midiRange;
    const midiNote = Math.round(midiFloat);

    return { time, midiNote, x, y };
  };

  // Helper: Find note at position
  const findNoteAtPosition = (canvas, clientX, clientY) => {
    const params = screenToNoteParams(canvas, clientX, clientY);
    if (!params) return null;

    const { time, y } = params;
    const mlNotes = notes.filter(n => n.isML);

    // Get canvas dimensions for calculating note bounds
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    // Use ALL notes for MIDI range calculation (same as drawNotes)
    const allMidiNotes = notes.map(n => n.midiNote).filter(m => m != null);
    if (allMidiNotes.length === 0) return null;

    const minMidi = Math.min(...allMidiNotes) - 2;
    const maxMidi = Math.max(...allMidiNotes) + 2;
    const midiRange = maxMidi - minMidi || 12;
    const noteHeight = (height / midiRange) * 0.8;

    // Find note that contains this position (only check ML notes for interaction)
    for (let i = 0; i < mlNotes.length; i++) {
      const note = mlNotes[i];
      const noteStart = note.startTime;
      const noteEnd = note.startTime + note.duration;

      // Calculate note's vertical bounds
      const noteY = height - ((note.midiNote - minMidi) / midiRange) * height;
      const noteTop = noteY - noteHeight / 2;
      const noteBottom = noteY + noteHeight / 2;

      // Check if mouse is within note's horizontal and vertical bounds
      if (time >= noteStart && time <= noteEnd && y >= noteTop && y <= noteBottom) {
        return { note, index: notes.indexOf(note) };
      }
    }

    return null;
  };

  // Helper: Detect if mouse is near note edge (left or right)
  const findNoteEdge = (canvas, clientX, clientY) => {
    const noteAtPos = findNoteAtPosition(canvas, clientX, clientY);
    if (!noteAtPos) return null;

    const params = screenToNoteParams(canvas, clientX, clientY);
    if (!params) return null;

    const { time } = params;
    const note = noteAtPos.note;
    const noteStart = note.startTime;
    const noteEnd = note.startTime + note.duration;

    // Get canvas dimensions for time scale
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const maxTime = Math.max(...notes.map(n => (n.startTime || 0) + (n.duration || 0)));
    const totalTime = Math.max(maxTime, 5);
    const timeScale = width / totalTime;

    // Calculate time threshold for edge detection (8-10px in time units)
    const edgeThreshold = 10 / timeScale; // 10px converted to time

    // Check if near left or right edge
    const distanceFromStart = Math.abs(time - noteStart);
    const distanceFromEnd = Math.abs(time - noteEnd);

    if (distanceFromStart < edgeThreshold) {
      return { edge: 'left', note, index: noteAtPos.index };
    } else if (distanceFromEnd < edgeThreshold) {
      return { edge: 'right', note, index: noteAtPos.index };
    }

    return null;
  };

  // Helper: Get note name from MIDI number
  const getMIDINoteName = (midiNote) => {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midiNote / 12) - 1;
    const noteName = noteNames[midiNote % 12];
    return `${noteName}${octave}`;
  };

  // Mouse move handler (hover detection)
  const handleMouseMove = (e) => {
    if (isRecording || !canvasRef.current) return;

    const canvas = canvasRef.current;

    // If dragging, update drag position
    if (dragState) {
      const params = screenToNoteParams(canvas, e.clientX, e.clientY);
      if (!params) return;

      const { time, midiNote } = params;

      // Create updated note
      const updatedNotes = [...notes];
      if (dragState.noteIndex !== null) {
        if (dragState.stretchEdge === 'left') {
          // Stretching left edge: adjust startTime and duration (keep end fixed)
          const originalEnd = dragState.originalNote.startTime + dragState.originalNote.duration;
          const newStartTime = Math.max(0, Math.min(time, originalEnd - 0.1)); // Min duration 0.1s
          const newDuration = originalEnd - newStartTime;
          updatedNotes[dragState.noteIndex] = {
            ...updatedNotes[dragState.noteIndex],
            startTime: newStartTime,
            duration: newDuration,
          };
        } else if (dragState.stretchEdge === 'right') {
          // Stretching right edge: adjust duration only (keep start fixed)
          const newDuration = Math.max(0.1, time - dragState.originalNote.startTime); // Min duration 0.1s
          updatedNotes[dragState.noteIndex] = {
            ...updatedNotes[dragState.noteIndex],
            duration: newDuration,
          };
        } else {
          // Moving note (not stretching)
          updatedNotes[dragState.noteIndex] = {
            ...updatedNotes[dragState.noteIndex],
            midiNote,
            startTime: Math.max(0, time - dragState.duration / 2),
            note: getMIDINoteName(midiNote),
          };
        }
      } else if (dragState.isCreatingNew) {
        // Update the new note being created
        const duration = Math.max(0.1, time - dragState.startTime);
        updatedNotes[updatedNotes.length - 1] = {
          ...updatedNotes[updatedNotes.length - 1],
          duration,
        };
      }

      onNotesChange?.(updatedNotes);
      return;
    }

    // Check for edge hover to change cursor
    const edgeInfo = findNoteEdge(canvas, e.clientX, e.clientY);
    if (edgeInfo) {
      canvas.style.cursor = 'ew-resize';
      onHoverNoteChange?.(edgeInfo.note.note);
    } else {
      // Hover detection
      canvas.style.cursor = 'default';
      const noteAtPos = findNoteAtPosition(canvas, e.clientX, e.clientY);
      if (noteAtPos) {
        onHoverNoteChange?.(noteAtPos.note.note);
      } else {
        // Show the note at cursor position
        const params = screenToNoteParams(canvas, e.clientX, e.clientY);
        if (params) {
          onHoverNoteChange?.(getMIDINoteName(params.midiNote));
        } else {
          onHoverNoteChange?.(null);
        }
      }
    }
  };

  // Mouse down handler (start drag or create new note)
  const handleMouseDown = (e) => {
    if (isRecording || !canvasRef.current) return;

    // Check if clicking on an edge first (priority over regular note click)
    const edgeInfo = findNoteEdge(canvasRef.current, e.clientX, e.clientY);
    if (edgeInfo) {
      // Start stretching edge
      setGhostNote({ ...edgeInfo.note });
      setDragState({
        noteIndex: edgeInfo.index,
        originalNote: { ...edgeInfo.note },
        startX: e.clientX,
        startY: e.clientY,
        duration: edgeInfo.note.duration,
        stretchEdge: edgeInfo.edge, // 'left' or 'right'
        isCreatingNew: false,
      });
      return;
    }

    const noteAtPos = findNoteAtPosition(canvasRef.current, e.clientX, e.clientY);

    if (noteAtPos) {
      // Start dragging existing note (not near edge)
      setGhostNote({ ...noteAtPos.note });
      setDragState({
        noteIndex: noteAtPos.index,
        originalNote: { ...noteAtPos.note },
        startX: e.clientX,
        startY: e.clientY,
        duration: noteAtPos.note.duration,
        stretchEdge: null, // Not stretching
        isCreatingNew: false,
      });
    } else {
      // Start timer to create new note
      holdTimerRef.current = setTimeout(() => {
        const params = screenToNoteParams(canvasRef.current, e.clientX, e.clientY);
        if (!params) return;

        const { time, midiNote } = params;
        const newNote = {
          midiNote,
          startTime: time,
          duration: 0.1,
          note: getMIDINoteName(midiNote),
          frequency: 440 * Math.pow(2, (midiNote - 69) / 12),
          isML: true,
        };

        const updatedNotes = [...notes, newNote];
        onNotesChange?.(updatedNotes);

        setDragState({
          noteIndex: null,
          originalNote: null,
          startTime: time,
          startX: e.clientX,
          startY: e.clientY,
          isCreatingNew: true,
        });
      }, 300); // 300ms hold to create new note
    }
  };

  // Mouse up handler (end drag)
  const handleMouseUp = (e) => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    if (!dragState) return;

    // Check if dragged off the canvas (delete note)
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      // Use clientX/clientY which work globally even outside canvas
      const isOffCanvas = e.clientX < rect.left || e.clientX > rect.right ||
                          e.clientY < rect.top || e.clientY > rect.bottom;

      if (isOffCanvas && dragState.noteIndex !== null) {
        // Delete the note
        const updatedNotes = notes.filter((_, i) => i !== dragState.noteIndex);
        onNotesChange?.(updatedNotes);
      }
    }

    setDragState(null);
    setGhostNote(null);
  };

  // Double-click handler (delete note)
  const handleDoubleClick = (e) => {
    const noteAtPos = findNoteAtPosition(canvasRef.current, e.clientX, e.clientY);

    if (noteAtPos) {
      // Delete the note
      const updatedNotes = notes.filter((_, i) => i !== noteAtPos.index);
      onNotesChange?.(updatedNotes);
    }
  };

  // Mouse leave handler
  const handleMouseLeave = () => {
    if (!dragState) {
      onHoverNoteChange?.(null);
    }
  };

  // Add event listeners to canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || isRecording) return;

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    canvas.addEventListener('dblclick', handleDoubleClick);
    document.addEventListener('mouseup', handleMouseUp); // Global mouse up

    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      canvas.removeEventListener('dblclick', handleDoubleClick);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isRecording, notes, dragState]);

  return (
    <View style={styles.container}>
      <canvas
        ref={canvasRef}
        style={styles.canvas}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  canvas: {
    width: '100%',
    height: '100%',
  },
});

export default NoteVisualizer;
