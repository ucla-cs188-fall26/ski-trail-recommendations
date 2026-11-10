import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { getMountain } from '../data/mountains';
import {
  allowedRatings, createDaySession, effectivePreferences, localDateKey, type DaySession, type SkierProfile,
} from '../models/profile';
import { CHALLENGE_TEXT, RATING_LABELS, TERRAIN_LABELS } from '../onboarding/questions';
import { DaySessionDialog, ENERGY_OPTIONS } from './DaySessionDialog';
import { NotFoundMountain } from './NotFoundMountain';
import styles from '../layouts/Page.module.css';

export function MountainHome() {
  const { mountainId = '' } = useParams();
  const mountain = getMountain(mountainId);
  const { profile, getDaySession, saveDaySession } = useAuth();
  const p = profile as SkierProfile;
  const [session, setSession] = useState<DaySession | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const date = localDateKey(new Date());

  useEffect(() => {
    if (!mountain?.hasTrailData) return;
    let cancelled = false;
    setLoaded(false);
    getDaySession(mountain.id, date).then((s) => {
      if (cancelled) return;
      setSession(s);
      setLoaded(true);
      setDialogOpen(!s);
    });
    return () => { cancelled = true; };
  }, [mountain, date, getDaySession]);

  if (!mountain) return <NotFoundMountain />;

  const hero = (
    <header className={styles.hero}>
      <p className={styles.heroSub}>{mountain.region}</p>
      <h1>{mountain.name}</h1>
    </header>
  );

  if (!mountain.hasTrailData) {
    return (
      <>
        {hero}
        <div className={styles.body}>
          <div className={styles.panel}>
            <p>Trail data for {mountain.name} is coming soon. For now, recommendations work at Mammoth Mountain.</p>
            <Link to="/" className={styles.cta}>Back to Find my mountain</Link>
          </div>
        </div>
      </>
    );
  }

  const prefs = effectivePreferences(p, session);
  const ratings = allowedRatings(p.terrainComfort);
  const onSave = async (s: DaySession) => {
    const res = await saveDaySession(s);
    if (!res.ok) return res.error.message;
    setSession(res.data);
    setDialogOpen(false);
    return null;
  };

  return (
    <>
      {hero}
      <div className={styles.body}>
        <section className={styles.panel} aria-label="Today">
          <h2>Today</h2>
          {!loaded ? (
            <p role="status">Loading…</p>
          ) : session ? (
            <ul className={styles.facts}>
              <li>{CHALLENGE_TEXT[session.challengeToday]}</li>
              <li>{ENERGY_OPTIONS.find((e) => e.value === session.energy)?.label}</li>
              {session.wantToday.length > 0 && <li>Want: {session.wantToday.map((t) => TERRAIN_LABELS[t]).join(', ')}</li>}
              {session.meetingPoint && <li>Meet: {session.meetingPoint.name}</li>}
            </ul>
          ) : (
            <p className={styles.muted}>Using your usual preferences. Tell us how today feels for better picks.</p>
          )}
          <Button variant="secondary" onClick={() => setDialogOpen(true)} disabled={!loaded}>
            {session ? "Edit today's session" : "Set today's session"}
          </Button>
        </section>

        <section className={styles.panel} aria-label="Recommended runs">
          <h2>Recommended runs</h2>
          <p className={styles.muted}>Personalized run suggestions are coming soon. They'll be based on:</p>
          <p>
            Ratings we'll suggest:{' '}
            <strong>{ratings.length ? ratings.map((r) => RATING_LABELS[r].label).join(', ') : 'none (update your comfort ratings in Profile)'}</strong>
          </p>
          <p className={styles.muted}>
            Effective challenge {prefs.challenge}/5
            {prefs.likes.length > 0 && <> · likes {prefs.likes.map((t) => TERRAIN_LABELS[t]).join(', ')}</>}
          </p>
          <Link to={`/m/${mountain.id}/map`} className={styles.cta}>Plan a route</Link>
        </section>
      </div>
      {dialogOpen && loaded && (
        <DaySessionDialog
          initial={session ?? createDaySession(p, mountain.id, new Date())}
          onSave={onSave}
          onClose={() => setDialogOpen(false)}
        />
      )}
    </>
  );
}
