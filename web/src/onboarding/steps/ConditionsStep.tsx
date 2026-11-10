import { SegmentedControl } from '../../components/SegmentedControl';
import { CONDITION_KINDS } from '../../models/profile';
import { CONDITION_LABELS, CONDITION_OPTIONS } from '../questions';
import type { StepProps } from './types';

export function ConditionsStep({ draft, update }: StepProps) {
  return (
    <>
      {CONDITION_KINDS.map((k) => (
        <SegmentedControl key={k} label={CONDITION_LABELS[k]} options={CONDITION_OPTIONS} value={draft.conditions[k]}
          tone={(v) => (v === 'avoid' ? 'danger' : undefined)}
          onChange={(v) => update({ conditions: { ...draft.conditions, [k]: v } })} />
      ))}
    </>
  );
}
