import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { resetResortCache } from '../services/api/useResorts';
import { cleanup } from '@testing-library/react';

// No backend in unit tests: fetch fails like an offline server unless a test stubs it.
beforeEach(() => {
  resetResortCache();
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
});

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
});
