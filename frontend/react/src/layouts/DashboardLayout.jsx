import { Header } from '../components/layout/Header.jsx';
import styles from './DashboardLayout.module.css';

export function DashboardLayout({ children }) {
  return (
    <>
      <Header />
      <main className={styles.wrap}>{children}</main>
    </>
  );
}
