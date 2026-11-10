export function FullPageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', fontWeight: 600 }}>
      {label}
    </div>
  );
}
