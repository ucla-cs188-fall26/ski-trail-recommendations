export const PASSWORD_MIN_LENGTH = 8;

/** Returns a user-facing error message, or null when the password is acceptable. */
export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (!/\p{L}/u.test(password)) return 'Include at least one letter.';
  if (!/\p{N}/u.test(password)) return 'Include at least one number.';
  return null;
}

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
}

const LABELS = ['Too weak', 'Fair', 'Good', 'Strong', 'Very strong'];

export function passwordStrength(password: string): PasswordStrength {
  if (!password) return { score: 0, label: LABELS[0] };
  if (validatePassword(password)) {
    const score = password.length >= 4 ? 1 : 0;
    return { score, label: LABELS[score] };
  }
  let score = 1;
  if (password.length >= 12) score++;
  if (/\p{Lu}/u.test(password) && /\p{Ll}/u.test(password)) score++;
  if (/[^\p{L}\p{N}]/u.test(password)) score++;
  if (new Set(password).size < 4) score = Math.min(score, 1);
  const clamped = Math.min(4, score) as PasswordStrength['score'];
  return { score: clamped, label: LABELS[clamped] };
}
