// MIDI file exporter (SMF Format 0)

const MIDIExporter = {
  // Export notes to MIDI file
  exportToMIDI(notes, filename = 'recording.mid') {
    if (notes.length === 0) {
      throw new Error('No notes to export');
    }

    const midiData = this.createMIDIFile(notes);
    this.downloadFile(midiData, filename);
  },

  createMIDIFile(notes) {
    const ticksPerBeat = 480;
    const tempo = 500000; // 120 BPM in microseconds per quarter note

    // Convert notes to MIDI events
    const events = [];

    notes.forEach(note => {
      const startTick = Math.round(note.startTime * (ticksPerBeat / 0.5)); // Assuming 120 BPM
      const durationTick = Math.round(note.duration * (ticksPerBeat / 0.5));
      const velocity = 80;

      // Note On event
      events.push({
        time: startTick,
        type: 'noteOn',
        note: note.midiNote,
        velocity: velocity,
      });

      // Note Off event
      events.push({
        time: startTick + durationTick,
        type: 'noteOff',
        note: note.midiNote,
        velocity: 0,
      });
    });

    // Sort events by time
    events.sort((a, b) => a.time - b.time);

    // Convert to delta times
    let currentTime = 0;
    const deltaEvents = events.map(event => {
      const deltaTime = event.time - currentTime;
      currentTime = event.time;
      return {
        ...event,
        deltaTime: deltaTime,
      };
    });

    // Build MIDI track
    const track = [];

    // Tempo meta event
    track.push(...this.encodeVariableLength(0)); // Delta time 0
    track.push(0xFF, 0x51, 0x03); // Tempo meta event
    track.push((tempo >> 16) & 0xFF, (tempo >> 8) & 0xFF, tempo & 0xFF);

    // Time signature (4/4)
    track.push(...this.encodeVariableLength(0)); // Delta time 0
    track.push(0xFF, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08);

    // Note events
    deltaEvents.forEach(event => {
      track.push(...this.encodeVariableLength(event.deltaTime));

      if (event.type === 'noteOn') {
        track.push(0x90, event.note, event.velocity); // Channel 1 Note On
      } else {
        track.push(0x80, event.note, event.velocity); // Channel 1 Note Off
      }
    });

    // End of track
    track.push(...this.encodeVariableLength(0)); // Delta time 0
    track.push(0xFF, 0x2F, 0x00);

    // Build MIDI file
    const header = this.createHeader(1, ticksPerBeat);
    const trackChunk = this.createTrackChunk(track);

    return new Uint8Array([...header, ...trackChunk]);
  },

  createHeader(numTracks, ticksPerBeat) {
    return [
      // "MThd" chunk
      0x4D, 0x54, 0x68, 0x64, // MThd
      0x00, 0x00, 0x00, 0x06, // Chunk length (6 bytes)
      0x00, 0x00,             // Format 0
      (numTracks >> 8) & 0xFF, numTracks & 0xFF, // Number of tracks
      (ticksPerBeat >> 8) & 0xFF, ticksPerBeat & 0xFF, // Ticks per beat
    ];
  },

  createTrackChunk(trackData) {
    const length = trackData.length;
    return [
      // "MTrk" chunk
      0x4D, 0x54, 0x72, 0x6B, // MTrk
      (length >> 24) & 0xFF,
      (length >> 16) & 0xFF,
      (length >> 8) & 0xFF,
      length & 0xFF,
      ...trackData,
    ];
  },

  encodeVariableLength(value) {
    const buffer = [];
    buffer.push(value & 0x7F);

    while (value >>= 7) {
      buffer.unshift((value & 0x7F) | 0x80);
    }

    return buffer;
  },

  downloadFile(data, filename) {
    const blob = new Blob([data], { type: 'audio/midi' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  },
};

export default MIDIExporter;
