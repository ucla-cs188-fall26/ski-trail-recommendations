import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Button } from './Button';
import { TextField } from './TextField';
import { PasswordField } from './PasswordField';
import { OptionCard } from './OptionCard';
import { ChoiceSlider } from './ChoiceSlider';
import { TrailProgress } from './TrailProgress';
import { CycleChip } from './CycleChip';
import { Modal } from './Modal';
import { Snowfall } from './Snowfall';

describe('Button', () => {
  it('calls onClick when pressed', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Sign in</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled and busy while loading, and ignores clicks', async () => {
    const onClick = vi.fn();
    render(<Button loading onClick={onClick}>Sign in</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('defaults to type="button" so it does not submit forms accidentally', () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });
});

describe('TextField', () => {
  it('associates the label with the input', () => {
    render(<TextField label="Email" value="" onChange={() => {}} />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('reports typed values through onChange', async () => {
    function Wrapper() {
      const [v, setV] = useState('');
      return <TextField label="Email" value={v} onChange={setV} />;
    }
    render(<Wrapper />);
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.co');
    expect(screen.getByLabelText('Email')).toHaveValue('a@b.co');
  });

  it('shows an error, marks the input invalid and links the message', () => {
    render(<TextField label="Email" value="x" onChange={() => {}} error="Enter a valid email" />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Enter a valid email');
  });

  it('is not marked invalid without an error', () => {
    render(<TextField label="Email" value="" onChange={() => {}} />);
    expect(screen.getByLabelText('Email')).not.toHaveAttribute('aria-invalid', 'true');
  });
});

describe('PasswordField', () => {
  it('hides the password by default and can toggle visibility', async () => {
    render(<PasswordField label="Password" value="secret12" onChange={() => {}} />);
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: /show password/i }));
    expect(input).toHaveAttribute('type', 'text');
    await userEvent.click(screen.getByRole('button', { name: /hide password/i }));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('shows a strength meter only when requested', () => {
    const { rerender } = render(<PasswordField label="Password" value="abcdefg1" onChange={() => {}} />);
    expect(screen.queryByRole('meter')).not.toBeInTheDocument();
    rerender(<PasswordField label="Password" value="abcdefg1" onChange={() => {}} showStrength />);
    expect(screen.getByRole('meter')).toBeInTheDocument();
  });

  it('shows its error message', () => {
    render(<PasswordField label="Password" value="" onChange={() => {}} error="Too short" />);
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription(/too short/i);
  });
});

describe('OptionCard', () => {
  it('acts as a radio with checked state and fires onSelect', async () => {
    const onSelect = vi.fn();
    render(
      <div role="radiogroup" aria-label="Ability">
        <OptionCard title="Linking turns on greens" selected={false} onSelect={onSelect} />
        <OptionCard title="Comfortable on most blues" selected onSelect={() => {}} />
      </div>,
    );
    const first = screen.getByRole('radio', { name: /linking turns/i });
    expect(first).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('radio', { name: /most blues/i })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(first);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('can be selected with the keyboard', async () => {
    const onSelect = vi.fn();
    render(<OptionCard title="Skis" selected={false} onSelect={onSelect} />);
    screen.getByRole('radio').focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it('supports multi-select mode as a checkbox', () => {
    render(<OptionCard title="Avoid lift lines" multi selected onSelect={() => {}} />);
    expect(screen.getByRole('checkbox', { name: /avoid lift lines/i })).toHaveAttribute('aria-checked', 'true');
  });
});

describe('ChoiceSlider', () => {
  it('is a labeled slider that reports numeric values', async () => {
    function Wrapper() {
      const [v, setV] = useState(3);
      return <ChoiceSlider label="Challenge" min={1} max={5} value={v} onChange={setV}
        minLabel="Keep it mellow" maxLabel="Push me" />;
    }
    render(<Wrapper />);
    const slider = screen.getByRole('slider', { name: 'Challenge' });
    expect(slider).toHaveValue('3');
    // jsdom does not implement arrow-key stepping on range inputs, so set the value directly.
    fireEvent.change(slider, { target: { value: '4' } });
    expect(slider).toHaveValue('4');
    expect(screen.getByText('Keep it mellow')).toBeInTheDocument();
    expect(screen.getByText('Push me')).toBeInTheDocument();
  });

  it('exposes a human-readable value text when provided', () => {
    render(<ChoiceSlider label="Challenge" min={1} max={5} value={2} onChange={() => {}}
      valueText={(v) => `Level ${v}`} />);
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', 'Level 2');
  });
});

describe('TrailProgress', () => {
  it('reports progress as a labeled progressbar', () => {
    render(<TrailProgress step={3} total={8} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '3');
    expect(bar).toHaveAttribute('aria-valuemax', '8');
    expect(bar).toHaveAccessibleName(/step 3 of 8/i);
  });

  it('clamps out-of-range steps', () => {
    render(<TrailProgress step={12} total={8} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '8');
  });
});

describe('CycleChip', () => {
  it('cycles neutral → like → avoid → neutral', async () => {
    function Wrapper() {
      const [s, setS] = useState<'neutral' | 'like' | 'avoid'>('neutral');
      return <CycleChip label="Moguls" state={s} onChange={setS} />;
    }
    render(<Wrapper />);
    const chip = screen.getByRole('button', { name: /moguls/i });
    expect(chip).toHaveAccessibleName(/moguls.*no preference/i);
    await userEvent.click(chip);
    expect(chip).toHaveAccessibleName(/moguls.*like/i);
    await userEvent.click(chip);
    expect(chip).toHaveAccessibleName(/moguls.*avoid/i);
    await userEvent.click(chip);
    expect(chip).toHaveAccessibleName(/moguls.*no preference/i);
  });
});

describe('Modal', () => {
  it('renders a labelled modal dialog and moves focus inside', () => {
    render(<Modal title="About you" onClose={() => {}}><input aria-label="Name" /></Modal>);
    const dialog = screen.getByRole('dialog', { name: 'About you' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('closes on Escape when dismissible', async () => {
    const onClose = vi.fn();
    render(<Modal title="Terrain" onClose={onClose}><button>Next</button></Modal>);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores Escape when not dismissible (required steps)', async () => {
    const onClose = vi.fn();
    render(<Modal title="Ability" onClose={onClose} dismissible={false}><button>Next</button></Modal>);
    await userEvent.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('traps Tab focus inside the dialog', async () => {
    render(
      <>
        <button>Outside</button>
        <Modal title="Trap" onClose={() => {}}>
          <button>First</button>
          <button>Last</button>
        </Modal>
      </>,
    );
    const dialog = screen.getByRole('dialog');
    for (let i = 0; i < 5; i++) {
      await userEvent.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    screen.getByRole('button', { name: 'First' }).focus();
    await userEvent.tab({ shift: true });
    expect(dialog.contains(document.activeElement)).toBe(true);
  });
});

describe('Snowfall', () => {
  function mockReducedMotion(reduce: boolean) {
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: reduce && q.includes('prefers-reduced-motion'),
      media: q, onchange: null,
      addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
      dispatchEvent: () => false,
    }));
  }

  it('is decorative (hidden from assistive tech)', () => {
    mockReducedMotion(false);
    const { container } = render(<Snowfall />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders no flakes when the user prefers reduced motion', () => {
    mockReducedMotion(true);
    const { container } = render(<Snowfall />);
    expect(container.querySelectorAll('[data-flake]').length).toBe(0);
  });

  it('renders flakes otherwise', () => {
    mockReducedMotion(false);
    const { container } = render(<Snowfall />);
    expect(container.querySelectorAll('[data-flake]').length).toBeGreaterThan(0);
  });
});
