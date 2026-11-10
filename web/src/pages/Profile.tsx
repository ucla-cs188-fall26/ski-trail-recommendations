import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { MOUNTAINS } from '../data/mountains';
import type { SkierProfile } from '../models/profile';
import { SkierCard } from '../onboarding/SkierCard';
import { STEP_TITLES, type StepId } from '../onboarding/questions';
import { STEPS } from '../onboarding/steps';
import type { StepErrors } from '../onboarding/steps/types';
import styles from '../layouts/Page.module.css';

function EditSectionDialog({ stepId, profile, onDone }: { stepId: StepId; profile: SkierProfile; onDone: () => void }) {
  const { updateProfile } = useAuth();
  const step = STEPS.find((s) => s.id === stepId)!;
  const [draft, setDraft] = useState(profile);
  const [errors, setErrors] = useState<StepErrors>({});
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const StepComponent = step.Component;

  const save = async () => {
    const errs = step.validate(draft);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    const res = await updateProfile(step.toPatch(draft));
    setBusy(false);
    if (res.ok) onDone();
    else setFormError(res.error.message);
  };

  return (
    <Modal
      title={STEP_TITLES[stepId]}
      onClose={onDone}
      footer={
        <>
          <Button variant="secondary" onClick={onDone}>Cancel</Button>
          <Button onClick={save} loading={busy}>Save</Button>
        </>
      }
    >
      {formError && <p role="alert" style={{ color: 'var(--danger)', fontWeight: 600 }}>{formError}</p>}
      <StepComponent draft={draft} update={(patch) => setDraft((d) => ({ ...d, ...patch }))} errors={errors} />
    </Modal>
  );
}

export function Profile() {
  const { profile, user, updateProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const p = profile as SkierProfile;
  const [editing, setEditing] = useState<StepId | null>(null);

  const onSignOut = async () => {
    await signOut();
    navigate('/welcome', { replace: true });
  };

  return (
    <>
      <header className={styles.hero}>
        <h1>Your profile</h1>
        <p className={styles.heroSub}>{user?.email}</p>
      </header>
      <div className={styles.body}>
        <section className={styles.panel} aria-label="Skier card">
          <h2>Your skier card</h2>
          <SkierCard profile={p} onEdit={setEditing} />
        </section>

        <section className={styles.panel} aria-label="Settings">
          <h2>Settings</h2>
          <div className={styles.switchRow}>
            <span id="skill-switch">Show my skill level on reviews</span>
            <button type="button" role="switch" aria-checked={p.showSkillOnReviews} aria-labelledby="skill-switch"
              className={styles.switch} onClick={() => updateProfile({ showSkillOnReviews: !p.showSkillOnReviews })} />
          </div>
          <p className={styles.muted}>When reviews launch, others will see your level next to your tips so they can judge them.</p>
          <label className={styles.label} htmlFor="home-mountain">Home mountain</label>
          <select id="home-mountain" className={styles.select} value={p.homeMountainId ?? ''}
            onChange={(e) => updateProfile({ homeMountainId: e.target.value || null })}>
            <option value="">None</option>
            {MOUNTAINS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </section>

        <div className={styles.panel}>
          <Button variant="secondary" block onClick={onSignOut}>Sign out</Button>
        </div>
      </div>
      {editing && <EditSectionDialog stepId={editing} profile={p} onDone={() => setEditing(null)} />}
    </>
  );
}
