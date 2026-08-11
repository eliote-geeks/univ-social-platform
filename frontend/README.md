# Frontend — Réseau social universitaire

Next.js 16 (App Router, TypeScript) + design system [Webestica](https://www.webestica.com/) (Bootstrap 5) porté en composants React. Consomme l'API NestJS du dossier `../backend`.

## Démarrer en local

```bash
cp .env.example .env.local   # ajuste NEXT_PUBLIC_API_BASE_URL si besoin
npm install
npm run dev
```

Le backend (`../backend`) doit tourner en parallèle — voir son propre README pour le lancer en local.

## Structure

- `src/app/(auth)/` — connexion, inscription (layout centré, sans navbar)
- `src/app/(main)/` — shell applicatif (navbar + sidebar) : fil d'actu, profil, et pages "à venir" pour groupes/pages/événements/messagerie/notifications (en cours d'implémentation)
- `src/components/webestica/` — composants portant le design Webestica
- `src/lib/` — client API (`api-client.ts`, avec refresh de token automatique), contexte d'authentification (`auth-context.tsx`), types partagés (`types.ts`)
- `public/webestica/` — assets compilés du thème (CSS, icônes, JS Bootstrap) copiés depuis le thème acheté ; jamais modifiés à la main, seulement consommés via classes CSS/JS

## Scripts

- `npm run dev` — serveur de développement
- `npm run build` — build de production
- `npm run lint` — ESLint (avertissements `<img>`/`no-css-tags` attendus et documentés en commentaire aux endroits concernés — choix délibérés, pas des oublis)
