export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString('pt-BR');
}

export function formatPercent(n: number, digits = 1): string {
  return `${n.toFixed(digits)}%`;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return '—';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)} min`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

export function formatDelta(n: number, digits = 1): string {
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(digits)}%`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

export function formatDateRelative(iso: string | null | undefined): string {
  if (!iso) return 'sem data';
  const now = Date.now();
  const target = new Date(iso).getTime();
  const diffDays = Math.round((target - now) / 86_400_000);
  if (diffDays === 0) return 'hoje';
  if (diffDays === 1) return 'amanhã';
  if (diffDays === -1) return 'ontem';
  if (diffDays > 1 && diffDays <= 7) return `em ${diffDays} dias`;
  if (diffDays < -1 && diffDays >= -7) return `há ${-diffDays} dias`;
  return formatDate(iso);
}

export function formatStatus(status: { name: string; type?: string } | null | undefined): string {
  if (!status) return '—';
  return status.name;
}

export function formatPriority(p: string | null | undefined): string {
  if (!p || p === 'NONE') return '—';
  const map: Record<string, string> = {
    LOW: 'baixa',
    NORMAL: 'normal',
    HIGH: 'alta',
    URGENT: 'urgente',
  };
  return map[p] ?? p.toLowerCase();
}

export function formatUser(u: { name?: string; email?: string } | null | undefined): string {
  if (!u) return '—';
  return u.name ?? u.email ?? '—';
}

export function formatTaskLine(t: {
  title: string;
  status: { name: string } | null;
  priority: string;
  dueDate: string | null;
  assignees: { name?: string; email?: string }[];
}): string {
  const status = t.status ? `[${t.status.name}]` : '';
  const due = t.dueDate ? ` · vence ${formatDateRelative(t.dueDate)}` : '';
  const first = t.assignees[0];
  const assignee = first ? ` · ${formatUser(first)}` : '';
  const pri = t.priority !== 'NORMAL' ? ` · ${formatPriority(t.priority)}` : '';
  return `• ${t.title} ${status}${due}${assignee}${pri}`.trim();
}
