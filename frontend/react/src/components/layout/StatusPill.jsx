import styles from './Header.module.css';

export function StatusPill({ type, data = {} }) {
  const isGemini = type === 'gemini';
  const configuredKey = isGemini ? 'gemini_configured' : 'openai_configured';
  const modeLabel = data.mode === 'azure_foundry' ? 'Azure AI Foundry' : 'public OpenAI';

  let label = isGemini ? 'checking Gemini...' : 'checking GPT...';
  let title = '';
  let online = false;

  if (data[configuredKey] === false) {
    label = isGemini ? 'Gemini offline (no key set)' : 'GPT offline (no key set)';
    title = isGemini
      ? 'No GEMINI_API_KEY found in the server environment.'
      : 'No AZURE_FOUNDRY_ENDPOINT or OPENAI_API_KEY found in the server environment.';
  } else if (data.attempted === false) {
    online = true;
    label = isGemini ? 'Gemini key set (not tested yet)' : `GPT set (${modeLabel}, not tested yet)`;
  } else if (data.ok) {
    online = true;
    label = isGemini ? 'Gemini connected' : `GPT connected (${modeLabel})`;
    title = 'Last call succeeded.';
  } else if (data.error) {
    label = isGemini ? 'Gemini call failing - hover for reason' : 'GPT call failing - hover for reason';
    title = `${data.http_status ? `HTTP ${data.http_status}: ` : ''}${data.error}`;
  }

  return (
    <div className={styles.pill} title={title}>
      <span className={`${styles.dot} ${online ? styles.on : styles.off}`} />
      <span>{label}</span>
    </div>
  );
}
