import { useEffect, useRef, useState } from 'react';
import { api, type SearchHit } from '../services/api';
import { difficultyToRating } from '../models/profile';
import { RATING_LABELS } from '../onboarding/questions';
import { TextField } from './TextField';
import styles from './FeaturePicker.module.css';

export function hitLabel(hit: Pick<SearchHit, 'kind' | 'difficulty'>): string {
  if (hit.kind === 'lift') return 'Lift';
  const rating = difficultyToRating(hit.difficulty);
  return rating ? RATING_LABELS[rating].label : 'Unrated trail';
}

/**
 * Text field that searches the resort's lifts and trails on the backend.
 * Typing clears the current pick (onPick(null)); choosing a suggestion picks it.
 */
export function FeaturePicker({ resortId, label, value, onChange, onPick, hint, placeholder }: {
  resortId: string;
  label: string;
  value: string;
  onChange: (text: string) => void;
  onPick: (hit: SearchHit | null) => void;
  hint?: string;
  placeholder?: string;
}) {
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [query, setQuery] = useState('');
  const ticket = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (!q) { setHits(null); return; }
    const mine = ++ticket.current;
    const timer = setTimeout(async () => {
      const r = await api.searchFeatures(resortId, q);
      if (mine !== ticket.current) return;
      setHits(r.ok ? r.data : null); // offline: stay quiet, free text still works where allowed
    }, 200);
    return () => clearTimeout(timer);
  }, [query, resortId]);

  const choose = (hit: SearchHit) => {
    ticket.current++;
    setQuery('');
    setHits(null);
    onChange(hit.name);
    onPick(hit);
  };

  return (
    <div className={styles.wrap}>
      <TextField label={label} type="search" value={value} hint={hint} placeholder={placeholder} autoComplete="off"
        onChange={(text) => { onChange(text); onPick(null); setQuery(text); }} />
      {hits && (
        <ul className={styles.list} aria-label={`${label} suggestions`}>
          {hits.length === 0 ? (
            <li className={styles.empty}>No lift or trail with that name</li>
          ) : hits.map((hit) => (
            <li key={hit.id}>
              <button type="button" className={styles.item} onClick={() => choose(hit)}>
                <span>{hit.name}</span>
                <span className={styles.meta}>{hitLabel(hit)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
