import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import Storage from '../utils/Storage';
import * as Colors from '../styles/colors';

const SettingsPanel = ({ visible, onClose, onLoadSession, initialTab = 'history' }) => {
  const [sessions, setSessions] = useState([]);
  const [storageInfo, setStorageInfo] = useState(null);
  const [activeTab, setActiveTab] = useState('history'); // 'history' or 'help'

  useEffect(() => {
    if (visible) {
      loadSessions();
      setActiveTab(initialTab); // Set to initialTab when opened
    }
  }, [visible, initialTab]);

  const loadSessions = () => {
    const allSessions = Storage.getAllSessions();
    setSessions(allSessions);
    const info = Storage.getStorageInfo();
    setStorageInfo(info);
  };

  const handleLoadSession = (session) => {
    onLoadSession?.(session);
    onClose();
  };

  const handleDeleteSession = (sessionId, e) => {
    e.stopPropagation();
    if (confirm('Delete this session?')) {
      Storage.deleteSession(sessionId);
      loadSessions();
    }
  };

  const handleClearAll = () => {
    if (confirm('Delete all sessions? This cannot be undone.')) {
      Storage.clearAllSessions();
      loadSessions();
    }
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDuration = (notes) => {
    if (!notes || notes.length === 0) return '0s';
    const maxTime = Math.max(...notes.map(n => (n.startTime || 0) + (n.duration || 0)));
    return `${maxTime.toFixed(1)}s`;
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          style={styles.panel}
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.header}>
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'history' && styles.activeTab]}
                onPress={() => setActiveTab('history')}
              >
                <Text style={[styles.tabText, activeTab === 'history' && styles.activeTabText]}>
                  History
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'help' && styles.activeTab]}
                onPress={() => setActiveTab('help')}
              >
                <Text style={[styles.tabText, activeTab === 'help' && styles.activeTabText]}>
                  Help
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {activeTab === 'history' && storageInfo && (
            <View style={styles.storageInfo}>
              <Text style={styles.storageInfoText}>
                {storageInfo.sessionCount} sessions • {storageInfo.sizeMB} MB
              </Text>
              {sessions.length > 0 && (
                <TouchableOpacity onPress={handleClearAll} style={styles.clearAllButton}>
                  <Text style={styles.clearAllText}>Clear All</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <ScrollView style={styles.content}>
            {activeTab === 'history' ? (
              <>
                {sessions.length === 0 ? (
                  <Text style={styles.placeholderText}>
                    No saved sessions yet. Record something to get started!
                  </Text>
                ) : (
                  sessions.map((session) => (
                    <TouchableOpacity
                      key={session.id}
                      style={styles.sessionCard}
                      onPress={() => handleLoadSession(session)}
                    >
                      <View style={styles.sessionHeader}>
                        <Text style={styles.sessionDate}>{formatDate(session.timestamp)}</Text>
                        <TouchableOpacity
                          onPress={(e) => handleDeleteSession(session.id, e)}
                          style={styles.deleteButton}
                        >
                          <Text style={styles.deleteButtonText}>🗑️</Text>
                        </TouchableOpacity>
                      </View>

                      <View style={styles.sessionDetails}>
                        <View style={styles.sessionStat}>
                          <Text style={styles.sessionStatValue}>{session.notes?.length || 0}</Text>
                          <Text style={styles.sessionStatLabel}>notes</Text>
                        </View>
                        <View style={styles.sessionStat}>
                          <Text style={styles.sessionStatValue}>{formatDuration(session.notes)}</Text>
                          <Text style={styles.sessionStatLabel}>duration</Text>
                        </View>
                        <View style={styles.sessionStat}>
                          <Text style={styles.sessionStatValue}>{session.voiceMode ? '🎤' : '🤖'}</Text>
                          <Text style={styles.sessionStatLabel}>mode</Text>
                        </View>
                      </View>

                      {session.noteNames && (
                        <Text style={styles.sessionPreview} numberOfLines={1}>
                          {session.noteNames.split('\n')[0]}
                        </Text>
                      )}
                    </TouchableOpacity>
                  ))
                )}
              </>
            ) : (
              <View style={styles.helpContent}>
                <Text style={styles.helpTitle}>Help & Controls</Text>

                <View style={styles.helpSection}>
                  <Text style={styles.helpSectionTitle}>🎵 Creating Notes</Text>
                  <Text style={styles.helpText}>
                    • <Text style={styles.helpKeyword}>Hold down</Text> on empty space to add a new note{'\n'}
                  </Text>
                </View>

                <View style={styles.helpSection}>
                  <Text style={styles.helpSectionTitle}>✏️ Editing Notes</Text>
                  <Text style={styles.helpText}>
                    • <Text style={styles.helpKeyword}>Click and drag</Text> the center of a note to move it{'\n'}
                    • <Text style={styles.helpKeyword}>Drag the edges</Text> of a note to stretch/shrink its duration{'\n'}
                    • <Text style={styles.helpKeyword}>Double-click</Text> a note to delete it{'\n'}
                    • Drag a note off the canvas to delete it
                  </Text>
                </View>

                <View style={styles.helpSection}>
                  <Text style={styles.helpSectionTitle}>🔍 Navigation</Text>
                  <Text style={styles.helpText}>
                    • <Text style={styles.helpKeyword}>Two-finger pinch</Text> to zoom in/out{'\n'}
                    • <Text style={styles.helpKeyword}>Two-finger drag</Text> to pan around the canvas{'\n'}
                    • <Text style={styles.helpKeyword}>Shift/Ctrl/Cmd + scroll</Text> to zoom (desktop){'\n'}
                    • <Text style={styles.helpKeyword}>Scroll wheel</Text> (no modifiers) to pan (desktop)
                  </Text>
                </View>

                <View style={styles.helpSection}>
                  <Text style={styles.helpSectionTitle}>🎛️ Control Buttons</Text>
                  <Text style={styles.helpText}>
                    • <Text style={styles.helpKeyword}>Upload (📤)</Text> - Import an audio file to analyze{'\n'}
                    • <Text style={styles.helpKeyword}>Clear (🗑️)</Text> - Delete all notes and reset{'\n'}
                    • <Text style={styles.helpKeyword}>Undo (↩)</Text> - Revert the last edit{'\n'}
                    • <Text style={styles.helpKeyword}>Play Notes (▷)</Text> - Preview the detected notes as synth{'\n'}
                    • <Text style={styles.helpKeyword}>Play Audio (▶)</Text> - Play back your original recording{'\n'}
                    • <Text style={styles.helpKeyword}>Download (💾)</Text> - Save your recording as audio{'\n'}
                    • <Text style={styles.helpKeyword}>MIDI (🎹)</Text> - Export notes as a MIDI file{'\n'}
                    • <Text style={styles.helpKeyword}>Note Names (🎼)</Text> - View all detected notes{'\n'}
                    • <Text style={styles.helpKeyword}>Tidal (🎼)</Text> - Generate TidalCycles pattern code{'\n'}
                    • <Text style={styles.helpKeyword}>Strudel (🎼)</Text> - Generate Strudel (JavaScript) code{'\n'}
                    • <Text style={styles.helpKeyword}>Help (?)</Text> - Open this help guide
                  </Text>
                </View>

                <View style={styles.helpSection}>
                  <Text style={styles.helpSectionTitle}>🎤 Recording Modes</Text>
                  <Text style={styles.helpText}>
                    • <Text style={styles.helpKeyword}>Voice</Text> - Optimized for singing (recommended){'\n'}
                    • <Text style={styles.helpKeyword}>Raw</Text> - Shows frequency spectrum visualization
                  </Text>
                </View>

                <View style={styles.helpSection}>
                  <Text style={styles.helpSectionTitle}>💾 Sessions</Text>
                  <Text style={styles.helpText}>
                    • Sessions are auto-saved after recording{'\n'}
                    • Load previous recordings from the History tab{'\n'}
                    • Edit loaded sessions and changes are saved automatically
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  panel: {
    backgroundColor: Colors.BG_SECONDARY,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: Colors.BORDER_PRIMARY,
    borderBottomWidth: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.BORDER_PRIMARY,
  },
  tabContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  activeTab: {
    backgroundColor: Colors.BG_PRIMARY,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.TEXT_SECONDARY,
    fontFamily: Colors.FONT_UI,
  },
  activeTabText: {
    color: Colors.TEXT_PRIMARY,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.TEXT_PRIMARY,
    fontFamily: Colors.FONT_UI,
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: Colors.SLATE_GRAY,
  },
  closeButtonText: {
    fontSize: 18,
    color: Colors.TEXT_PRIMARY,
    fontWeight: 'bold',
  },
  storageInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: Colors.BG_PRIMARY,
    borderBottomWidth: 1,
    borderBottomColor: Colors.BORDER_PRIMARY,
  },
  storageInfoText: {
    fontSize: 13,
    color: Colors.TEXT_SECONDARY,
    fontFamily: Colors.FONT_TECHNICAL,
  },
  clearAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.STUDIO_RED,
    borderRadius: 6,
  },
  clearAllText: {
    fontSize: 12,
    color: Colors.TEXT_PRIMARY,
    fontWeight: '600',
    fontFamily: Colors.FONT_UI,
  },
  content: {
    padding: 20,
    minHeight: 200,
  },
  placeholderText: {
    fontSize: 16,
    color: Colors.TEXT_SECONDARY,
    textAlign: 'center',
    marginTop: 40,
    fontFamily: Colors.FONT_UI,
  },
  sessionCard: {
    backgroundColor: Colors.BG_PRIMARY,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.BORDER_PRIMARY,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sessionDate: {
    fontSize: 14,
    color: Colors.TEXT_PRIMARY,
    fontWeight: '600',
    fontFamily: Colors.FONT_UI,
  },
  deleteButton: {
    padding: 4,
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
    backgroundColor: '#000000',
  },
  deleteButtonText: {
    fontSize: 16,
    opacity: 0.6,
  },
  sessionDetails: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  sessionStat: {
    alignItems: 'center',
  },
  sessionStatValue: {
    fontSize: 18,
    color: Colors.WAVEFORM_BLUE,
    fontWeight: 'bold',
    marginBottom: 2,
    fontFamily: Colors.FONT_TECHNICAL,
  },
  sessionStatLabel: {
    fontSize: 11,
    color: Colors.TEXT_SECONDARY,
    fontFamily: Colors.FONT_UI,
  },
  sessionPreview: {
    fontSize: 12,
    color: Colors.TEXT_SECONDARY,
    fontFamily: Colors.FONT_TECHNICAL,
    marginTop: 8,
  },
  helpContent: {
    paddingBottom: 20,
  },
  helpTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.TEXT_PRIMARY,
    marginBottom: 20,
    fontFamily: Colors.FONT_UI,
  },
  helpSection: {
    marginBottom: 24,
  },
  helpSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.TEXT_PRIMARY,
    marginBottom: 8,
    fontFamily: Colors.FONT_UI,
  },
  helpText: {
    fontSize: 15,
    color: Colors.TEXT_SECONDARY,
    lineHeight: 24,
    fontFamily: Colors.FONT_UI,
  },
  helpKeyword: {
    color: Colors.WAVEFORM_BLUE,
    fontWeight: '600',
  },
});

export default SettingsPanel;
