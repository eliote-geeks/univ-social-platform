import type { ReactNode } from 'react';
import { Navbar } from '@/components/webestica/Navbar';
import { Sidebar } from '@/components/webestica/Sidebar';

// Navbar et <main> doivent rester frères directs dans le DOM : le CSS du thème cible
// `header.fixed-top + main` pour compenser la hauteur de la navbar fixe (cf. style.css).
export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Navbar />
      <main>
        <div className="container">
          <div className="row g-4">
            <Sidebar />
            <div className="col-lg-9">{children}</div>
          </div>
        </div>
      </main>
    </>
  );
}
