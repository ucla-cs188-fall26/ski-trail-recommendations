import { CycleChip, type ChipState } from '../../components/CycleChip';
import { TERRAIN_TYPES, type TerrainType } from '../../models/profile';
import { TERRAIN_LABELS, TERRAIN_NOTE } from '../questions';
import type { StepProps } from './types';
import styles from './Steps.module.css';

export function TerrainStep({ draft, update }: StepProps) {
  const stateOf = (t: TerrainType): ChipState =>
    draft.terrainLikes.includes(t) ? 'like' : draft.terrainAvoids.includes(t) ? 'avoid' : 'neutral';
  const setState = (t: TerrainType, s: ChipState) => {
    // Keep TERRAIN_TYPES order for stable output.
    const likes = TERRAIN_TYPES.filter((x) => (x === t ? s === 'like' : draft.terrainLikes.includes(x)));
    const avoids = TERRAIN_TYPES.filter((x) => (x === t ? s === 'avoid' : draft.terrainAvoids.includes(x)));
    update({ terrainLikes: likes, terrainAvoids: avoids });
  };
  return (
    <>
      <div className={styles.chips}>
        {TERRAIN_TYPES.map((t) => (
          <CycleChip key={t} label={TERRAIN_LABELS[t]} state={stateOf(t)} onChange={(s) => setState(t, s)} />
        ))}
      </div>
      <p className={styles.note}>{TERRAIN_NOTE}</p>
    </>
  );
}
