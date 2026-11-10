import { useState } from 'react';
import { Modal } from '../components/Modal';
import { Button } from '../components/Button';
import { ChoiceSlider } from '../components/ChoiceSlider';
import { SegmentedControl } from '../components/SegmentedControl';
import { OptionCard } from '../components/OptionCard';
import { TextField } from '../components/TextField';
import { TERRAIN_TYPES, type DaySession, type Energy } from '../models/profile';
import { CHALLENGE_ENDS, CHALLENGE_TEXT, TERRAIN_LABELS } from '../onboarding/questions';

export const ENERGY_OPTIONS: { value: Energy; label: string }[] = [
  { value: 'fresh', label: 'Fresh' },
  { value: 'ok', label: 'OK' },
  { value: 'tired', label: 'Tired' },
];

export function DaySessionDialog({ initial, onSave, onClose }: {
  initial: DaySession;
  onSave: (s: DaySession) => Promise<string | null>;
  onClose: () => void;
}) {
  const [s, setS] = useState<DaySession>(initial);
  const [meeting, setMeeting] = useState(initial.meetingPoint?.name ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    const name = meeting.trim();
    const { meetingPoint: _old, ...rest } = s;
    const next: DaySession = name ? { ...rest, meetingPoint: { ...(s.meetingPoint ?? {}), name } } : rest;
    const err = await onSave(next);
    setBusy(false);
    setError(err);
  };

  return (
    <Modal
      title="Today's session"
      onClose={onClose}
      footer={
        <>
          <Button variant="link" onClick={onClose}>Not now</Button>
          <Button onClick={save} loading={busy}>Save</Button>
        </>
      }
    >
      <p style={{ color: 'var(--slate)', marginTop: -4 }}>How are you feeling today? This only affects today's suggestions.</p>
      {error && <p role="alert" style={{ color: 'var(--danger)', fontWeight: 600 }}>{error}</p>}
      <ChoiceSlider label="Today's challenge" min={1} max={5} value={s.challengeToday}
        onChange={(challengeToday) => setS({ ...s, challengeToday })}
        minLabel={CHALLENGE_ENDS.min} maxLabel={CHALLENGE_ENDS.max} valueText={(v) => CHALLENGE_TEXT[v]} />
      <SegmentedControl label="Energy" options={ENERGY_OPTIONS} value={s.energy} onChange={(energy) => setS({ ...s, energy })} />
      <p style={{ fontWeight: 600, margin: '4px 0 8px' }} id="want-q">Anything you're after today?</p>
      <div role="group" aria-labelledby="want-q">
        {TERRAIN_TYPES.map((t) => {
          const on = s.wantToday.includes(t);
          return (
            <OptionCard key={t} multi title={TERRAIN_LABELS[t]} selected={on}
              onSelect={() => setS({ ...s, wantToday: TERRAIN_TYPES.filter((x) => (x === t ? !on : s.wantToday.includes(x))) })} />
          );
        })}
      </div>
      <TextField label="Meeting point (optional)" value={meeting} onChange={setMeeting}
        hint="Where you're meeting your group, e.g. “Main Lodge at noon”." />
    </Modal>
  );
}
