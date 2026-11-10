import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { SegmentedControl } from './SegmentedControl';

const OPTIONS = [
  { value: 'avoid', label: 'Avoid' },
  { value: 'ok', label: 'Manageable' },
  { value: 'love', label: 'Comfortable' },
] as const;

function Wrapper({ initial = null as string | null }) {
  const [v, setV] = useState<string | null>(initial);
  return <SegmentedControl label="Ice" options={OPTIONS} value={v} onChange={setV} />;
}

describe('SegmentedControl', () => {
  it('is a labelled radiogroup with one checked option', async () => {
    render(<Wrapper initial="ok" />);
    const group = screen.getByRole('radiogroup', { name: 'Ice' });
    expect(within(group).getAllByRole('radio')).toHaveLength(3);
    expect(within(group).getByRole('radio', { name: 'Manageable' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(within(group).getByRole('radio', { name: 'Avoid' }));
    expect(within(group).getByRole('radio', { name: 'Avoid' })).toHaveAttribute('aria-checked', 'true');
    expect(within(group).getByRole('radio', { name: 'Manageable' })).toHaveAttribute('aria-checked', 'false');
  });

  it('supports arrow-key navigation that wraps around', async () => {
    render(<Wrapper initial="love" />);
    screen.getByRole('radio', { name: 'Comfortable' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Avoid' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Avoid' })).toHaveFocus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.getByRole('radio', { name: 'Comfortable' })).toHaveAttribute('aria-checked', 'true');
  });

  it('has exactly one tab stop (the checked option, or the first when none)', () => {
    const { unmount } = render(<Wrapper initial="ok" />);
    const tabbable = () => screen.getAllByRole('radio').filter((r) => r.getAttribute('tabindex') === '0');
    expect(tabbable().map((r) => r.textContent)).toEqual(['Manageable']);
    unmount();
    render(<Wrapper />);
    expect(tabbable().map((r) => r.textContent)).toEqual(['Avoid']);
  });

  it('does not fire onChange when the checked option is clicked again', async () => {
    const onChange = vi.fn();
    render(<SegmentedControl label="Ice" options={OPTIONS} value="ok" onChange={onChange} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Manageable' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
