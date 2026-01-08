// TidalCycles pattern generator with speed compensation and repetition detection

const TidalGenerator = {
  // Convert MIDI note to Tidal note notation (without quotes)
  midiToTidalNote(midiNote) {
    const noteNames = ['c', 'cs', 'd', 'ds', 'e', 'f', 'fs', 'g', 'gs', 'a', 'as', 'b'];
    // MIDI octave: MIDI 60 (middle C) = C4, MIDI 0 = C-1
    const octave = Math.floor(midiNote / 12) - 1;
    const noteName = noteNames[midiNote % 12];

    // Use absolute octave notation: e3, cs4, etc.
    // This is clearer than relative notation (e-2, cs-1)
    return `${noteName}${octave}`;
  },

  // Detect repeating patterns in note sequences
  findRepeatingPatterns(notes) {
    if (notes.length < 4) return null;

    // Try different pattern lengths
    for (let patternLen = 2; patternLen <= notes.length / 2; patternLen++) {
      const pattern = notes.slice(0, patternLen);
      let matches = 1;
      let pos = patternLen;

      while (pos + patternLen <= notes.length) {
        const segment = notes.slice(pos, pos + patternLen);
        if (this.notesEqual(pattern, segment)) {
          matches++;
          pos += patternLen;
        } else {
          break;
        }
      }

      // If pattern repeats at least twice
      if (matches >= 2) {
        return {
          pattern,
          length: patternLen,
          repeats: matches,
          remainingNotes: notes.slice(patternLen * matches),
        };
      }
    }

    return null;
  },

  notesEqual(notes1, notes2) {
    if (notes1.length !== notes2.length) return false;
    return notes1.every((note, i) => note.note === notes2[i].note);
  },

  // Quantize durations to musical subdivisions
  quantizeDurations(notes, beatsPerMeasure = 4) {
    if (notes.length === 0) return [];

    // Find average beat duration by looking at note gaps
    const totalTime = notes[notes.length - 1].startTime + notes[notes.length - 1].duration;
    const avgBeatDuration = totalTime / (beatsPerMeasure * Math.ceil(totalTime / 4));

    return notes.map(note => ({
      ...note,
      quantizedDuration: this.snapToSubdivision(note.duration, avgBeatDuration),
      quantizedStart: this.snapToSubdivision(note.startTime, avgBeatDuration),
    }));
  },

  snapToSubdivision(duration, beatDuration) {
    const subdivisions = [1, 1/2, 1/3, 1/4, 1/6, 1/8, 1/12, 1/16];
    const beatCount = duration / beatDuration;

    let closest = subdivisions[0];
    let minDiff = Math.abs(beatCount - closest);

    for (const subdiv of subdivisions) {
      const diff = Math.abs(beatCount - subdiv);
      if (diff < minDiff) {
        minDiff = diff;
        closest = subdiv;
      }
    }

    return closest;
  },

  // Generate human-readable note names from notes
  generateNoteNames(notes) {
    if (notes.length === 0) return '';

    // Convert MIDI notes to note names
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    return notes.map(note => {
      const octave = Math.floor((note.midiNote - 12) / 12);
      const noteName = noteNames[note.midiNote % 12];
      return `${noteName}${octave}`;
    }).join(' ');
  },

  // Generate Strudel (JavaScript) pattern from notes
  generateStrudelPattern(notes) {
    if (notes.length === 0) return '';

    // Generate the pattern with duration notation (reuse Tidal logic)
    const patternCode = this.generatePatternSegmentWithDurations(notes);

    // Count total steps in pattern (notes + rests)
    const totalSteps = this.countPatternSteps(patternCode);

    // Calculate slow factor (same as Tidal)
    const stepsPerCycle = 4;
    const slowFactor = totalSteps / stepsPerCycle;

    // Build Strudel pattern
    let strudelCode = `note("${patternCode}").s("piano")`;

    if (slowFactor > 1.2) {
      strudelCode += `.slow(${slowFactor.toFixed(2)})`;
    } else if (slowFactor < 0.8) {
      const fastFactor = 1 / slowFactor;
      strudelCode += `.fast(${fastFactor.toFixed(2)})`;
    }

    return strudelCode;
  },

  // Generate Tidal pattern from notes
  generatePattern(notes) {
    if (notes.length === 0) return '';

    // Generate the pattern with duration notation
    const patternCode = this.generatePatternSegmentWithDurations(notes);

    // Calculate total duration from first note start to last note end
    const firstNoteStart = Math.min(...notes.map(n => n.startTime));
    const lastNoteEnd = Math.max(...notes.map(n => n.startTime + n.duration));
    const totalDuration = lastNoteEnd - firstNoteStart;

    // Calculate BPM from the recording duration
    // TidalCycles CPS formula: cps (BPM/60/4)
    // We want the pattern to match the original tempo
    // Estimate BPM: assume pattern represents one measure (4 beats)
    const estimatedBeats = 4; // Assume 4/4 time
    const bpm = totalDuration > 0 ? (estimatedBeats / totalDuration) * 60 : 60;

    // Round to nearest integer for cleaner output
    const roundedBPM = Math.round(bpm);

    // Use 'once' with 'n' and 'stretch' to play pattern exactly once at correct tempo
    // stretch ensures the pattern plays at its natural timing without being compressed
    // Format: cps (BPM/60/4) as per TidalCycles docs
    return `once $ n (stretch "${patternCode}") # s "superpiano" # cps (${roundedBPM}/60/4)`;
  },

  // Count total steps in a pattern string
  countPatternSteps(patternCode) {
    // Count notes, rests, and account for [] subdivisions
    let steps = 0;
    let inBrackets = false;
    let bracketCount = 0;

    const tokens = patternCode.split(/\s+/);
    for (const token of tokens) {
      if (token.includes('[')) {
        inBrackets = true;
        bracketCount = 0;
      }

      if (token && token !== '[' && token !== ']') {
        if (inBrackets) {
          bracketCount++;
        } else {
          // Check for duration elongation like c@2 (holds for 2 steps)
          if (token.includes('@')) {
            const [, mult] = token.split('@');
            steps += parseFloat(mult) || 1;
          } else {
            steps += 1;
          }
        }
      }

      if (token.includes(']')) {
        // Subdivisions count as 1 step total
        steps += 1;
        inBrackets = false;
      }
    }

    return Math.max(steps, 1);
  },

  // Detect overlapping notes (polyphony)
  groupOverlappingNotes(notes) {
    if (notes.length === 0) return [];

    // Sort notes by start time
    const sorted = [...notes].sort((a, b) => a.startTime - b.startTime);

    const groups = [];
    let currentGroup = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const currentNote = sorted[i];
      const prevNote = currentGroup[currentGroup.length - 1];

      // Check if notes overlap (current note starts before previous note ends)
      // Use a small tolerance (50ms) to catch near-simultaneous notes
      const tolerance = 0.05;
      if (currentNote.startTime < prevNote.startTime + prevNote.duration - tolerance) {
        // Notes overlap - add to current group
        currentGroup.push(currentNote);
      } else {
        // No overlap - start new group
        groups.push(currentGroup);
        currentGroup = [currentNote];
      }
    }

    // Add the last group
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    return groups;
  },

  // Merge consecutive identical notes with @ notation
  mergeConsecutiveNotes(patternArray) {
    const result = [];
    let i = 0;

    while (i < patternArray.length) {
      const current = patternArray[i];

      // Skip rests and chords (anything with special characters)
      if (current === '~' || current.includes('[') || current.includes(',')) {
        result.push(current);
        i++;
        continue;
      }

      // Extract note name and duration multiplier
      const match = current.match(/^([a-z]+\d+)(?:@(\d+))?$/);
      if (!match) {
        result.push(current);
        i++;
        continue;
      }

      const [, noteName, durationStr] = match;
      let totalDuration = parseInt(durationStr || '1', 10);
      let j = i + 1;

      // Look ahead for consecutive identical notes
      while (j < patternArray.length) {
        const next = patternArray[j];
        const nextMatch = next.match(/^([a-z]+\d+)(?:@(\d+))?$/);

        if (nextMatch && nextMatch[1] === noteName) {
          const nextDuration = parseInt(nextMatch[2] || '1', 10);
          totalDuration += nextDuration;
          j++;
        } else {
          break;
        }
      }

      // Output merged note
      if (totalDuration > 1) {
        result.push(`${noteName}@${totalDuration}`);
      } else {
        result.push(noteName);
      }

      i = j;
    }

    return result;
  },

  // Generate pattern with proper duration notation
  generatePatternSegmentWithDurations(notes) {
    if (notes.length === 0) return '';

    // Group overlapping notes for polyphony
    const noteGroups = this.groupOverlappingNotes(notes);

    // Calculate average note duration to use as a reference (quarter note)
    const avgDuration = notes.reduce((sum, n) => sum + n.duration, 0) / notes.length;

    const result = [];
    let fastNoteBuffer = []; // Buffer for consecutive fast notes

    for (let i = 0; i < noteGroups.length; i++) {
      const group = noteGroups[i];

      // Handle polyphonic group (multiple simultaneous notes)
      if (group.length > 1) {
        // Flush any buffered fast notes first
        if (fastNoteBuffer.length > 0) {
          result.push(`[${fastNoteBuffer.join(' ')}]`);
          fastNoteBuffer = [];
        }

        // Create polyphonic chord with comma notation
        const chordNotes = group.map(n => this.midiToTidalNote(n.midiNote));
        // Use the duration of the longest note in the group
        const maxDuration = Math.max(...group.map(n => n.duration));
        const relativeDuration = maxDuration / avgDuration;

        if (relativeDuration >= 1.5) {
          const multiplier = Math.round(relativeDuration);
          result.push(`[${chordNotes.join(',')}]@${multiplier}`);
        } else {
          result.push(`[${chordNotes.join(',')}]`);
        }

        // Check for gaps after this group
        if (i < noteGroups.length - 1) {
          const nextGroup = noteGroups[i + 1];
          const gap = nextGroup[0].startTime - (group[0].startTime + maxDuration);

          if (gap > avgDuration * 0.75) {
            const restCount = Math.round(gap / avgDuration);
            for (let r = 0; r < restCount && r < 3; r++) {
              result.push('~');
            }
          }
        }

        continue;
      }

      // Single note - process normally
      const note = group[0];
      const tidalNote = this.midiToTidalNote(note.midiNote);
      const relativeDuration = note.duration / avgDuration;

      // Check for gaps (rests) before this note
      if (i > 0) {
        const prevGroup = noteGroups[i - 1];
        const prevNote = prevGroup[0];
        const prevMaxDuration = Math.max(...prevGroup.map(n => n.duration));
        const gap = note.startTime - (prevNote.startTime + prevMaxDuration);

        // Only add rests for significant gaps (> 75% of avg note duration)
        // This prevents adding rests for small breath gaps between sung notes
        if (gap > avgDuration * 0.75) {
          // Flush any buffered fast notes first
          if (fastNoteBuffer.length > 0) {
            result.push(`[${fastNoteBuffer.join(' ')}]`);
            fastNoteBuffer = [];
          }

          // Add rest(s) but limit to reasonable amount
          const restCount = Math.round(gap / avgDuration);
          for (let r = 0; r < restCount && r < 3; r++) {
            result.push('~');
          }
        }
      }

      // Determine how to represent this note based on duration
      if (relativeDuration >= 1.5) {
        // Long note: use @ notation for elongation (e.g., c@2 holds for 2 steps, c@3 equivalent to c _ _)
        if (fastNoteBuffer.length > 0) {
          result.push(`[${fastNoteBuffer.join(' ')}]`);
          fastNoteBuffer = [];
        }
        const multiplier = Math.round(relativeDuration);
        result.push(`${tidalNote}@${multiplier}`);
      } else if (relativeDuration < 0.7) {
        // Fast note: buffer it for subdivision brackets
        fastNoteBuffer.push(tidalNote);

        // If this is the last note or next note is not fast, flush the buffer
        if (i === notes.length - 1) {
          if (fastNoteBuffer.length > 1) {
            result.push(`[${fastNoteBuffer.join(' ')}]`);
          } else {
            result.push(fastNoteBuffer[0]);
          }
          fastNoteBuffer = [];
        } else {
          const nextDuration = notes[i + 1].duration / avgDuration;
          if (nextDuration >= 0.7) {
            // Next note is not fast, flush buffer
            if (fastNoteBuffer.length > 1) {
              result.push(`[${fastNoteBuffer.join(' ')}]`);
            } else {
              result.push(fastNoteBuffer[0]);
            }
            fastNoteBuffer = [];
          }
        }
      } else {
        // Regular quarter note
        if (fastNoteBuffer.length > 0) {
          result.push(`[${fastNoteBuffer.join(' ')}]`);
          fastNoteBuffer = [];
        }
        result.push(tidalNote);
      }
    }

    // Flush any remaining fast notes
    if (fastNoteBuffer.length > 0) {
      if (fastNoteBuffer.length > 1) {
        result.push(`[${fastNoteBuffer.join(' ')}]`);
      } else {
        result.push(fastNoteBuffer[0]);
      }
    }

    // Merge consecutive identical notes (e.g., cs2@2 cs2@2 -> cs2@4)
    const merged = this.mergeConsecutiveNotes(result);

    return merged.join(' ');
  },

  generatePatternSegment(notes, originalNotes) {
    if (notes.length === 0) return '';

    const result = [];

    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];
      const tidalNote = this.midiToTidalNote(note.midiNote);

      // Add the note
      result.push(tidalNote);

      // Check for gaps (rests) before the next note
      if (i < notes.length - 1) {
        const nextNote = notes[i + 1];
        const gap = nextNote.startTime - (note.startTime + note.duration);

        // If there's a significant gap (> 0.2 seconds), add a rest
        if (gap > 0.2) {
          const restCount = Math.round(gap / note.duration);
          for (let r = 0; r < restCount && r < 4; r++) {
            result.push('~');
          }
        }
      }
    }

    return result.join(' ');
  },

  // Generate pattern with speed compensation
  generateWithSpeed(notes, targetNotesPerCycle = 4) {
    if (notes.length === 0) return '';

    const pattern = this.generatePatternSegment(notes);
    const speed = notes.length / targetNotesPerCycle;

    if (speed > 1.5) {
      return `d1 $ note "${pattern}" # s "superpiano" # speed ${speed.toFixed(2)}`;
    } else {
      return `d1 $ note "${pattern}" # s "superpiano"`;
    }
  },
};

export default TidalGenerator;
