import { useMemo, useState } from 'react';
import { TextField } from '../../components/TextField';
import { OptionCard } from '../../components/OptionCard';
import { AGE_RANGES, type AgeRange } from '../../models/profile';
import { getMountain, searchMountains } from '../../data/mountains';
import { AGE_LABELS, DETAIL_OPTIONS, DETAIL_QUESTION } from '../questions';
import type { StepProps } from './types';
import styles from './Steps.module.css';

/** '' → null, digits → number, anything else → NaN (flagged by validation). */
export function parseOptionalNumber(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  return /^\d+$/.test(t) ? Number(t) : Number.NaN;
}

export function ExperienceStep({ draft, update, errors }: StepProps) {
  const [years, setYears] = useState(draft.yearsExperience == null ? '' : String(draft.yearsExperience));
  const [days, setDays] = useState(draft.daysPerSeason == null ? '' : String(draft.daysPerSeason));
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchMountains(query), [query]);

  const toggleMountain = (id: string) => {
    const has = draft.familiarMountainIds.includes(id);
    update({ familiarMountainIds: has ? draft.familiarMountainIds.filter((x) => x !== id) : [...draft.familiarMountainIds, id] });
  };

  return (
    <>
      <div className={styles.twoCol}>
        <TextField label="Years skiing or riding" inputMode="numeric" value={years} error={errors.yearsExperience}
          onChange={(v) => { setYears(v); update({ yearsExperience: parseOptionalNumber(v) }); }} />
        <TextField label="Days per season" inputMode="numeric" value={days} error={errors.daysPerSeason}
          onChange={(v) => { setDays(v); update({ daysPerSeason: parseOptionalNumber(v) }); }} />
      </div>

      <label className={styles.selectLabel} htmlFor="age-range">Age range (optional)</label>
      <select id="age-range" className={styles.select} value={draft.ageRange ?? ''}
        onChange={(e) => update({ ageRange: (e.target.value || null) as AgeRange | null })}>
        <option value="">Prefer not to say</option>
        {AGE_RANGES.map((a) => <option key={a} value={a}>{AGE_LABELS[a]}</option>)}
      </select>

      <p className={styles.groupLabel}>Mountains you've skied before</p>
      <TextField label="Search mountains" value={query} onChange={setQuery} type="search" />
      {draft.familiarMountainIds.length > 0 && (
        <p className={styles.selected}>
          Selected: {draft.familiarMountainIds.map((id) => getMountain(id)?.name ?? id).join(', ')}
        </p>
      )}
      <div className={styles.mountains}>
        {results.length === 0 ? (
          <p className={styles.note}>No mountains match “{query.trim()}”.</p>
        ) : (
          results.map((m) => (
            <OptionCard key={m.id} multi title={m.name} description={m.region}
              selected={draft.familiarMountainIds.includes(m.id)} onSelect={() => toggleMountain(m.id)} />
          ))
        )}
      </div>

      <p className={styles.groupLabel} id="detail-q">{DETAIL_QUESTION}</p>
      <div role="radiogroup" aria-labelledby="detail-q">
        {DETAIL_OPTIONS.map((o) => (
          <OptionCard key={o.value} title={o.title} description={o.description}
            selected={draft.detailLevel === o.value} onSelect={() => update({ detailLevel: o.value })} />
        ))}
      </div>
    </>
  );
}
