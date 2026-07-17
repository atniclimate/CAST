import type { StatusSnapshot, StatusState } from '@ewm/core-status';

const statusLabels: Readonly<Record<StatusState, string>> = {
  live: 'Live',
  cached: 'Cached',
  stale: 'Stale',
  degraded: 'Degraded',
  unavailable: 'Unavailable',
};

export function formatAsOf(value: string | null): string {
  if (value === null) return 'no data available';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(value));
}

export interface StatusDisplayProps {
  readonly snapshot: StatusSnapshot;
  readonly compact?: boolean;
}

export function StatusDisplay({ snapshot, compact = false }: StatusDisplayProps) {
  return (
    <div className={`status-display status-display--${snapshot.state}${compact ? ' status-display--compact' : ''}`} role="status">
      <span className="status-display__state">{statusLabels[snapshot.state]}</span>
      <span className="status-display__stamp">As of {formatAsOf(snapshot.asOf)}</span>
      {!compact && snapshot.detail ? <span className="status-display__detail">{snapshot.detail}</span> : null}
    </div>
  );
}
