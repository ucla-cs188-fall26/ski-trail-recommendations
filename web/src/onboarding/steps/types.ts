import type { SkierProfile } from '../../models/profile';

export type StepErrors = Record<string, string>;

export interface StepProps {
  draft: SkierProfile;
  update: (patch: Partial<SkierProfile>) => void;
  errors: StepErrors;
}
