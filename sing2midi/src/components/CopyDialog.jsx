import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import * as Colors from '../styles/colors';

const CopyDialog = ({ visible, onClose, title, content }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const handleCopy = () => {
    // Copy to clipboard using the Clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(content)
        .then(() => {
          setShowTooltip(true);
          setTimeout(() => setShowTooltip(false), 2000);
        })
        .catch((err) => {
          console.error('Failed to copy text:', err);
          alert('Failed to copy to clipboard');
        });
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = content;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        setShowTooltip(true);
        setTimeout(() => setShowTooltip(false), 2000);
      } catch (err) {
        console.error('Failed to copy text:', err);
        alert('Failed to copy to clipboard');
      }
      document.body.removeChild(textArea);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          style={styles.dialog}
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.contentScroll}>
            <Text style={styles.content}>{content}</Text>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.copyButton}
              onPress={handleCopy}
            >
              <Text style={styles.copyButtonText}>
                {showTooltip ? '✓ Copied!' : 'Copy to Clipboard'}
              </Text>
            </TouchableOpacity>
          </View>

          {showTooltip && (
            <View style={styles.tooltip}>
              <Text style={styles.tooltipText}>Text copied to clipboard!</Text>
            </View>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialog: {
    backgroundColor: Colors.BG_SECONDARY,
    borderRadius: 12,
    width: '90%',
    maxWidth: 600,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: Colors.BORDER_PRIMARY,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.BORDER_PRIMARY,
  },
  title: {
    fontSize: 20,
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
  contentScroll: {
    maxHeight: 400,
    padding: 20,
  },
  content: {
    fontSize: 14,
    color: Colors.TEXT_PRIMARY,
    fontFamily: Colors.FONT_TECHNICAL,
    lineHeight: 20,
    userSelect: 'text',
    cursor: 'text',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.BORDER_PRIMARY,
  },
  copyButton: {
    backgroundColor: Colors.BTN_SECONDARY,
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    alignItems: 'center',
  },
  copyButtonText: {
    color: Colors.TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: Colors.FONT_UI,
  },
  tooltip: {
    position: 'absolute',
    bottom: 90,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  tooltipText: {
    backgroundColor: Colors.SIGNAL_GREEN,
    color: Colors.STUDIO_BLACK,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: Colors.FONT_UI,
  },
});

export default CopyDialog;
