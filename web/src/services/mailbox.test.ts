import { describe, it, expect } from 'vitest';
import { createMockMailbox } from './mailbox';

describe('mock mailbox', () => {
  it('lists newest messages first and persists them', () => {
    const box = createMockMailbox(localStorage);
    box.send({ to: 'a@b.co', subject: 'One', body: 'b', link: 'http://x/1' }, 1000);
    box.send({ to: 'a@b.co', subject: 'Two', body: 'b', link: 'http://x/2' }, 2000);
    expect(createMockMailbox(localStorage).list().map((m) => m.subject)).toEqual(['Two', 'One']);
  });

  it('can be cleared', () => {
    const box = createMockMailbox(localStorage);
    box.send({ to: 'a@b.co', subject: 'One', body: 'b', link: 'http://x/1' }, 1000);
    box.clear();
    expect(box.list()).toEqual([]);
  });
});
