import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from '../layouts/AuthLayout';
import { Button } from '../components/Button';
import { createMockMailbox } from '../services/mailbox';
import styles from './Auth.module.css';

/** Dev-only: shows the simulated emails the mock auth "sends". */
export function DevMailbox() {
  const mailbox = useMemo(() => createMockMailbox(localStorage), []);
  const [messages, setMessages] = useState(() => mailbox.list());

  const toAppPath = (link: string) => {
    try {
      const url = new URL(link, window.location.origin);
      return url.pathname + url.search;
    } catch {
      return link;
    }
  };

  return (
    <AuthLayout wide>
      <h1>Dev mailbox</h1>
      <p className={styles.lead}>Simulated emails from the mock auth service. This page only exists in development.</p>
      {messages.length === 0 ? (
        <p>No messages yet.</p>
      ) : (
        <ul className={styles.mail}>
          {messages.map((m) => (
            <li key={m.id}>
              <p className={styles.meta}>To {m.to} · {new Date(m.sentAt).toLocaleString()}</p>
              <strong>{m.subject}</strong>
              <p>{m.body}</p>
              <Link to={toAppPath(m.link)}>Reset password</Link>
            </li>
          ))}
        </ul>
      )}
      <p className={styles.alt}>
        <Button variant="secondary" onClick={() => { mailbox.clear(); setMessages([]); }}>Clear mailbox</Button>
      </p>
      <p className={styles.alt}><Link to="/login">Back to sign in</Link></p>
    </AuthLayout>
  );
}
