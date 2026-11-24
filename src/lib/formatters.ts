export function formatTimestamp(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatDurationSeconds(seconds?: number | null): string {
  if (seconds == null || Number.isNaN(seconds) || seconds < 0) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (mins < 60) return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hrs}h ${remMins}m`;
}

export function formatBytes(bytes?: number | null): string {
  if (bytes == null || Number.isNaN(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function boundUntrustedText(text: string | null | undefined, maxChars = 1600): {
  text: string;
  truncated: boolean;
  originalLength: number;
} {
  const safe = String(text ?? '');
  if (safe.length <= maxChars) {
    return { text: safe, truncated: false, originalLength: safe.length };
  }
  return {
    text: safe.slice(0, maxChars),
    truncated: true,
    originalLength: safe.length,
  };
}
