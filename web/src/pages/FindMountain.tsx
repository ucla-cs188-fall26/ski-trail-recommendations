import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TextField } from '../components/TextField';
import { useAuth } from '../context/AuthContext';
import { getMountain, searchMountains, type Mountain } from '../data/mountains';
import styles from '../layouts/Page.module.css';

const MAX_RECENT = 5;

function MountainButton({ m, onOpen }: { m: Mountain; onOpen: (m: Mountain) => void }) {
  return (
    <button type="button" className={styles.mountain} disabled={!m.hasTrailData} onClick={() => onOpen(m)}>
      <span>
        <span className={styles.mName}>{m.name}</span>
        <span className={styles.mRegion}>{m.region}</span>
      </span>
      <span className={`${styles.badge} ${m.hasTrailData ? styles.badgeLive : ''}`}>
        {m.hasTrailData ? 'Trail map ready' : 'Coming soon'}
      </span>
    </button>
  );
}

export function FindMountain() {
  const { profile, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchMountains(query), [query]);

  const mine = useMemo(() => {
    const ids = [profile?.homeMountainId, ...(profile?.recentMountainIds ?? [])].filter((x): x is string => !!x);
    return Array.from(new Set(ids)).map(getMountain).filter((m): m is Mountain => !!m);
  }, [profile]);

  const openMountain = async (m: Mountain) => {
    const recent = [m.id, ...(profile?.recentMountainIds ?? []).filter((id) => id !== m.id)].slice(0, MAX_RECENT);
    await updateProfile({ recentMountainIds: recent });
    navigate(`/m/${m.id}`);
  };

  return (
    <>
      <header className={styles.hero}>
        <p className={styles.heroSub}>Hi, {profile?.displayName}</p>
        <h1>Find my mountain</h1>
        <p className={styles.heroSub}>Pick where you're skiing today.</p>
      </header>
      <div className={styles.body}>
        <div className={styles.panel}>
          <TextField label="Search mountains" type="search" value={query} onChange={setQuery} placeholder="Resort name or state" />
          {mine.length > 0 && !query.trim() && (
            <section aria-label="Your mountains">
              <h2>Your mountains</h2>
              <div className={styles.list}>
                {mine.map((m) => <MountainButton key={m.id} m={m} onOpen={openMountain} />)}
              </div>
            </section>
          )}
          <section aria-label="All mountains" style={{ marginTop: 16 }}>
            <h2>{query.trim() ? 'Results' : 'All mountains'}</h2>
            {results.length === 0 ? (
              <p className={styles.muted}>No mountains match “{query.trim()}”.</p>
            ) : (
              <div className={styles.list}>
                {results.map((m) => <MountainButton key={m.id} m={m} onOpen={openMountain} />)}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
