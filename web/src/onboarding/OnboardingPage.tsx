import { Snowfall } from '../components/Snowfall';
import { MountainRidge } from '../components/MountainRidge';
import { OnboardingFlow } from './OnboardingFlow';

export function OnboardingPage() {
  return (
    <div style={{ position: 'relative', minHeight: '100dvh', background: 'var(--sky)', overflow: 'hidden' }}>
      <Snowfall />
      <MountainRidge className="onboarding-ridge" />
      <OnboardingFlow />
    </div>
  );
}
