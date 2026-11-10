import type { ReactNode } from 'react';
import { Snowfall } from '../components/Snowfall';
import { MountainRidge } from '../components/MountainRidge';
import styles from './AuthLayout.module.css';

export function AuthLayout({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className={styles.page}>
      <Snowfall />
      <MountainRidge className={styles.ridge} />
      <main className={`${styles.card} ${wide ? styles.wide : ''}`}>{children}</main>
    </div>
  );
}
