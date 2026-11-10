import { OptionCard } from '../../components/OptionCard';
import { PRIORITIES } from '../../models/profile';
import { GROUP_OPTIONS, GROUP_QUESTION, PRIORITY_OPTIONS, PRIORITY_QUESTION } from '../questions';
import type { StepProps } from './types';
import styles from './Steps.module.css';

export function CrewStep({ draft, update }: StepProps) {
  return (
    <>
      <p className={styles.groupLabel} id="group-q">{GROUP_QUESTION}</p>
      <div role="radiogroup" aria-labelledby="group-q">
        {GROUP_OPTIONS.map((o) => (
          <OptionCard key={o.value} title={o.label} selected={draft.usualGroup === o.value}
            onSelect={() => update({ usualGroup: o.value })} />
        ))}
      </div>
      <p className={styles.groupLabel} id="prio-q">{PRIORITY_QUESTION}</p>
      <div role="group" aria-labelledby="prio-q">
        {PRIORITY_OPTIONS.map((o) => {
          const on = draft.priorities.includes(o.value);
          return (
            <OptionCard key={o.value} multi title={o.title} description={o.description} selected={on}
              onSelect={() => update({
                priorities: PRIORITIES.filter((p) => (p === o.value ? !on : draft.priorities.includes(p))),
              })} />
          );
        })}
      </div>
    </>
  );
}
