import { useState } from 'react';
import { Modal } from '../components/Modal';
import { Button } from '../components/Button';
import { TrailProgress } from '../components/TrailProgress';
import { useAuth } from '../context/AuthContext';
import type { SkierProfile } from '../models/profile';
import type { ProfilePatch } from '../services/profile/types';
import { STEP_INTROS, STEP_TITLES, type StepId } from './questions';
import { STEPS, STEP_COUNT } from './steps';
import type { StepErrors } from './steps/types';
import { SkierCard } from './SkierCard';
import styles from './OnboardingFlow.module.css';

const SUMMARY = STEP_COUNT;

export function OnboardingFlow() {
  const { profile, updateProfile } = useAuth();
  // The guard guarantees a profile here.
  const saved = profile as SkierProfile;
  const [draft, setDraft] = useState<SkierProfile>(saved);
  const [index, setIndex] = useState(() => Math.max(0, Math.min(SUMMARY, saved.onboardingStep)));
  const [errors, setErrors] = useState<StepErrors>({});
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [editingFromSummary, setEditingFromSummary] = useState(false);

  const goTo = (i: number) => {
    setErrors({});
    setFormError(undefined);
    setIndex(i);
  };

  const save = async (patch: ProfilePatch) => {
    setBusy(true);
    const res = await updateProfile(patch);
    setBusy(false);
    if (!res.ok) setFormError(res.error.message);
    return res.ok;
  };

  const afterStep = () => {
    if (editingFromSummary) {
      setEditingFromSummary(false);
      goTo(SUMMARY);
    } else {
      goTo(index + 1);
    }
  };

  const onNext = async () => {
    const step = STEPS[index];
    const errs = step.validate(draft);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const patch = step.toPatch(draft);
    if (await save({ ...patch, onboardingStep: Math.max(saved.onboardingStep, index + 1) })) {
      setDraft((d) => ({ ...d, ...patch }));
      afterStep();
    }
  };

  const onSkip = async () => {
    const step = STEPS[index];
    // Discard unsaved edits for this step's fields.
    const fields = Object.keys(step.toPatch(draft)) as (keyof SkierProfile)[];
    setDraft((d) => {
      const reverted = { ...d };
      for (const f of fields) (reverted as Record<string, unknown>)[f] = saved[f];
      return reverted;
    });
    if (await save({ onboardingStep: Math.max(saved.onboardingStep, index + 1) })) afterStep();
  };

  const onBack = () => goTo(Math.max(0, index - 1));

  const onEdit = (id: StepId) => {
    setEditingFromSummary(true);
    goTo(STEPS.findIndex((s) => s.id === id));
  };

  const onFinish = () => save({ onboardingComplete: true, onboardingStep: SUMMARY });

  const progress = <TrailProgress step={Math.min(index + 1, STEP_COUNT)} total={STEP_COUNT} />;
  const alert = formError && <p role="alert" className={styles.alert}>{formError}</p>;

  if (index >= SUMMARY) {
    return (
      <Modal
        key="summary"
        title="Your skier card"
        onClose={() => {}}
        dismissible={false}
        header={progress}
        footer={
          <>
            <Button variant="secondary" onClick={onBack}>Back</Button>
            <Button onClick={onFinish} loading={busy}>Hit the slopes</Button>
          </>
        }
      >
        <p className={styles.intro}>Here's what we'll use to pick runs for you. You can change any of it later from your profile.</p>
        {alert}
        <SkierCard profile={draft} onEdit={onEdit} />
      </Modal>
    );
  }

  const step = STEPS[index];
  const StepComponent = step.Component;
  return (
    <Modal
      key={step.id}
      title={STEP_TITLES[step.id]}
      onClose={onSkip}
      dismissible={!step.required}
      header={progress}
      footer={
        <>
          {index > 0 ? <Button variant="secondary" onClick={onBack}>Back</Button> : <span />}
          <div className={styles.right}>
            {!step.required && <Button variant="link" onClick={onSkip} disabled={busy}>Skip</Button>}
            <Button onClick={onNext} loading={busy}>{editingFromSummary ? 'Save' : 'Next'}</Button>
          </div>
        </>
      }
    >
      <p className={styles.intro}>{STEP_INTROS[step.id]}</p>
      {alert}
      <StepComponent draft={draft} update={(patch) => setDraft((d) => ({ ...d, ...patch }))} errors={errors} />
    </Modal>
  );
}
