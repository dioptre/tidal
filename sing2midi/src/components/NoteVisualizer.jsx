import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';

const NoteVisualizer = ({ notes, isRecording, debugShowComparison }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

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

      if (notes.length === 0) {
        // Show placeholder text
        ctx.fillStyle = '#444444';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
          isRecording ? 'Listening...' : 'Press "Start Recording" to begin',
          width / 2,
          height / 2
        );
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
  }, [notes, isRecording, debugShowComparison]);

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
