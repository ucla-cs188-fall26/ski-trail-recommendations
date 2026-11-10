import { readJson, writeJson } from './storage';

/** Dev-only simulated inbox for password-reset emails (rendered at /dev/mailbox). */
export interface MailMessage {
  id: string;
  to: string;
  subject: string;
  body: string;
  link: string;
  sentAt: string;
}

export interface MockMailbox {
  send(msg: Omit<MailMessage, 'id' | 'sentAt'>, now?: number): MailMessage;
  list(): MailMessage[];
  clear(): void;
}

const KEY = 'trailwise.dev.mailbox';

export function createMockMailbox(storage: Storage = localStorage): MockMailbox {
  const read = () => {
    const v = readJson<MailMessage[]>(storage, KEY, []);
    return Array.isArray(v) ? v : [];
  };
  return {
    send(msg, now = Date.now()) {
      const full: MailMessage = { ...msg, id: crypto.randomUUID(), sentAt: new Date(now).toISOString() };
      writeJson(storage, KEY, [full, ...read()].slice(0, 50));
      return full;
    },
    list: () => read().sort((a, b) => b.sentAt.localeCompare(a.sentAt)),
    clear: () => storage.removeItem(KEY),
  };
}
