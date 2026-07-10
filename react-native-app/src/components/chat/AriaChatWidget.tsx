import React, { useCallback, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CHAT_SUGGESTIONS } from '../../constants/dashboard';
import { useModal } from '../../hooks/useModal';
import { chatService } from '../../services/chatService';
import { borderRadius, colors, fontFamily } from '../../theme';
import type { ChatMessage } from '../../types/dashboard';

const DEFAULT_GREETING = "Hi, I'm ARIA. Ask me what happened on the fleet, why an asset failed, or how many incidents have been resolved this session.";

// The web version was a fixed <aside> that slid in from the edge of the
// viewport. On mobile that footprint would cover the whole screen anyway,
// so this is rebuilt as a proper bottom-sheet Modal - the standard mobile
// pattern for an on-demand assistant panel (see "Dropdown -> Bottom Sheet"
// in the mobile UX conversion rules).
export function AriaChatWidget() {
  const { isOpen, toggle, close } = useModal(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const historyLoaded = useRef(false);
  const inputRef = useRef<TextInput>(null);
  const insets = useSafeAreaInsets();

  const loadHistoryOnce = useCallback(async () => {
    if (historyLoaded.current) return;
    historyLoaded.current = true;
    try {
      const history = await chatService.getHistory();
      if (!history.length) {
        setMessages([{ role: 'assistant', text: DEFAULT_GREETING, used_llm: false }]);
      } else {
        setMessages(history.map((item) => ({ role: item.role, text: item.text, used_llm: item.used_llm })));
      }
    } catch {
      setMessages([{ role: 'assistant', text: DEFAULT_GREETING, used_llm: false }]);
    }
  }, []);

  const togglePanel = useCallback(() => {
    const opening = !isOpen;
    toggle();
    if (opening) {
      loadHistoryOnce();
      setTimeout(() => inputRef.current?.focus(), 250);
    }
  }, [isOpen, loadHistoryOnce, toggle]);

  const sendMessage = useCallback(
    async (preset?: string) => {
      const text = (preset ?? input).trim();
      if (!text) return;
      setInput('');
      setMessages((current) => [...current, { role: 'user', text }]);
      setTyping(true);
      try {
        const reply = await chatService.sendMessage({ message: text, useLlm: true });
        setMessages((current) => [...current, { role: 'assistant', text: reply.reply, used_llm: reply.used_llm }]);
      } catch {
        setMessages((current) => [...current, { role: 'assistant', text: "I couldn't reach the backend just now - try again in a moment.", used_llm: false }]);
      } finally {
        setTyping(false);
      }
    },
    [input]
  );

  return (
    <>
      <Pressable
        style={[styles.fab, { bottom: insets.bottom + 20 }]}
        onPress={togglePanel}
        accessibilityRole="button"
        accessibilityLabel="Ask ARIA about the fleet"
      >
        <Text style={styles.fabText}>Chat</Text>
        <View style={styles.fabDot} />
      </Pressable>

      <Modal visible={isOpen} animationType="slide" transparent onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.panel, { paddingBottom: insets.bottom + 12 }]}
        >
          <View style={styles.head}>
            <View style={styles.headLeft}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>AI</Text>
              </View>
              <View>
                <Text style={styles.name}>ARIA</Text>
                <Text style={styles.sub}>Autonomous RCA Intelligence Assistant</Text>
              </View>
            </View>
            <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close ARIA chat" style={styles.closeBtn}>
              <Text style={styles.closeText}>x</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.messages} accessibilityLiveRegion="polite">
            {messages.map((message, index) => (
              <View
                style={[styles.message, message.role === 'user' ? styles.messageUser : styles.messageAssistant]}
                key={`${message.role}-${index}`}
              >
                <Text style={styles.messageText}>{message.text}</Text>
                {message.role === 'assistant' ? (
                  <Text style={styles.llmTag}>{message.used_llm ? 'Gemini' : 'offline rule-based'}</Text>
                ) : null}
              </View>
            ))}
            {typing ? <Text style={styles.typing}>ARIA is thinking...</Text> : null}
          </ScrollView>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.suggestions} contentContainerStyle={{ gap: 6 }}>
            {CHAT_SUGGESTIONS.map((suggestion) => (
              <Pressable key={suggestion} style={styles.suggestion} onPress={() => sendMessage(suggestion)}>
                <Text style={styles.suggestionText}>{suggestion}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.inputRow}>
            <TextInput
              ref={inputRef}
              value={input}
              onChangeText={setInput}
              placeholder="Ask ARIA about the fleet..."
              placeholderTextColor={colors.muted}
              style={styles.input}
              onSubmitEditing={() => sendMessage()}
              returnKeyType="send"
            />
            <Pressable style={styles.sendBtn} onPress={() => sendMessage()} accessibilityRole="button" accessibilityLabel="Send message">
              <Text style={styles.sendText}>Send</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.amber,
    borderRadius: borderRadius.pill,
    paddingVertical: 12,
    paddingHorizontal: 18,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  fabText: {
    fontFamily: fontFamily.bodySemiBold,
    fontWeight: '700',
    color: colors.black,
    fontSize: 13,
  },
  fabDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.black,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  panel: {
    maxHeight: '80%',
    backgroundColor: colors.panel,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontWeight: '700',
    color: colors.black,
    fontSize: 12,
  },
  name: {
    fontFamily: fontFamily.display,
    fontSize: 15,
    color: colors.text,
  },
  sub: {
    fontSize: 10.5,
    color: colors.muted,
  },
  closeBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  closeText: {
    color: colors.muted,
    fontSize: 16,
  },
  messages: {
    minHeight: 200,
    maxHeight: 320,
    marginBottom: 10,
  },
  message: {
    maxWidth: '85%',
    borderRadius: borderRadius.md,
    paddingVertical: 8,
    paddingHorizontal: 11,
    marginBottom: 8,
  },
  messageUser: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(255,138,61,0.12)',
  },
  messageAssistant: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  messageText: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  llmTag: {
    marginTop: 4,
    fontFamily: fontFamily.mono,
    fontSize: 9.5,
    color: colors.muted,
  },
  typing: {
    fontFamily: fontFamily.mono,
    fontSize: 11.5,
    color: colors.muted,
    marginBottom: 6,
  },
  suggestions: {
    marginBottom: 10,
  },
  suggestion: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: borderRadius.pill,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  suggestionText: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    color: colors.muted,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: borderRadius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    color: colors.text,
    fontSize: 13,
  },
  sendBtn: {
    backgroundColor: colors.amber,
    borderRadius: borderRadius.md,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: {
    color: colors.black,
    fontWeight: '700',
    fontSize: 13,
  },
});
