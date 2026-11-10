import { Link, useParams } from 'react-router-dom';
import { getMountain } from '../data/mountains';
import { NotFoundMountain } from './NotFoundMountain';
import styles from '../layouts/Page.module.css';

/** Placeholder for the map + A→B route planner (MapLibre + routing backend integration comes later). */
export function MapRoute() {
  const { mountainId = '' } = useParams();
  const mountain = getMountain(mountainId);
  if (!mountain) return <NotFoundMountain />;
  return (
    <>
      <header className={styles.hero}>
        <p className={styles.heroSub}>{mountain.name}</p>
        <h1>Map &amp; route</h1>
      </header>
      <div className={styles.body}>
        <div className={styles.panel}>
          <p>
            Coming soon: tap a start and an end on the trail map and we'll highlight a route that fits your
            ability and today's preferences. We'll ask for your location only when you choose "Start from my location".
          </p>
          <Link to={`/m/${mountain.id}`} className={styles.cta}>Back to {mountain.name}</Link>
        </div>
      </div>
    </>
  );
}
