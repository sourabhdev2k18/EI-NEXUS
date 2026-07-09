import styles from './Panel.module.css';

export function Panel({ title, eyebrow, children, className = '', minHeight }) {
  return (
    <section className={`${styles.panel} ${className}`} style={minHeight ? { minHeight } : undefined}>
      <div className={styles.head}>
        <h3>{title}</h3>
        {eyebrow ? <span className={styles.eyebrow}>{eyebrow}</span> : null}
      </div>
      {children}
    </section>
  );
}
