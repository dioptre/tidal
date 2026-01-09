import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, Linking, TextInput } from 'react-native';
import Storage from '../utils/Storage';
import Settings from '../utils/Settings';
import DeviceCapabilities from '../utils/DeviceCapabilities';
import Logger from '../utils/Logger';
import * as Colors from '../styles/colors';
import { Trash2Icon, MicIcon, WaveformIcon } from './Icons';

const SettingsPanel = ({ visible, onClose, onLoadSession, onMethodChange, initialTab = 'history' }) => {
  const [sessions, setSessions] = useState([]);
  const [storageInfo, setStorageInfo] = useState(null);
  const [activeTab, setActiveTab] = useState('history'); // 'history', 'settings', 'help', 'credits', or 'developer'
  const [settings, setSettings] = useState(null);
  const [deviceCapabilities, setDeviceCapabilities] = useState(null);
  const [devModeEnabled, setDevModeEnabled] = useState(false); // Developer mode state
  const [logs, setLogs] = useState([]); // Captured logs
  const logScrollRef = useRef(null); // Reference to log scroll view

  useEffect(() => {
    if (visible) {
      loadSessions();
      loadSettings();
      setActiveTab(initialTab); // Set to initialTab when opened
    }
  }, [visible, initialTab]);

  // Load logs when switching to developer tab
  useEffect(() => {
    if (activeTab === 'developer') {
      setLogs(Logger.getLogs());
    }
  }, [activeTab]);

  const loadSessions = async () => {
    const allSessions = await Storage.getAllSessions();
    setSessions(allSessions);
    const info = await Storage.getStorageInfo();
    setStorageInfo(info);
  };

  const loadSettings = async () => {
    const currentSettings = await Settings.loadSettings();
    setSettings(currentSettings);
    if (currentSettings.deviceCapabilities) {
      setDeviceCapabilities(currentSettings.deviceCapabilities);
    }
  };

  const handleMethodChange = async (method) => {
    await Settings.setPitchDetectionMethod(method);
    await loadSettings();
    // Notify parent component (App.jsx) that method changed
    onMethodChange?.(method);
  };

  const handleRedetectCapabilities = async () => {
    const capabilities = await Settings.redetectCapabilities();
    setDeviceCapabilities(capabilities);
    await loadSettings();
  };

  const handleLoadSession = (session) => {
    onLoadSession?.(session);
    onClose();
  };

  const handleDeleteSession = async (sessionId, e) => {
    e.stopPropagation();
    if (confirm('Delete this session?')) {
      await Storage.deleteSession(sessionId);
      loadSessions();
    }
  };

  const handleClearAll = async () => {
    if (confirm('Delete all sessions? This cannot be undone.')) {
      await Storage.clearAllSessions();
      loadSessions();
    }
  };

  const handleEnableDevMode = () => {
    setDevModeEnabled(true);
    Logger.log('[DevMode] Developer mode enabled');
  };

  const handleClearLogs = () => {
    Logger.clearLogs();
    setLogs([]);
    Logger.log('[DevMode] Logs cleared');
  };

  const handleRefreshLogs = () => {
    setLogs(Logger.getLogs());
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
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.tabScrollContainer}
              contentContainerStyle={styles.tabContainer}
            >
              <TouchableOpacity
                style={[styles.tab, activeTab === 'history' && styles.activeTab]}
                onPress={() => setActiveTab('history')}
              >
                <Text style={[styles.tabText, activeTab === 'history' && styles.activeTabText]}>
                  History
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'settings' && styles.activeTab]}
                onPress={() => setActiveTab('settings')}
              >
                <Text style={[styles.tabText, activeTab === 'settings' && styles.activeTabText]}>
                  Settings
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
              <TouchableOpacity
                style={[styles.tab, activeTab === 'credits' && styles.activeTab]}
                onPress={() => setActiveTab('credits')}
              >
                <Text style={[styles.tabText, activeTab === 'credits' && styles.activeTabText]}>
                  Credits
                </Text>
              </TouchableOpacity>
              {devModeEnabled && (
                <TouchableOpacity
                  style={[styles.tab, activeTab === 'developer' && styles.activeTab]}
                  onPress={() => setActiveTab('developer')}
                >
                  <Text style={[styles.tabText, activeTab === 'developer' && styles.activeTabText]}>
                    Developer
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>
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
                          <Trash2Icon size={14} color={Colors.TEXT_SECONDARY} />
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
                          <View style={styles.sessionStatValue}>
                            {session.voiceMode ? (
                              <MicIcon size={18} color={Colors.WAVEFORM_BLUE} />
                            ) : (
                              <WaveformIcon size={18} color={Colors.WAVEFORM_BLUE} />
                            )}
                          </View>
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
            ) : activeTab === 'settings' ? (
              <View style={styles.settingsContent}>
                <Text style={styles.settingsTitle}>Pitch Detection Settings</Text>

                {deviceCapabilities && (
                  <View style={styles.deviceInfoCard}>
                    <Text style={styles.deviceInfoTitle}>Device Info</Text>
                    <View style={styles.deviceInfoRow}>
                      <Text style={styles.deviceInfoLabel}>Platform:</Text>
                      <Text style={styles.deviceInfoValue}>{deviceCapabilities.platform}</Text>
                    </View>
                    <View style={styles.deviceInfoRow}>
                      <Text style={styles.deviceInfoLabel}>GPU:</Text>
                      <Text style={[styles.deviceInfoValue, deviceCapabilities.hasGPU && styles.deviceInfoGood]}>
                        {deviceCapabilities.hasGPU ? `Yes (${deviceCapabilities.gpuDetails})` : `No (${deviceCapabilities.backend})`}
                      </Text>
                    </View>
                    <View style={styles.deviceInfoRow}>
                      <Text style={styles.deviceInfoLabel}>Recommended:</Text>
                      <Text style={styles.deviceInfoValue}>{deviceCapabilities.recommendedMethod.toUpperCase()}</Text>
                    </View>
                    {deviceCapabilities.reason && (
                      <Text style={styles.deviceInfoReason}>{deviceCapabilities.reason}</Text>
                    )}
                  </View>
                )}

                <View style={styles.methodSection}>
                  <Text style={styles.methodSectionTitle}>Detection Method</Text>
                  <Text style={styles.methodSectionSubtitle}>
                    Current: {settings?.pitchDetectionMethod?.toUpperCase() || 'HYBRID'}
                  </Text>

                  {[
                    { id: 'yin', name: 'YIN', desc: 'Fast autocorrelation (no GPU needed)' },
                    { id: 'fft', name: 'FFT+HPS', desc: 'Harmonic Product Spectrum (finds fundamental)' },
                    { id: 'pca', name: 'Spectral PCA', desc: 'Temporal averaging + HPS (stable for vibrato)' },
                    { id: 'cepstral', name: 'Cepstral', desc: 'Separates pitch from formants (robust)' },
                    { id: 'cepstral_knn', name: 'Cepstral+KNN', desc: 'Posterior probabilities with past/future context (best accuracy)' },
                    { id: 'onnx', name: 'ONNX', desc: 'AI model only (requires GPU)' },
                    { id: 'hybrid', name: 'Hybrid', desc: 'YIN + AI (best quality, needs GPU)' }
                  ].map((method) => {
                    const isSelected = settings?.pitchDetectionMethod === method.id;
                    const methodInfo = DeviceCapabilities.getMethodDescription(method.id);
                    const validation = deviceCapabilities
                      ? DeviceCapabilities.validateMethod(method.id, deviceCapabilities)
                      : { valid: true };

                    return (
                      <TouchableOpacity
                        key={method.id}
                        style={[
                          styles.methodCard,
                          isSelected && styles.methodCardActive,
                          !validation.valid && styles.methodCardWarning
                        ]}
                        onPress={() => handleMethodChange(method.id)}
                      >
                        <View style={styles.methodHeader}>
                          <View style={styles.methodRadio}>
                            {isSelected && <View style={styles.methodRadioInner} />}
                          </View>
                          <View style={styles.methodInfo}>
                            <Text style={[styles.methodName, isSelected && styles.methodNameActive]}>
                              {method.name}
                            </Text>
                            <Text style={styles.methodDesc}>{method.desc}</Text>
                            <View style={styles.methodBadges}>
                              <View style={[styles.badge, styles.badgeSpeed]}>
                                <Text style={styles.badgeText}>{methodInfo.speed}</Text>
                              </View>
                              {methodInfo.gpuRequired && (
                                <View style={[styles.badge, styles.badgeGPU]}>
                                  <Text style={styles.badgeText}>GPU</Text>
                                </View>
                              )}
                            </View>
                            {!validation.valid && (
                              <Text style={styles.methodWarning}>⚠️ {validation.warning}</Text>
                            )}
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TouchableOpacity
                  style={styles.redetectButton}
                  onPress={handleRedetectCapabilities}
                >
                  <Text style={styles.redetectButtonText}>Re-detect Device Capabilities</Text>
                </TouchableOpacity>
              </View>
            ) : activeTab === 'help' ? (
              <View style={styles.helpContent}>
                <Text style={styles.helpTitle}>Help & Controls</Text>

                {/* iOS/Android mute switch warning */}
                <View style={styles.muteSwitchWarning}>
                  <Text style={styles.muteSwitchWarningTitle}>⚠️ Important</Text>
                  <Text style={styles.muteSwitchWarningText}>
                    On iOS and Android, make sure your device's mute switch (on the left side) is OFF to hear note previews.
                    {'\n'}
                    {'\n'}
                    The orange indicator means sound is muted.
                  </Text>
                </View>

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
                    • <Text style={styles.helpKeyword}>Click then Delete key</Text> - Click a note, then press Delete/Backspace to remove it{'\n'}
                  </Text>
                </View>

                <View style={styles.helpSection}>
                  <Text style={styles.helpSectionTitle}>⌨️ Keyboard Shortcuts</Text>
                  <Text style={styles.helpText}>
                    • <Text style={styles.helpKeyword}>Spacebar</Text> - Start/stop playback{'\n'}
                    • <Text style={styles.helpKeyword}>Arrow Up/Down</Text> - Move selected note up/down 1 semitone{'\n'}
                    • <Text style={styles.helpKeyword}>Arrow Left/Right</Text> - Move selected note left/right 0.25 seconds{'\n'}
                    • <Text style={styles.helpKeyword}>Delete/Backspace</Text> - Remove selected note{'\n'}
                    • <Text style={styles.helpKeyword}>Octave Shift Buttons (⬆️⬇️)</Text> - Shift all notes up/down one octave
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
                    • <Text style={styles.helpKeyword}>Octave Up/Down (⬆️⬇️)</Text> - Shift all notes up or down by one octave{'\n'}
                    • <Text style={styles.helpKeyword}>Play Notes (▷)</Text> - Preview the detected notes as synth (loops continuously){'\n'}
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
            ) : activeTab === 'credits' ? (
              <View style={styles.creditsContent}>
                <Text style={styles.creditsTitle}>Credits</Text>

                <View style={styles.creditsSection}>
                  <Text style={styles.creditsText}>
                    Created{' '}
                    <Text style={styles.creditsText} onPress={handleEnableDevMode}>
                      by
                    </Text>
                    {' '}
                    <Text
                      style={styles.creditsLinkText}
                      onPress={() => Linking.openURL('https://x.com/andrewgrosser')}
                    >
                      Andrew Grosser
                    </Text>
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.developerContent}>
                <Text style={styles.developerTitle}>Developer Console</Text>

                <View style={styles.developerHeader}>
                  <Text style={styles.developerInfo}>
                    {logs.length} logs captured (max 1000)
                  </Text>
                  <View style={styles.developerButtons}>
                    <TouchableOpacity
                      style={styles.refreshLogsButton}
                      onPress={handleRefreshLogs}
                    >
                      <Text style={styles.refreshLogsButtonText}>Refresh</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.clearLogsButton}
                      onPress={handleClearLogs}
                    >
                      <Text style={styles.clearLogsButtonText}>Clear</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <ScrollView
                  style={styles.logContainer}
                  ref={logScrollRef}
                  onContentSizeChange={() => {
                    logScrollRef.current?.scrollToEnd({ animated: true });
                  }}
                >
                  {logs.length === 0 ? (
                    <Text style={styles.logEmpty}>No logs captured yet...</Text>
                  ) : (
                    logs.map((log) => (
                      <View key={log.id} style={styles.logEntry}>
                        <Text
                          style={[
                            styles.logText,
                            log.level === 'error' && styles.logError,
                            log.level === 'warn' && styles.logWarn,
                            log.level === 'info' && styles.logInfo,
                          ]}
                          selectable={true}
                        >
                          <Text style={styles.logTimestamp}>[{log.timestamp}]</Text>{' '}
                          <Text style={styles.logLevel}>{log.level.toUpperCase()}</Text>{' '}
                          {log.message}
                        </Text>
                      </View>
                    ))
                  )}
                </ScrollView>
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
  tabScrollContainer: {
    flex: 1,
    marginRight: 10,
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
    padding: 6,
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
    backgroundColor: 'transparent',
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
  muteSwitchWarning: {
    backgroundColor: 'rgba(255, 152, 0, 0.15)',
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
  },
  muteSwitchWarningTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF9800',
    marginBottom: 8,
    fontFamily: Colors.FONT_UI,
  },
  muteSwitchWarningText: {
    fontSize: 14,
    color: Colors.TEXT_PRIMARY,
    lineHeight: 20,
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
  // Settings tab styles
  settingsContent: {
    paddingBottom: 20,
  },
  settingsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.TEXT_PRIMARY,
    marginBottom: 20,
    fontFamily: Colors.FONT_UI,
  },
  deviceInfoCard: {
    backgroundColor: Colors.BG_PRIMARY,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.BORDER_PRIMARY,
  },
  deviceInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.TEXT_PRIMARY,
    marginBottom: 12,
    fontFamily: Colors.FONT_UI,
  },
  deviceInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  deviceInfoLabel: {
    fontSize: 14,
    color: Colors.TEXT_SECONDARY,
    fontFamily: Colors.FONT_UI,
  },
  deviceInfoValue: {
    fontSize: 14,
    color: Colors.TEXT_PRIMARY,
    fontWeight: '600',
    fontFamily: Colors.FONT_TECHNICAL,
  },
  deviceInfoGood: {
    color: '#4CAF50',
  },
  deviceInfoReason: {
    fontSize: 12,
    color: Colors.TEXT_SECONDARY,
    marginTop: 8,
    fontStyle: 'italic',
    fontFamily: Colors.FONT_UI,
  },
  methodSection: {
    marginBottom: 20,
  },
  methodSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.TEXT_PRIMARY,
    marginBottom: 8,
    fontFamily: Colors.FONT_UI,
  },
  methodSectionSubtitle: {
    fontSize: 14,
    color: Colors.TEXT_SECONDARY,
    marginBottom: 16,
    fontFamily: Colors.FONT_TECHNICAL,
  },
  methodCard: {
    backgroundColor: Colors.BG_PRIMARY,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: Colors.BORDER_PRIMARY,
  },
  methodCardActive: {
    borderColor: Colors.WAVEFORM_BLUE,
    backgroundColor: 'rgba(68, 136, 255, 0.05)',
  },
  methodCardWarning: {
    borderColor: '#FFA500',
  },
  methodHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  methodRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.TEXT_SECONDARY,
    marginRight: 12,
    marginTop: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  methodRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.WAVEFORM_BLUE,
  },
  methodInfo: {
    flex: 1,
  },
  methodName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.TEXT_PRIMARY,
    marginBottom: 4,
    fontFamily: Colors.FONT_UI,
  },
  methodNameActive: {
    color: Colors.WAVEFORM_BLUE,
  },
  methodDesc: {
    fontSize: 13,
    color: Colors.TEXT_SECONDARY,
    marginBottom: 8,
    fontFamily: Colors.FONT_UI,
  },
  methodBadges: {
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeSpeed: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
  },
  badgeGPU: {
    backgroundColor: 'rgba(68, 136, 255, 0.2)',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.TEXT_PRIMARY,
    fontFamily: Colors.FONT_TECHNICAL,
    textTransform: 'uppercase',
  },
  methodWarning: {
    fontSize: 12,
    color: '#FFA500',
    marginTop: 8,
    fontFamily: Colors.FONT_UI,
  },
  redetectButton: {
    backgroundColor: Colors.BG_PRIMARY,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.BORDER_PRIMARY,
    alignItems: 'center',
  },
  redetectButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.WAVEFORM_BLUE,
    fontFamily: Colors.FONT_UI,
  },
  // Credits tab styles
  creditsContent: {
    paddingBottom: 20,
  },
  creditsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.TEXT_PRIMARY,
    marginBottom: 20,
    fontFamily: Colors.FONT_UI,
  },
  creditsSection: {
    marginBottom: 24,
  },
  creditsText: {
    fontSize: 16,
    color: Colors.TEXT_PRIMARY,
    marginBottom: 12,
    fontFamily: Colors.FONT_UI,
  },
  creditsLinkText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.WAVEFORM_BLUE,
    fontFamily: Colors.FONT_UI,
    textDecorationLine: 'underline',
  },
  // Developer tab styles
  developerContent: {
    paddingBottom: 20,
    flex: 1,
  },
  developerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.TEXT_PRIMARY,
    marginBottom: 16,
    fontFamily: Colors.FONT_UI,
  },
  developerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  developerInfo: {
    fontSize: 13,
    color: Colors.TEXT_SECONDARY,
    fontFamily: Colors.FONT_TECHNICAL,
  },
  developerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  refreshLogsButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.WAVEFORM_BLUE,
    borderRadius: 6,
  },
  refreshLogsButtonText: {
    fontSize: 12,
    color: Colors.TEXT_PRIMARY,
    fontWeight: '600',
    fontFamily: Colors.FONT_UI,
  },
  clearLogsButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.STUDIO_RED,
    borderRadius: 6,
  },
  clearLogsButtonText: {
    fontSize: 12,
    color: Colors.TEXT_PRIMARY,
    fontWeight: '600',
    fontFamily: Colors.FONT_UI,
  },
  logContainer: {
    backgroundColor: Colors.BG_PRIMARY,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.BORDER_PRIMARY,
    padding: 12,
    maxHeight: 400,
  },
  logEmpty: {
    fontSize: 14,
    color: Colors.TEXT_SECONDARY,
    textAlign: 'center',
    padding: 20,
    fontFamily: Colors.FONT_UI,
  },
  logEntry: {
    marginBottom: 4,
  },
  logText: {
    fontSize: 12,
    color: Colors.TEXT_PRIMARY,
    fontFamily: Colors.FONT_TECHNICAL,
    lineHeight: 18,
  },
  logTimestamp: {
    color: Colors.TEXT_SECONDARY,
    fontSize: 11,
  },
  logLevel: {
    fontWeight: '600',
  },
  logError: {
    color: '#ff4444',
  },
  logWarn: {
    color: '#ffaa00',
  },
  logInfo: {
    color: '#4488ff',
  },
});

export default SettingsPanel;
