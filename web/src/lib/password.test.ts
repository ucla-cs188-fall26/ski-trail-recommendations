import { describe, it, expect } from 'vitest';
import { validatePassword, passwordStrength } from './password';

describe('validatePassword', () => {
  it('accepts a password with 8+ chars, a letter and a number', () => {
    expect(validatePassword('powder123')).toBeNull();
  });

  it('rejects passwords shorter than 8 characters', () => {
    expect(validatePassword('abc1234')).toMatch(/at least 8/i);
  });

  it('accepts exactly 8 characters (boundary)', () => {
    expect(validatePassword('abcdefg1')).toBeNull();
  });

  it('rejects passwords without a number', () => {
    expect(validatePassword('onlyletters')).toMatch(/number/i);
  });

  it('rejects passwords without a letter', () => {
    expect(validatePassword('12345678')).toMatch(/letter/i);
  });

  it('rejects empty input', () => {
    expect(validatePassword('')).not.toBeNull();
  });

  it('treats non-ASCII letters as letters', () => {
    expect(validatePassword('ñieveñieve1')).toBeNull();
  });
});

describe('passwordStrength', () => {
  it('scores an empty password as 0', () => {
    expect(passwordStrength('').score).toBe(0);
  });

  it('scores weak passwords lower than strong ones', () => {
    const weak = passwordStrength('abcdefg1').score;
    const strong = passwordStrength('C0rduroy-Groomers!2026').score;
    expect(strong).toBeGreaterThan(weak);
  });

  it('keeps the score between 0 and 4 and gives a label', () => {
    for (const pw of ['', 'a', 'abcdefg1', 'Abcdefg1!', 'C0rduroy-Groomers!2026-xyz']) {
      const s = passwordStrength(pw);
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(4);
      expect(typeof s.label).toBe('string');
    }
  });

  it('never rates an invalid password above "fair" (score 1)', () => {
    expect(passwordStrength('aaaaaaaaaaaaaaaaaaaaaaaaaaaa').score).toBeLessThanOrEqual(1);
  });
});
