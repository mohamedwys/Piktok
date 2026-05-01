export function timeAgo(iso: string, lang: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const diffMin = diffMs / 60000;
  if (diffMin < 1) return lang === 'fr' ? "à l'instant" : 'just now';
  if (diffMin < 60) return `${Math.floor(diffMin)}m`;
  const diffHr = diffMin / 60;
  if (diffHr < 24) return `${Math.floor(diffHr)}h`;
  const diffDay = diffHr / 24;
  if (diffDay < 7) return `${Math.floor(diffDay)}d`;
  return d.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', {
    day: 'numeric',
    month: 'short',
  });
}
