import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './AppShell.module.css';

/** Signed-in layout: page content + bottom tab bar (Mountains · Map · Profile). */
export function AppShell() {
  const { profile } = useAuth();
  const { pathname } = useLocation();
  const lastMountain = profile?.recentMountainIds[0] ?? profile?.homeMountainId ?? null;
  const mapHref = lastMountain ? `/m/${lastMountain}/map` : '/';

  const tabs = [
    { label: 'Mountains', icon: '⛰', to: '/', active: pathname === '/' || (/^\/m\/[^/]+$/.test(pathname)) },
    { label: 'Map', icon: '🗺', to: mapHref, active: /^\/m\/[^/]+\/map$/.test(pathname) },
    { label: 'Profile', icon: '👤', to: '/profile', active: pathname === '/profile' },
  ];

  return (
    <div className={styles.shell}>
      <div className={styles.content}><Outlet /></div>
      <nav aria-label="Main" className={styles.tabs}>
        {tabs.map((t) => (
          <Link key={t.label} to={t.to} className={`${styles.tab} ${t.active ? styles.active : ''}`}
            aria-current={t.active ? 'page' : undefined}>
            <span aria-hidden="true" className={styles.icon}>{t.icon}</span>
            {t.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
