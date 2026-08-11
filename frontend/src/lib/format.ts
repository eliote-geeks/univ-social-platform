// Formatage relatif simple en français — volontairement sans dépendance externe (date-fns, etc.)
// pour un scaffold : à réévaluer si les besoins de formatage se complexifient.
export function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffSec = Math.round(diffMs / 1000);
  if (diffSec < 60) return "à l'instant";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH} h`;
  const diffDay = Math.round(diffH / 24);
  if (diffDay < 7) return `${diffDay} j`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}
