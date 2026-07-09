import { useCallback, useRef, useState } from 'react';
import { CHAT_SUGGESTIONS } from '../../constants/dashboard.js';
import { useModal } from '../../hooks/useModal.js';
import { chatService } from '../../services/chatService.js';
import styles from './AriaChatWidget.module.css';

const DEFAULT_GREETING = "Hi, I'm ARIA. Ask me what happened on the fleet, why an asset failed, or how many incidents have been resolved this session.";

export function AriaChatWidget() {
  const { isOpen, toggle, close } = useModal(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const historyLoaded = useRef(false);

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
    toggle();
    if (!isOpen) {
      loadHistoryOnce();
      window.setTimeout(() => document.getElementById('aria-input')?.focus(), 0);
    }
  }, [isOpen, loadHistoryOnce, toggle]);

  const sendMessage = useCallback(async (preset) => {
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
  }, [input]);

  return (
    <>
      <button type="button" className={styles.fab} title="Ask ARIA about the fleet" aria-label="Ask ARIA about the fleet" onClick={togglePanel}>
        Chat<span className={styles.fabDot} />
      </button>

      <aside className={`${styles.panel} ${isOpen ? styles.open : ''}`} aria-label="ARIA chat assistant">
        <div className={styles.head}>
          <div className={styles.headLeft}>
            <div className={styles.avatar}>AI</div>
            <div>
              <h4>ARIA</h4>
              <div className={styles.sub}>Autonomous RCA Intelligence Assistant</div>
            </div>
          </div>
          <button type="button" className={styles.close} onClick={close} aria-label="Close ARIA chat">x</button>
        </div>

        <div className={styles.messages} aria-live="polite">
          {messages.map((message, index) => (
            <div className={`${styles.message} ${styles[message.role]}`} key={`${message.role}-${index}`}>
              {message.text.split('\n').map((line) => <span key={line}>{line}<br /></span>)}
              {message.role === 'assistant' ? <span className={styles.llmTag}>{message.used_llm ? 'Gemini' : 'offline rule-based'}</span> : null}
            </div>
          ))}
          {typing ? <div className={styles.typing}>ARIA is thinking...</div> : null}
        </div>

        <div className={styles.suggestions}>
          {CHAT_SUGGESTIONS.map((suggestion) => (
            <button type="button" key={suggestion} className={styles.suggestion} onClick={() => sendMessage(suggestion)}>
              {suggestion}
            </button>
          ))}
        </div>

        <form className={styles.inputRow} onSubmit={(event) => { event.preventDefault(); sendMessage(); }}>
          <input id="aria-input" type="text" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask ARIA about the fleet..." autoComplete="off" />
          <button type="submit">Send</button>
        </form>
      </aside>
    </>
  );
}
