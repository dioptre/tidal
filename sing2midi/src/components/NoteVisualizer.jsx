import React, { useMemo, useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Dimensions, Platform, PanResponder } from 'react-native';
import { Canvas, Rect, Text as SkiaText, Line, Group, matchFont, Skia } from '@shopify/react-native-skia';
import { JsiSkTypeface } from '@shopify/react-native-skia/lib/module/skia/web/JsiSkTypeface';

const NoteVisualizer = ({ notes, isRecording, debugShowComparison, hoverNote, onHoverNoteChange, fftData, voiceMode, onNotesChange, playheadPosition, onNoteClick }) => {
  // Audio context for click preview sounds
  const clickAudioContextRef = useRef(null);
  const activeClickOscillatorRef = useRef(null);

  // Play a click preview sound
  const playClickPreview = (midiNote) => {
    // Stop any currently playing preview
    if (activeClickOscillatorRef.current) {
      try {
        activeClickOscillatorRef.current.stop();
      } catch (e) {
        // Already stopped
      }
      activeClickOscillatorRef.current = null;
    }

    // Create audio context if needed
    if (!clickAudioContextRef.current) {
      clickAudioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }

    const audioContext = clickAudioContextRef.current;

    // Resume audio context if it's suspended (required on mobile browsers)
    if (audioContext.state === 'suspended' && audioContext.resume) {
      audioContext.resume().catch(err => {
        console.warn('[Audio] Failed to resume audio context:', err);
      });
    }
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Set frequency from MIDI note
    const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);
    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';

    // Envelope for 0.5 second duration
    const now = audioContext.currentTime;
    const duration = 0.5;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.2, now + 0.01); // Quick attack
    gainNode.gain.linearRampToValueAtTime(0.15, now + 0.03); // Slight decay
    gainNode.gain.setValueAtTime(0.15, now + duration - 0.05); // Sustain
    gainNode.gain.linearRampToValueAtTime(0, now + duration); // Release

    oscillator.start(now);
    oscillator.stop(now + duration);

    activeClickOscillatorRef.current = oscillator;
  };

  // Get canvas dimensions with web compatibility
  const [dimensions, setDimensions] = useState(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const w = Math.floor(window.innerWidth);
      const h = Math.floor(window.innerHeight);
      console.log('[NoteVisualizer] Initial dimensions:', w, h);
      return { width: w, height: h };
    }
    const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
    return {
      width: screenWidth,
      height: screenHeight,
    };
  });

  useEffect(() => {
    if (Platform.OS === 'web') {
      let resizeTimeout;

      const updateDimensions = () => {
        if (canvasRef.current) {
          // Use the parent container's actual dimensions
          const rect = canvasRef.current.getBoundingClientRect();
          const w = Math.floor(rect.width);
          const h = Math.floor(rect.height);
          console.log('[NoteVisualizer] Update dimensions from container:', w, h);
          if (w > 0 && h > 0) {
            setDimensions({ width: w, height: h });
          }
        }
      };

      const handleResize = () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(updateDimensions, 100);
      };

      // Update dimensions after mount to get actual container size
      setTimeout(updateDimensions, 0);

      window.addEventListener('resize', handleResize);
      return () => {
        clearTimeout(resizeTimeout);
        window.removeEventListener('resize', handleResize);
      };
    }
  }, []);

  const { width, height } = dimensions;

  // Interactive state
  const [dragState, setDragState] = useState(null); // { noteIndex, originalNote, startX, startY, isCreatingNew, stretchEdge, duration, startTime }
  const [ghostNote, setGhostNote] = useState(null); // Original position during drag
  const holdTimerRef = useRef(null);
  const [zoomX, setZoomX] = useState(1.0); // Horizontal zoom (time axis)
  const [zoomY, setZoomY] = useState(1.0); // Vertical zoom (pitch axis)
  const [panOffsetX, setPanOffsetX] = useState(0); // Pan offset in seconds (horizontal)
  const [panOffsetY, setPanOffsetY] = useState(0); // Pan offset in semitones (vertical)
  const touchStateRef = useRef({
    isPinching: false,
    isPanning: false,
    lastDistance: null,
    lastTouches: null,
    lastTouchTime: 0,
    lastTouchPos: { x: 0, y: 0 }
  });
  const canvasRef = useRef(null);
  const lastClickTimeRef = useRef(0);
  const lastClickPosRef = useRef({ x: 0, y: 0 });

  // Refs for worklet access
  const dragStateRef = useRef(null);
  const isRecordingRef = useRef(isRecording);

  // Keep refs in sync with state
  useEffect(() => {
    dragStateRef.current = dragState;
  }, [dragState]);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);
  const [animationTime, setAnimationTime] = useState(0); // Animation time for Möbius strip

  // Animation loop for Möbius strip when idle
  useEffect(() => {
    if (notes.length === 0 && !isRecording) {
      const animationId = setInterval(() => {
        setAnimationTime(Date.now() / 1000);
      }, 1000 / 30); // 30 FPS

      return () => clearInterval(animationId);
    }
  }, [notes.length, isRecording]);

  // Render animated Möbius strip when idle
  const renderMobiusStrip = () => {
    if (notes.length > 0 || isRecording) {
      // console.log('[Möbius] Skipping - notes:', notes.length, 'recording:', isRecording);
      return null;
    }

    // console.log('[Möbius] Rendering at time:', animationTime, 'dims:', width, height);

    const centerX = width / 2;
    const centerY = height / 2;
    const time = animationTime; // Use animation time state for smooth animation
    const numSegments = 60; // Number of segments to draw the strip
    const radius = Math.min(width, height) * 0.27; // Radius of the Möbius strip (reduced by 10%)
    const stripWidth = 40; // Width of the strip

    const segments = [];

    for (let i = 0; i < numSegments; i++) {
      const t = (i / numSegments) * Math.PI * 2; // Parameter along the strip
      const t2 = ((i + 1) / numSegments) * Math.PI * 2;

      // Möbius strip parametric equations
      // x = (R + s * cos(t/2)) * cos(t)
      // y = (R + s * cos(t/2)) * sin(t)
      // z = s * sin(t/2)

      const rotation = time * 0.5; // Slow rotation

      // Calculate positions for this segment (using z for shading)
      const s = stripWidth / 2;
      const x1 = (radius + s * Math.cos(t / 2)) * Math.cos(t + rotation);
      const y1 = (radius + s * Math.cos(t / 2)) * Math.sin(t + rotation);
      const z1 = s * Math.sin(t / 2);

      const x2 = (radius + s * Math.cos(t2 / 2)) * Math.cos(t2 + rotation);
      const y2 = (radius + s * Math.cos(t2 / 2)) * Math.sin(t2 + rotation);
      const z2 = s * Math.sin(t2 / 2);

      const x3 = (radius - s * Math.cos(t2 / 2)) * Math.cos(t2 + rotation);
      const y3 = (radius - s * Math.cos(t2 / 2)) * Math.sin(t2 + rotation);
      const z3 = -s * Math.sin(t2 / 2);

      const x4 = (radius - s * Math.cos(t / 2)) * Math.cos(t + rotation);
      const y4 = (radius - s * Math.cos(t / 2)) * Math.sin(t + rotation);
      const z4 = -s * Math.sin(t / 2);

      // Use z-depth for color shading (depth cueing)
      const avgZ = (z1 + z2 + z3 + z4) / 4;
      const brightness = 0.3 + (avgZ / stripWidth + 0.5) * 0.5; // Map z to brightness
      const hue = (i / numSegments) * 360; // Rainbow colors along the strip
      const color = `hsla(${hue}, 70%, ${brightness * 50}%, 0.9)`;

      // Only render front-facing segments (simple backface culling)
      if (avgZ > -stripWidth * 0.3) {
        segments.push(
          <Rect
            key={`mobius-${i}`}
            x={centerX + x1 - 2}
            y={centerY + y1 - 2}
            width={4}
            height={4}
            color={color}
          />
        );
      }
    }

    return (
      <Group>
        {segments}
        {font && (
          <SkiaText
            x={centerX - 80}
            y={centerY - radius - 60}
            text="Let's make music..."
            font={titleFont || font}
            color="#666666"
          />
        )}
      </Group>
    );
  };

  // Load fonts from TTF files on web, use matchFont on native
  const [fontTypeface, setFontTypeface] = useState(null);
  const [titleFontTypeface, setTitleFontTypeface] = useState(null);

  useEffect(() => {
    if (Platform.OS === 'web') {
      // Load Inter Regular font
      console.log('[Font] Loading Inter-Regular.ttf...');
      fetch('/Inter-Regular.ttf')
        .then(response => response.arrayBuffer())
        .then(buffer => {
          console.log('[Font] Loaded buffer, size:', buffer.byteLength);
          const uint8Array = new Uint8Array(buffer);

          // Try using CanvasKit directly
          const CanvasKit = window.CanvasKit || global.CanvasKit;
          if (CanvasKit && CanvasKit.Typeface) {
            console.log('[Font] Available CanvasKit.Typeface methods:', Object.keys(CanvasKit.Typeface));

            // Try all available methods
            let canvasKitTypeface = null;

            // Try MakeTypefaceFromData first (simpler API)
            if (CanvasKit.Typeface.MakeTypefaceFromData) {
              console.log('[Font] Trying MakeTypefaceFromData...');
              canvasKitTypeface = CanvasKit.Typeface.MakeTypefaceFromData(uint8Array);
              if (canvasKitTypeface) {
                console.log('[Font] MakeTypefaceFromData succeeded!');
              }
            }

            // Try MakeFreeTypeFaceFromData if first method failed
            if (!canvasKitTypeface && CanvasKit.Typeface.MakeFreeTypeFaceFromData) {
              console.log('[Font] Trying MakeFreeTypeFaceFromData...');
              canvasKitTypeface = CanvasKit.Typeface.MakeFreeTypeFaceFromData(uint8Array);
              if (canvasKitTypeface) {
                console.log('[Font] MakeFreeTypeFaceFromData succeeded!');
              }
            }

            if (canvasKitTypeface) {
              console.log('[Font] CanvasKit typeface created successfully, wrapping it...');
              // Wrap in JsiSkTypeface for Skia compatibility
              const wrappedTypeface = new JsiSkTypeface(CanvasKit, canvasKitTypeface);
              setFontTypeface(wrappedTypeface);
            } else {
              console.warn('[Font] All typeface creation methods returned null');
            }
          }
        })
        .catch(err => console.error('[Font] Failed to load Inter-Regular.ttf:', err));

      // Load Inter SemiBold font
      console.log('[Font] Loading Inter-SemiBold.ttf...');
      fetch('/Inter-SemiBold.ttf')
        .then(response => response.arrayBuffer())
        .then(buffer => {
          console.log('[Font] Loaded title buffer, size:', buffer.byteLength);
          const uint8Array = new Uint8Array(buffer);

          const CanvasKit = window.CanvasKit || global.CanvasKit;
          if (CanvasKit && CanvasKit.Typeface) {
            let canvasKitTypeface = null;

            // Try MakeTypefaceFromData first
            if (CanvasKit.Typeface.MakeTypefaceFromData) {
              console.log('[Font] Trying MakeTypefaceFromData for title...');
              canvasKitTypeface = CanvasKit.Typeface.MakeTypefaceFromData(uint8Array);
              if (canvasKitTypeface) {
                console.log('[Font] Title MakeTypefaceFromData succeeded!');
              }
            }

            // Try MakeFreeTypeFaceFromData if first method failed
            if (!canvasKitTypeface && CanvasKit.Typeface.MakeFreeTypeFaceFromData) {
              console.log('[Font] Trying MakeFreeTypeFaceFromData for title...');
              canvasKitTypeface = CanvasKit.Typeface.MakeFreeTypeFaceFromData(uint8Array);
              if (canvasKitTypeface) {
                console.log('[Font] Title MakeFreeTypeFaceFromData succeeded!');
              }
            }

            if (canvasKitTypeface) {
              console.log('[Font] CanvasKit title typeface created successfully, wrapping it...');
              // Wrap in JsiSkTypeface for Skia compatibility
              const wrappedTypeface = new JsiSkTypeface(CanvasKit, canvasKitTypeface);
              setTitleFontTypeface(wrappedTypeface);
            } else {
              console.warn('[Font] All title typeface creation methods returned null');
            }
          }
        })
        .catch(err => console.error('[Font] Failed to load Inter-SemiBold.ttf:', err));

      // If font loading fails, use GetDefault as fallback
      const CanvasKit = window.CanvasKit || global.CanvasKit;
      if (CanvasKit && CanvasKit.Typeface && CanvasKit.Typeface.GetDefault) {
        console.log('[Font] Getting default typeface as fallback...');
        const canvasKitDefaultTypeface = CanvasKit.Typeface.GetDefault();
        if (canvasKitDefaultTypeface) {
          console.log('[Font] Default typeface available, wrapping it...');
          // Wrap the CanvasKit typeface in JsiSkTypeface so Skia.Font can use it
          const wrappedTypeface = new JsiSkTypeface(CanvasKit, canvasKitDefaultTypeface);
          console.log('[Font] Wrapped default typeface:', wrappedTypeface);

          // Set both fonts to default for now so we get SOME text
          setTimeout(() => {
            if (!fontTypeface) {
              console.log('[Font] Using default typeface for main font');
              setFontTypeface(wrappedTypeface);
            }
            if (!titleFontTypeface) {
              console.log('[Font] Using default typeface for title font');
              setTitleFontTypeface(wrappedTypeface);
            }
          }, 1000); // Give custom fonts 1 second to load
        }
      }
    }
  }, []);

  const font = useMemo(() => {
    if (Platform.OS === 'web') {
      if (fontTypeface) {
        try {
          const font = Skia.Font(fontTypeface, 12);
          console.log('[Font] Created font with Inter Regular, size 12');
          return font;
        } catch (e) {
          console.warn('[Font] Failed to create font:', e);
          return null;
        }
      }
      return null; // Font not loaded yet
    } else {
      // On native, use matchFont
      try {
        const nativeFont = matchFont({
          fontFamily: 'sans-serif',
          fontSize: 12,
        });
        console.log('[Font] Created native font with matchFont');
        return nativeFont;
      } catch (e) {
        console.error('[Font] Failed to create native font:', e);
        return null;
      }
    }
  }, [fontTypeface]);

  const titleFont = useMemo(() => {
    if (Platform.OS === 'web') {
      if (titleFontTypeface) {
        try {
          const font = Skia.Font(titleFontTypeface, 14);
          console.log('[Font] Created title font with Inter SemiBold, size 14');
          return font;
        } catch (e) {
          console.warn('[Font] Failed to create title font:', e);
          return null;
        }
      }
      return null; // Font not loaded yet
    } else {
      try {
        const nativeTitleFont = matchFont({
          fontFamily: 'sans-serif',
          fontSize: 14,
          fontWeight: 'bold',
        });
        console.log('[Font] Created native title font with matchFont');
        return nativeTitleFont;
      } catch (e) {
        console.error('[Font] Failed to create native title font:', e);
        return null;
      }
    }
  }, [titleFontTypeface]);

  // Calculate note range for vertical scaling (with zoom and pan)
  const { minMidiAdjusted, midiRangeAdjusted, minMidi, midiRange } = useMemo(() => {
    if (notes.length === 0) {
      return { minMidiAdjusted: 60, midiRangeAdjusted: 12, minMidi: 60, midiRange: 12 };
    }

    const midiNotes = notes.map(n => n.midiNote).filter(m => m != null);
    if (midiNotes.length === 0) {
      return { minMidiAdjusted: 60, midiRangeAdjusted: 12, minMidi: 60, midiRange: 12 };
    }

    const minMidi = Math.min(...midiNotes) - 2;
    const maxMidi = Math.max(...midiNotes) + 2;
    const midiRange = maxMidi - minMidi || 12;

    // Apply vertical zoom and pan
    const midiRangeAdjusted = isRecording ? midiRange : (midiRange / zoomY);
    const minMidiAdjusted = isRecording ? minMidi : (minMidi + panOffsetY);

    return { minMidiAdjusted, midiRangeAdjusted, minMidi, midiRange };
  }, [notes, isRecording, zoomY, panOffsetY]);

  // Calculate time range for horizontal scaling (with zoom and pan)
  const { maxTime, timeScale, timeOffset, totalTime } = useMemo(() => {
    if (notes.length === 0) {
      return { maxTime: 5, timeScale: width / 5, timeOffset: 0, totalTime: 5 };
    }

    const maxTime = Math.max(...notes.map(n => (n.startTime || 0) + (n.duration || 0)));

    if (isRecording) {
      const windowSize = 5;
      const timeScale = width / windowSize;
      const timeOffset = Math.max(0, maxTime - windowSize + 1);
      return { maxTime, timeScale, timeOffset, totalTime: maxTime };
    } else {
      const totalTime = Math.max(maxTime, 5);
      const timeScale = (width / totalTime) * zoomX;
      const timeOffset = panOffsetX;
      return { maxTime, timeScale, timeOffset, totalTime };
    }
  }, [notes, width, isRecording, zoomX, panOffsetX]);

  // Helper: Convert MIDI note to HSL color
  const midiToColor = (midiNote, opacity = 1) => {
    const hue = ((midiNote % 12) / 12) * 360;
    return `hsla(${hue}, 70%, 50%, ${opacity})`;
  };

  // Helper: Get note name from MIDI number
  const getMIDINoteName = (midiNote) => {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midiNote / 12) - 1;
    const noteName = noteNames[midiNote % 12];
    return `${noteName}${octave}`;
  };

  // Helper: Convert screen coordinates to note parameters
  const screenToNoteParams = (x, y) => {
    if (notes.length === 0) return null;

    // Convert x to time (account for pan offset when not recording)
    const time = (x / timeScale) + timeOffset;

    // Convert y to MIDI note (snap to semitones)
    const midiFloat = minMidiAdjusted + ((height - y) / height) * midiRangeAdjusted;
    const midiNote = Math.round(midiFloat);

    return { time, midiNote, x, y };
  };

  // Helper: Find note at position
  const findNoteAtPosition = (x, y) => {
    const params = screenToNoteParams(x, y);
    if (!params) return null;

    const { time } = params;
    const mlNotes = notes.filter(n => n.isML);

    const noteHeight = (height / midiRangeAdjusted) * 0.8;

    // Find note that contains this position (only check ML notes for interaction)
    for (let i = 0; i < mlNotes.length; i++) {
      const note = mlNotes[i];
      const noteStart = note.startTime;
      const noteEnd = note.startTime + note.duration;

      // Calculate note's vertical bounds
      const noteY = height - ((note.midiNote - minMidiAdjusted) / midiRangeAdjusted) * height;
      const noteTop = noteY - noteHeight / 2;
      const noteBottom = noteY + noteHeight / 2;

      // Check if touch is within note's horizontal and vertical bounds
      if (time >= noteStart && time <= noteEnd && y >= noteTop && y <= noteBottom) {
        return { note, index: notes.indexOf(note) };
      }
    }

    return null;
  };

  // Helper: Detect if touch is near note edge (left or right)
  const findNoteEdge = (x, y) => {
    const noteAtPos = findNoteAtPosition(x, y);
    if (!noteAtPos) return null;

    const params = screenToNoteParams(x, y);
    if (!params) return null;

    const { time } = params;
    const note = noteAtPos.note;
    const noteStart = note.startTime;
    const noteEnd = note.startTime + note.duration;

    // Calculate time threshold for edge detection (10px in time units)
    const edgeThreshold = 10 / timeScale;

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

  // Touch/Mouse handlers
  const handleTouchStart = (x, y) => {
    if (isRecording) return;

    // Play click preview sound for the note at cursor position
    const params = screenToNoteParams(x, y);
    if (params) {
      playClickPreview(params.midiNote);
    }

    // Check if there are no ML notes - if so, create initial C4 note on any click
    const mlNotes = notes.filter(n => n.isML);
    if (mlNotes.length === 0) {
      // Create initial C4 note (MIDI 60) starting at 1s, duration 2s
      const initialNote = {
        midiNote: 60, // C4 (middle C)
        startTime: 1.0,
        duration: 2.0,
        note: 'C4',
        frequency: 440 * Math.pow(2, (60 - 69) / 12), // ~261.63 Hz
        isML: true,
      };
      const updatedNotes = [...notes, initialNote];
      onNotesChange?.(updatedNotes);
      return;
    }

    // Check if clicking on an edge first (priority over regular note click)
    const edgeInfo = findNoteEdge(x, y);
    if (edgeInfo) {
      // Save to undo stack before starting to drag/stretch
      onNotesChange?.(notes, false);

      // Track this note click for delete key functionality
      onNoteClick?.(edgeInfo.index);

      // Start stretching edge
      setGhostNote({ ...edgeInfo.note });
      setDragState({
        noteIndex: edgeInfo.index,
        originalNote: { ...edgeInfo.note },
        startX: x,
        startY: y,
        duration: edgeInfo.note.duration,
        stretchEdge: edgeInfo.edge,
        isCreatingNew: false,
      });
      // Change cursor to resizing on web
      if (Platform.OS === 'web' && canvasRef.current) {
        canvasRef.current.style.cursor = 'ew-resize';
      }
      return;
    }

    const noteAtPos = findNoteAtPosition(x, y);

    if (noteAtPos) {
      // Save to undo stack before starting to drag
      onNotesChange?.(notes, false);

      // Track this note click for delete key functionality
      onNoteClick?.(noteAtPos.index);

      // Start dragging existing note
      setGhostNote({ ...noteAtPos.note });
      setDragState({
        noteIndex: noteAtPos.index,
        originalNote: { ...noteAtPos.note },
        startX: x,
        startY: y,
        duration: noteAtPos.note.duration,
        stretchEdge: null,
        isCreatingNew: false,
      });
      // Change cursor to grabbing on web
      if (Platform.OS === 'web' && canvasRef.current) {
        canvasRef.current.style.cursor = 'grabbing';
      }
    } else {
      // Start timer to create new note
      holdTimerRef.current = setTimeout(() => {
        const params = screenToNoteParams(x, y);
        if (!params) return;

        const { time, midiNote } = params;
        const newNote = {
          midiNote,
          startTime: time,
          duration: 0.2,
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
          startX: x,
          startY: y,
          isCreatingNew: true,
        });
      }, 300); // 300ms hold to create new note
    }
  };

  const handleTouchMove = (x, y) => {
    if (isRecording || !dragState) return;

    const params = screenToNoteParams(x, y);
    if (!params) return;

    const { time, midiNote } = params;

    // Create updated note
    const updatedNotes = [...notes];
    if (dragState.noteIndex !== null) {
      if (dragState.stretchEdge === 'left') {
        // Stretching left edge: adjust startTime and duration (keep end fixed)
        const originalEnd = dragState.originalNote.startTime + dragState.originalNote.duration;
        const newStartTime = Math.max(0, Math.min(time, originalEnd - 0.1));
        const newDuration = originalEnd - newStartTime;
        updatedNotes[dragState.noteIndex] = {
          ...updatedNotes[dragState.noteIndex],
          startTime: newStartTime,
          duration: newDuration,
        };
      } else if (dragState.stretchEdge === 'right') {
        // Stretching right edge: adjust duration only (keep start fixed)
        const newDuration = Math.max(0.1, time - dragState.originalNote.startTime);
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

    // Pass true for intermediate updates during drag
    onNotesChange?.(updatedNotes, true);
  };

  const handleTouchEnd = (x, y) => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    if (!dragState) return;

    // Check if dragged off the canvas (delete note)
    const isOffCanvas = x < 0 || x > width || y < 0 || y > height;

    if (isOffCanvas && dragState.noteIndex !== null) {
      // Delete the note
      const updatedNotes = notes.filter((_, i) => i !== dragState.noteIndex);
      onNotesChange?.(updatedNotes, true);
    }

    setDragState(null);
    setGhostNote(null);
  };

  const handleMouseMove = (x, y) => {
    if (isRecording) return;

    // If dragging, update drag position
    if (dragState) {
      handleTouchMove(x, y);
      return;
    }

    // Check for edge hover
    const edgeInfo = findNoteEdge(x, y);
    if (edgeInfo) {
      // Change cursor to resize on web
      if (Platform.OS === 'web' && canvasRef.current) {
        canvasRef.current.style.cursor = 'ew-resize';
      }
      onHoverNoteChange?.(edgeInfo.note.note, true);
    } else {
      // Hover detection
      const noteAtPos = findNoteAtPosition(x, y);
      if (noteAtPos) {
        // Change cursor to pointer on web
        if (Platform.OS === 'web' && canvasRef.current) {
          canvasRef.current.style.cursor = 'grab';
        }
        onHoverNoteChange?.(noteAtPos.note.note, true);
      } else {
        // Show the note at cursor position
        if (Platform.OS === 'web' && canvasRef.current) {
          canvasRef.current.style.cursor = 'crosshair';
        }
        const params = screenToNoteParams(x, y);
        if (params) {
          onHoverNoteChange?.(getMIDINoteName(params.midiNote), false);
        } else {
          onHoverNoteChange?.(null, false);
        }
      }
    }
  };

  const handleDoubleClick = (x, y) => {
    if (isRecording) return;

    const noteAtPos = findNoteAtPosition(x, y);

    if (noteAtPos) {
      // Delete the note
      const updatedNotes = notes.filter((_, i) => i !== noteAtPos.index);
      onNotesChange?.(updatedNotes);
    }
  };

  // Wheel handler for zoom and pan (web only)
  const handleWheel = (e) => {
    if (isRecording) return;

    e.preventDefault();

    // On macOS/Firefox, pinch-to-zoom shows as wheel event with ctrlKey
    if (e.ctrlKey || e.metaKey || e.shiftKey) {
      // Pinch-to-zoom or Shift+scroll to zoom
      const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoomX = Math.max(0.5, Math.min(5.0, zoomX * zoomDelta));
      const newZoomY = Math.max(0.5, Math.min(5.0, zoomY * zoomDelta));
      setZoomX(newZoomX);
      setZoomY(newZoomY);
    } else if (Math.abs(e.deltaX) > 0 || Math.abs(e.deltaY) > 0) {
      // Two-finger pan (trackpad swipe)
      // Pan horizontally (time)
      const deltaTime = e.deltaX / timeScale;
      const newPanOffsetX = Math.max(0, Math.min(totalTime - width / timeScale, panOffsetX + deltaTime));
      setPanOffsetX(newPanOffsetX);

      // Pan vertically (pitch)
      const deltaSemitones = (e.deltaY / height) * midiRangeAdjusted;
      const newPanOffsetY = Math.max(-midiRange / 2, Math.min(midiRange / 2, panOffsetY + deltaSemitones));
      setPanOffsetY(newPanOffsetY);
    }
  };

  // Touch handlers for pinch-to-zoom and two-finger pan (iOS)
  const handleTwoFingerStart = (touches) => {
    if (isRecording || touches.length !== 2) return;

    const touch1 = touches[0];
    const touch2 = touches[1];

    // Calculate initial distance between touches
    const distance = Math.hypot(
      touch2.x - touch1.x,
      touch2.y - touch1.y
    );

    touchStateRef.current = {
      isPinching: true,
      lastDistance: distance,
      lastTouches: {
        x: (touch1.x + touch2.x) / 2,
        y: (touch1.y + touch2.y) / 2,
      },
    };
  };

  const handleTwoFingerMove = (touches) => {
    if (isRecording || !touchStateRef.current.isPinching || touches.length !== 2) return;

    const touch1 = touches[0];
    const touch2 = touches[1];

    // Calculate current distance
    const distance = Math.hypot(
      touch2.x - touch1.x,
      touch2.y - touch1.y
    );

    // Calculate center point
    const centerX = (touch1.x + touch2.x) / 2;
    const centerY = (touch1.y + touch2.y) / 2;

    if (touchStateRef.current.lastDistance && touchStateRef.current.lastTouches) {
      const distanceChange = Math.abs(distance - touchStateRef.current.lastDistance);
      const centerMovement = Math.hypot(
        centerX - touchStateRef.current.lastTouches.x,
        centerY - touchStateRef.current.lastTouches.y
      );

      // If distance is changing significantly, it's primarily a zoom
      if (distanceChange > centerMovement * 0.5) {
        const scale = distance / touchStateRef.current.lastDistance;
        const newZoomX = Math.max(0.5, Math.min(5.0, zoomX * scale));
        const newZoomY = Math.max(0.5, Math.min(5.0, zoomY * scale));
        setZoomX(newZoomX);
        setZoomY(newZoomY);
      }

      // Always pan based on center movement
      if (centerMovement > 1) {
        const deltaX = centerX - touchStateRef.current.lastTouches.x;
        const deltaTime = -deltaX / timeScale;
        const newPanOffsetX = Math.max(0, Math.min(totalTime - width / timeScale, panOffsetX + deltaTime));
        setPanOffsetX(newPanOffsetX);

        const deltaY = touchStateRef.current.lastTouches.y - centerY;
        const deltaSemitones = (deltaY / height) * midiRangeAdjusted;
        const newPanOffsetY = Math.max(-midiRange / 2, Math.min(midiRange / 2, panOffsetY + deltaSemitones));
        setPanOffsetY(newPanOffsetY);
      }
    }

    touchStateRef.current.lastDistance = distance;
    touchStateRef.current.lastTouches = { x: centerX, y: centerY };
  };

  const handleTwoFingerEnd = (touches) => {
    if (touches.length < 2) {
      touchStateRef.current = { isPinching: false, lastDistance: null, lastTouches: null };
    }
  };

  // Render FFT visualization bars
  const renderFFT = () => {
    if (!isRecording || voiceMode || !fftData) {
      // console.log('[FFT] Skipping - recording:', isRecording, 'voiceMode:', voiceMode, 'fftData:', !!fftData);
      return null;
    }

    // console.log('[FFT] Rendering', fftData.length, 'samples');

    const bufferLength = fftData.length;
    const numBars = 64;
    const barWidth = width / numBars;

    return (
      <Group>
        {Array.from({ length: numBars }).map((_, i) => {
          const dataIndex = Math.floor((i / numBars) * (bufferLength * 0.5));
          const value = fftData[dataIndex] / 255.0;
          const barHeight = value * height * 0.8;
          const x = i * barWidth;
          const y = height - barHeight;

          const hue = 200 - (i / numBars) * 160;
          const saturation = 70 + value * 30;
          const lightness = 40 + value * 30;

          return (
            <Rect
              key={i}
              x={x}
              y={y}
              width={barWidth - 1}
              height={barHeight}
              color={`hsl(${hue}, ${saturation}%, ${lightness}%)`}
            />
          );
        })}
      </Group>
    );
  };

  // Render grid lines (octave markers)
  const renderGrid = () => {
    const lines = [];
    const labels = [];

    for (let midi = Math.floor(minMidiAdjusted); midi <= Math.ceil(minMidiAdjusted + midiRangeAdjusted); midi++) {
      if (midi % 12 === 0) { // C notes
        const y = height - ((midi - minMidiAdjusted) / midiRangeAdjusted) * height;
        if (y >= 0 && y <= height) {
          lines.push(
            <Line
              key={`line-${midi}`}
              p1={{ x: 0, y }}
              p2={{ x: width, y }}
              color="#222222"
              strokeWidth={1}
            />
          );

          const octave = Math.floor((midi - 12) / 12);
          // Only render text if we have a font
          if (font) {
            labels.push(
              <SkiaText
                key={`label-${midi}`}
                x={5}
                y={y + 4}
                text={`C${octave}`}
                font={font}
                color="#444444"
              />
            );
          }
        }
      }
    }

    return <Group>{lines}{labels}</Group>;
  };

  // Render notes as rectangles
  const renderNotes = () => {
    if (notes.length === 0) {
      // console.log('[Notes] Skipping - no notes');
      return null;
    }

    // Log once when we first get notes
    const liveCount = notes.filter(n => n.isLive).length;
    const mlCount = notes.filter(n => n.isML).length;
    if (notes.length > 0 && liveCount + mlCount === notes.length) {
      console.log(`[Notes] Rendering ${notes.length} total (${liveCount} live, ${mlCount} ML)`);
    }

    const noteRects = [];

    // In debug mode, render in 3 passes: live (green), ML original (blue), final (colorful)
    if (debugShowComparison && !isRecording) {
      // Pass 1: Live detections (dark green)
      notes.filter(n => n.isLive).forEach((note, i) => {
        const noteStart = note.startTime || 0;
        const x = (noteStart - timeOffset) * timeScale;
        if (x + (note.duration || 0.1) * timeScale < 0 || x > width) return;

        const noteWidth = (note.duration || 0.1) * timeScale;
        const y = height - ((note.midiNote - minMidiAdjusted) / midiRangeAdjusted) * height;
        const noteHeight = (height / midiRangeAdjusted) * 1.0;

        if (y < -noteHeight || y > height + noteHeight) return;

        noteRects.push(
          <Rect
            key={`live-${i}`}
            x={x}
            y={y - noteHeight / 2}
            width={Math.max(noteWidth, 3)}
            height={noteHeight}
            color="#2d5016"
          />
        );
      });

      // Pass 2: Original ML predictions (dark blue)
      notes.filter(n => n.isML && n.originalNote).forEach((note, i) => {
        const noteStart = note.originalNote.startTime || 0;
        const x = (noteStart - timeOffset) * timeScale;
        if (x + (note.originalNote.duration || 0.1) * timeScale < 0 || x > width) return;

        const noteWidth = (note.originalNote.duration || 0.1) * timeScale;
        const y = height - ((note.originalNote.midiNote - minMidiAdjusted) / midiRangeAdjusted) * height;
        const noteHeight = (height / midiRangeAdjusted) * 0.85;

        if (y < -noteHeight || y > height + noteHeight) return;

        noteRects.push(
          <Rect
            key={`ml-orig-${i}`}
            x={x}
            y={y - noteHeight / 2}
            width={Math.max(noteWidth, 3)}
            height={noteHeight}
            color="#1a3d5c"
          />
        );
      });

      // Pass 3: Final merged notes (colorful)
      notes.filter(n => n.isML).forEach((note, i) => {
        const noteStart = note.startTime || 0;
        const x = (noteStart - timeOffset) * timeScale;
        if (x + (note.duration || 0.1) * timeScale < 0 || x > width) return;

        const noteWidth = (note.duration || 0.1) * timeScale;
        const y = height - ((note.midiNote - minMidiAdjusted) / midiRangeAdjusted) * height;
        const noteHeight = (height / midiRangeAdjusted) * 0.7;

        if (y < -noteHeight || y > height + noteHeight) return;

        const isHovered = hoverNote === note.note;
        const color = isHovered ? midiToColor(note.midiNote, 0.9) : midiToColor(note.midiNote, 0.7);

        noteRects.push(
          <Rect
            key={`final-${i}`}
            x={x}
            y={y - noteHeight / 2}
            width={Math.max(noteWidth, 3)}
            height={noteHeight}
            color={color}
          />
        );

        // Note label (only on native - web doesn't support matchFont)
        if ((noteWidth > 30 || isHovered) && font && note.note) {
          const textFont = isHovered ? titleFont : font;
          noteRects.push(
            <SkiaText
              key={`label-final-${i}`}
              x={x + 3}
              y={y + 4}
              text={note.note}
              font={textFont}
              color="#ffffff"
            />
          );
        }
      });
    } else {
      // Normal rendering (during recording or without debug mode)
      // console.log('[Notes] Normal rendering mode, isRecording:', isRecording);
      notes.forEach((note, i) => {
        const noteStart = note.startTime || 0;
        const x = (noteStart - timeOffset) * timeScale;

        // if (i < 3 || note.isLive) {
        //   console.log('[Notes] Note', i, ':', {
        //     isLive: note.isLive,
        //     note: note.note,
        //     startTime: noteStart,
        //     x,
        //     timeOffset,
        //     timeScale,
        //     width,
        //     midiNote: note.midiNote,
        //     minMidiAdjusted,
        //     midiRangeAdjusted,
        //   });
        // }

        if (x + (note.duration || 0.1) * timeScale < 0 || x > width) {
          // if (i < 3 || note.isLive) console.log('[Notes] Skipping - out of horizontal bounds');
          return;
        }

        const noteWidth = (note.duration || 0.1) * timeScale;
        const y = height - ((note.midiNote - minMidiAdjusted) / midiRangeAdjusted) * height;
        const noteHeight = (height / midiRangeAdjusted) * 0.8;

        if (y < -noteHeight || y > height + noteHeight) {
          // if (i < 3 || note.isLive) console.log('[Notes] Skipping - out of vertical bounds, y:', y, 'height:', height);
          return;
        }

        const isHovered = hoverNote === note.note;
        const isLive = note.isLive;

        let color;
        if (isLive) {
          color = midiToColor(note.midiNote, 1.0);
        } else if (isHovered) {
          color = midiToColor(note.midiNote, 0.9);
        } else {
          color = midiToColor(note.midiNote, 0.7);
        }

        noteRects.push(
          <Rect
            key={`note-${i}`}
            x={x}
            y={y - noteHeight / 2}
            width={Math.max(noteWidth, 3)}
            height={noteHeight}
            color={color}
          />
        );

        // Note label (only render if note name exists)
        if ((noteWidth > 30 || isLive || isHovered) && note.note) {
          const textFont = isLive || isHovered ? titleFont : font;
          noteRects.push(
            <SkiaText
              key={`label-${i}`}
              x={x + 3}
              y={y + 4}
              text={note.note}
              {...(textFont ? { font: textFont } : { size: isLive || isHovered ? 14 : 12 })}
              color="#ffffff"
            />
          );
        }
      });
    }

    return <Group>{noteRects}</Group>;
  };

  // Render ghost note during drag
  const renderGhostNote = () => {
    if (!ghostNote || isRecording) return null;

    const noteStart = ghostNote.startTime || 0;
    const x = (noteStart - timeOffset) * timeScale;
    const noteWidth = (ghostNote.duration || 0.1) * timeScale;
    const y = height - ((ghostNote.midiNote - minMidiAdjusted) / midiRangeAdjusted) * height;
    const noteHeight = (height / midiRangeAdjusted) * 0.8;

    const hue = ((ghostNote.midiNote % 12) / 12) * 360;
    const rectWidth = Math.max(noteWidth, 3);
    const rectY = y - noteHeight / 2;

    return (
      <Group opacity={0.3}>
        {/* Fill */}
        <Rect
          x={x}
          y={rectY}
          width={rectWidth}
          height={noteHeight}
          color={`hsl(${hue}, 70%, 50%)`}
        />
        {/* Dashed border - simulate with multiple short lines */}
        {/* Top edge */}
        <Line
          p1={{ x: x, y: rectY }}
          p2={{ x: x + rectWidth, y: rectY }}
          color="#888888"
          strokeWidth={2}
        />
        {/* Right edge */}
        <Line
          p1={{ x: x + rectWidth, y: rectY }}
          p2={{ x: x + rectWidth, y: rectY + noteHeight }}
          color="#888888"
          strokeWidth={2}
        />
        {/* Bottom edge */}
        <Line
          p1={{ x: x + rectWidth, y: rectY + noteHeight }}
          p2={{ x: x, y: rectY + noteHeight }}
          color="#888888"
          strokeWidth={2}
        />
        {/* Left edge */}
        <Line
          p1={{ x: x, y: rectY + noteHeight }}
          p2={{ x: x, y: rectY }}
          color="#888888"
          strokeWidth={2}
        />
      </Group>
    );
  };

  // Render time cursor during recording
  const renderTimeCursor = () => {
    if (!isRecording || maxTime <= 0) return null;

    const cursorX = (maxTime - timeOffset) * timeScale;

    return (
      <Line
        p1={{ x: cursorX, y: 0 }}
        p2={{ x: cursorX, y: height }}
        color="#ff4444"
        strokeWidth={2}
      />
    );
  };

  // Render playback playhead
  const renderPlayhead = () => {
    if (playheadPosition === null || playheadPosition === undefined) return null;

    const playheadX = (playheadPosition - timeOffset) * timeScale;

    // Only render if visible on screen
    if (playheadX < 0 || playheadX > width) {
      return null;
    }

    return (
      <Line
        p1={{ x: playheadX, y: 0 }}
        p2={{ x: playheadX, y: height }}
        color="rgba(128, 128, 128, 0.5)"
        strokeWidth={1}
      />
    );
  };

  // Render time labels
  const renderTimeLabels = () => {
    const labels = [];
    const visibleTime = width / timeScale;
    const timeStep = Math.max(1, Math.ceil(visibleTime / 10));

    for (let t = Math.ceil(timeOffset); t <= timeOffset + visibleTime; t += timeStep) {
      const x = (t - timeOffset) * timeScale;
      if (x >= 0 && x <= width) {
        labels.push(
          <SkiaText
            key={`time-${t}`}
            x={x}
            y={height - 5}
            text={`${t.toFixed(1)}s`}
            {...(font ? { font } : { size: 12 })}
            color="#888888"
          />
        );
      }
    }

    return <Group>{labels}</Group>;
  };

  // Render placeholder text
  const renderPlaceholder = () => {
    if (notes.length > 0 || (isRecording && !voiceMode && fftData)) return null;

    const text = isRecording ? 'Listening...' : 'Press "Start Recording" to begin';

    return (
      <SkiaText
        x={width / 2 - 100}
        y={height / 2}
        text={text}
        size={16}
        color="#444444"
      />
    );
  };

  // Native touch handler using PanResponder (no worklet issues, runs on JS thread)
  const panResponder = useRef(
    Platform.OS !== 'web' ? PanResponder.create({
      onStartShouldSetPanResponder: () => !isRecording,
      onMoveShouldSetPanResponder: () => !isRecording,

      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;

        // Check for double-tap
        const now = Date.now();
        const timeSinceLastTouch = now - touchStateRef.current.lastTouchTime;
        const distance = Math.hypot(
          locationX - touchStateRef.current.lastTouchPos.x,
          locationY - touchStateRef.current.lastTouchPos.y
        );

        if (timeSinceLastTouch < 300 && distance < 20) {
          handleDoubleClick(locationX, locationY);
          touchStateRef.current.lastTouchTime = 0;
        } else {
          touchStateRef.current.lastTouchTime = now;
          touchStateRef.current.lastTouchPos = { x: locationX, y: locationY };
          handleTouchStart(locationX, locationY);
        }
      },

      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        handleTouchMove(locationX, locationY);
      },

      onPanResponderRelease: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        handleTouchEnd(locationX, locationY);
      },
    }) : null
  ).current;

  // Add event listeners for web (mouse and wheel)
  useEffect(() => {
    if (Platform.OS !== 'web' || !canvasRef.current) return;

    const container = canvasRef.current;

    const getCanvasCoordinates = (e) => {
      const rect = container.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    const onMouseDown = (e) => {
      const { x, y } = getCanvasCoordinates(e);
      handleTouchStart(x, y);
    };

    const onMouseMove = (e) => {
      const { x, y } = getCanvasCoordinates(e);
      handleMouseMove(x, y);
    };

    const onMouseUp = (e) => {
      const { x, y } = getCanvasCoordinates(e);
      handleTouchEnd(x, y);
    };

    const onClick = (e) => {
      const { x, y } = getCanvasCoordinates(e);
      const now = Date.now();
      const timeSinceLastClick = now - lastClickTimeRef.current;
      const distance = Math.hypot(x - lastClickPosRef.current.x, y - lastClickPosRef.current.y);

      // Detect double-click (within 300ms and 10px)
      if (timeSinceLastClick < 300 && distance < 10) {
        handleDoubleClick(x, y);
        lastClickTimeRef.current = 0; // Reset to prevent triple-click
      } else {
        lastClickTimeRef.current = now;
        lastClickPosRef.current = { x, y };
      }
    };

    const onMouseLeave = () => {
      if (!dragState) {
        onHoverNoteChange?.(null, false);
      }
    };

    const onWheel = (e) => {
      handleWheel(e);
    };

    if (!isRecording) {
      container.addEventListener('mousedown', onMouseDown);
      container.addEventListener('mousemove', onMouseMove);
      container.addEventListener('mouseup', onMouseUp);
      container.addEventListener('click', onClick);
      container.addEventListener('mouseleave', onMouseLeave);
      document.addEventListener('mouseup', onMouseUp); // Global mouse up
    }

    // Always add wheel for zoom/pan
    container.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      container.removeEventListener('mousedown', onMouseDown);
      container.removeEventListener('mousemove', onMouseMove);
      container.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('click', onClick);
      container.removeEventListener('mouseleave', onMouseLeave);
      document.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('wheel', onWheel);
    };
  }, [isRecording, notes, dragState, zoomX, zoomY, panOffsetX, panOffsetY, width, height, timeScale, timeOffset, minMidiAdjusted, midiRangeAdjusted]);

  // Don't render if dimensions are invalid
  if (width <= 0 || height <= 0) {
    // console.log('[NoteVisualizer] Invalid dimensions, skipping render:', width, height);
    return <View style={styles.container} />;
  }

  // Debug logging for iOS
  // console.log('[NoteVisualizer] Render:', {
  //   platform: Platform.OS,
  //   width,
  //   height,
  //   notesCount: notes.length,
  //   isRecording,
  //   font: font ? 'loaded' : 'null',
  //   titleFont: titleFont ? 'loaded' : 'null',
  // });

  const canvasContent = (
    <Canvas
      style={{ width, height }}
      mode="continuous"
    >
        {/* Background */}
        <Rect x={0} y={0} width={width} height={height} color="#0a0a0a" />

        {/* Möbius strip animation (when idle) */}
        {renderMobiusStrip()}

        {/* FFT Visualization */}
        {renderFFT()}

        {/* Grid */}
        {renderGrid()}

        {/* Notes */}
        {renderNotes()}

        {/* Ghost Note */}
        {renderGhostNote()}

        {/* Time Cursor */}
        {renderTimeCursor()}

        {/* Playback Playhead */}
        {renderPlayhead()}

        {/* Time Labels */}
        {renderTimeLabels()}

        {/* Placeholder */}
        {renderPlaceholder()}
      </Canvas>
  );

  return (
    <View
      style={styles.container}
      ref={canvasRef}
      {...(Platform.OS !== 'web' && panResponder ? panResponder.panHandlers : {})}
    >
      {canvasContent}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#0a0a0a',
  },
});

export default NoteVisualizer;
