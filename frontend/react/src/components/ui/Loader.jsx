export function Loader({ label = 'Loading...' }) {
  return <div className="empty-trace" aria-live="polite">{label}</div>;
}
