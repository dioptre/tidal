import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';

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
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    width: '90%',
    maxWidth: 600,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: '#333333',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: '#333333',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  contentScroll: {
    maxHeight: 400,
    padding: 20,
  },
  content: {
    fontSize: 14,
    color: '#ffffff',
    fontFamily: 'monospace',
    lineHeight: 20,
    userSelect: 'text',
    cursor: 'text',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  copyButton: {
    backgroundColor: '#4488ff',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    alignItems: 'center',
  },
  copyButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  tooltip: {
    position: 'absolute',
    bottom: 90,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  tooltipText: {
    backgroundColor: '#44ff44',
    color: '#000000',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    fontSize: 14,
    fontWeight: '600',
  },
});

export default CopyDialog;
