'use client';

import { useEffect, type DependencyList } from 'react';

declare global {
  interface Window {
    GLightbox?: (options?: Record<string, unknown>) => { destroy: () => void };
  }
}

// GLightbox (thème Webestica) est un script global classique chargé une fois dans le layout
// racine, pas un module npm avec wrapper React — donc pas d'import direct possible ici. Comme le
// script est injecté en `strategy="afterInteractive"`, `window.GLightbox` peut ne pas encore
// exister au premier montage d'une page qui en a besoin : on retente quelques fois avant
// d'abandonner. `deps` doit changer quand le contenu ciblé par `selector` change (nouvelles
// photos chargées) pour ré-attacher les éléments.
export function useLightbox(selector: string, deps: DependencyList) {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let instance: { destroy: () => void } | undefined;
    let cancelled = false;
    let attempts = 0;

    function tryInit() {
      if (cancelled) return;
      if (window.GLightbox) {
        instance = window.GLightbox({ selector, touchNavigation: true, loop: true });
      } else if (attempts < 20) {
        attempts += 1;
        setTimeout(tryInit, 150);
      }
    }
    tryInit();

    return () => {
      cancelled = true;
      instance?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
