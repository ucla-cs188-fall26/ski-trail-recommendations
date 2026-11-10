import { ChoiceSlider } from '../../components/ChoiceSlider';
import { SegmentedControl } from '../../components/SegmentedControl';
import { CHALLENGE_ENDS, CHALLENGE_LABEL, CHALLENGE_TEXT, FALL_OPTIONS, FALL_QUESTION } from '../questions';
import type { StepProps } from './types';

export function PaceStep({ draft, update }: StepProps) {
  return (
    <>
      <ChoiceSlider label={CHALLENGE_LABEL} min={1} max={5} value={draft.challengeAppetite}
        onChange={(challengeAppetite) => update({ challengeAppetite })}
        minLabel={CHALLENGE_ENDS.min} maxLabel={CHALLENGE_ENDS.max} valueText={(v) => CHALLENGE_TEXT[v]} />
      <SegmentedControl label={FALL_QUESTION} options={FALL_OPTIONS} value={draft.fallConcern}
        onChange={(fallConcern) => update({ fallConcern })} />
    </>
  );
}
