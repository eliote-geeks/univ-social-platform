// Génère un slug URL-friendly à partir d'un nom (groupe, page…), avec repli sur un suffixe
// aléatoire court en cas de collision — appelé en boucle par le service appelant tant que
// isTaken() renvoie true.
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // retire les accents
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'groupe';
}

export async function uniqueSlug(base: string, isTaken: (slug: string) => Promise<boolean>): Promise<string> {
  const root = slugify(base);
  let candidate = root;
  let attempt = 0;
  while (await isTaken(candidate)) {
    attempt += 1;
    candidate = `${root}-${Math.random().toString(36).slice(2, 6)}`;
    if (attempt > 20) throw new Error('Impossible de générer un slug unique');
  }
  return candidate;
}
