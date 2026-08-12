import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import { AuthProvider } from '@/lib/auth-context';
import './globals.css';

// Police du thème Webestica d'origine (Inter, chargée via Google Fonts dans le HTML source) —
// next/font l'auto-héberge au build, plus rapide et plus fiable qu'un lien Google Fonts direct.
const inter = Inter({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700'], variable: '--bs-font-sans-serif' });

export const metadata: Metadata = {
  title: 'Réseau social universitaire',
  description: "Fil d'actu, groupes, pages, événements et messagerie pour la communauté étudiante",
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="fr" data-bs-theme="light">
      <head>
        <link rel="icon" href="/webestica/images/favicon.ico" />
        <link rel="stylesheet" href="/webestica/vendor/font-awesome/css/all.min.css" />
        <link rel="stylesheet" href="/webestica/vendor/bootstrap-icons/bootstrap-icons.css" />
        <link rel="stylesheet" href="/webestica/vendor/glightbox/css/glightbox.min.css" />
        <link rel="stylesheet" href="/webestica/css/style.css" />
      </head>
      <body className={inter.className}>
        <AuthProvider>{children}</AuthProvider>
        {/* Bundle Bootstrap (JS pur, sans jQuery) : nécessaire pour les dropdowns/offcanvas/collapse
            du thème, pilotés en pur data-attributes — aucun wrapper React requis. */}
        <Script src="/webestica/vendor/bootstrap/dist/js/bootstrap.bundle.min.js" strategy="afterInteractive" />
        {/* Visionneuse plein écran pour les grilles de photos (profil, albums) — voir useLightbox. */}
        <Script src="/webestica/vendor/glightbox/js/glightbox.min.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
