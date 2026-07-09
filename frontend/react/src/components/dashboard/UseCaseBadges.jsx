import { USE_CASES } from '../../constants/dashboard.js';
import styles from './UseCaseBadges.module.css';

export function UseCaseBadges() {
  return (
    <div className={styles.row}>
      {USE_CASES.map((item) => (
        <span key={item.label} className={`${styles.badge} ${item.primary ? styles.primary : ''}`}>
          {item.label}
        </span>
      ))}
    </div>
  );
}
