'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

export function Navbar() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- voir lib/auth-context.tsx
      setUnreadCount(0);
      return;
    }
    let cancelled = false;
    const poll = () => {
      apiFetch<{ count: number }>('/notifications/unread-count')
        .then((r) => {
          if (!cancelled) setUnreadCount(r.count);
        })
        .catch(() => {});
    };
    poll();
    // Pas de push temps réel pour les notifications (contrairement à la messagerie qui a un
    // vrai gateway WebSocket) : un polling simple suffit pour ce volume d'usage.
    const interval = setInterval(poll, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // Revérifie aussi à chaque changement de page (ex: retour de /notifications qui vient de
    // tout marquer comme lu).
  }, [user, pathname]);

  function onSearch(event: FormEvent) {
    event.preventDefault();
    // La recherche transversale (utilisateurs/groupes/pages) arrive avec les pages qui la
    // consomment réellement — on ne branche que la navigation pour l'instant.
    if (search.trim()) router.push(`/search?q=${encodeURIComponent(search.trim())}`);
  }

  async function onLogout() {
    await logout();
    router.push('/sign-in');
  }

  return (
    <header className="navbar-light fixed-top header-static bg-mode">
      <nav className="navbar navbar-expand-lg">
        <div className="container">
          <Link className="navbar-brand fw-bold fs-4 text-primary" href="/">
            Univ Social
          </Link>

          <button
            className="navbar-toggler ms-auto icon-md btn btn-light p-0"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#navbarCollapse"
            aria-controls="navbarCollapse"
            aria-expanded="false"
            aria-label="Toggle navigation"
          >
            <span className="navbar-toggler-animation">
              <span /> <span /> <span />
            </span>
          </button>

          <div className="collapse navbar-collapse" id="navbarCollapse">
            <div className="nav mt-3 mt-lg-0 flex-nowrap align-items-center px-4 px-lg-0">
              <div className="nav-item w-100">
                <form className="rounded position-relative" onSubmit={onSearch}>
                  <input
                    className="form-control ps-5 bg-light"
                    type="search"
                    placeholder="Rechercher..."
                    aria-label="Rechercher"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <button className="btn bg-transparent px-2 py-0 position-absolute top-50 start-0 translate-middle-y" type="submit">
                    <i className="bi bi-search fs-5" />
                  </button>
                </form>
              </div>
            </div>

            {user && (
              <ul className="navbar-nav navbar-nav-scroll ms-auto">
                <li className="nav-item">
                  <Link className="nav-link" href="/groups">
                    Groupes
                  </Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" href="/pages">
                    Pages
                  </Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" href="/events">
                    Événements
                  </Link>
                </li>
              </ul>
            )}
          </div>

          <ul className="nav flex-nowrap align-items-center ms-sm-3 list-unstyled">
            {user ? (
              <>
                <li className="nav-item ms-2">
                  <Link className="nav-link bg-light icon-md btn btn-light p-0" href="/messages">
                    <i className="bi bi-chat-left-text-fill fs-6" />
                  </Link>
                </li>
                <li className="nav-item ms-2">
                  <Link className="nav-link bg-light icon-md btn btn-light p-0 position-relative" href="/notifications">
                    <i className="bi bi-bell-fill fs-6" />
                    {unreadCount > 0 && (
                      <span className="badge bg-danger rounded-pill position-absolute top-0 start-100 translate-middle" style={{ fontSize: '0.6rem' }}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </Link>
                </li>
                <li className="nav-item ms-2 dropdown">
                  <a
                    className="nav-link btn icon-md p-0"
                    href="#"
                    id="profileDropdown"
                    role="button"
                    data-bs-auto-close="outside"
                    data-bs-display="static"
                    data-bs-toggle="dropdown"
                    aria-expanded="false"
                  >
                    {user.avatarUrl ? (
                      <img className="avatar-img rounded-2" src={user.avatarUrl} alt={user.displayName} />
                    ) : (
                      <span className="avatar-img rounded-2 bg-primary d-flex align-items-center justify-content-center text-white fw-bold">
                        {user.displayName.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                  </a>
                  <ul className="dropdown-menu dropdown-animation dropdown-menu-end pt-3 small me-md-n3" aria-labelledby="profileDropdown">
                    <li className="px-3">
                      <div className="d-flex align-items-center position-relative">
                        <div className="avatar me-3">
                          {user.avatarUrl ? (
                            <img className="avatar-img rounded-circle" src={user.avatarUrl} alt={user.displayName} />
                          ) : (
                            <span className="avatar-img rounded-circle bg-primary d-flex align-items-center justify-content-center text-white fw-bold">
                              {user.displayName.slice(0, 1).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div>
                          <Link className="h6 stretched-link" href={`/profile/${user.username}`}>
                            {user.displayName}
                          </Link>
                          <p className="small m-0">@{user.username}</p>
                        </div>
                      </div>
                      <Link className="dropdown-item btn btn-primary-soft btn-sm my-2 text-center" href={`/profile/${user.username}`}>
                        Voir le profil
                      </Link>
                    </li>
                    <li>
                      <Link className="dropdown-item" href="/settings/profile">
                        <i className="bi bi-gear fa-fw pe-2" />
                        Modifier le profil
                      </Link>
                    </li>
                    <li>
                      <hr className="dropdown-divider" />
                    </li>
                    <li>
                      <button type="button" className="dropdown-item bg-danger-soft-hover" onClick={onLogout}>
                        <i className="bi bi-power fa-fw me-2" />
                        Se déconnecter
                      </button>
                    </li>
                  </ul>
                </li>
              </>
            ) : (
              <>
                <li className="nav-item ms-2">
                  <Link className="btn btn-light" href="/sign-in">
                    Connexion
                  </Link>
                </li>
                <li className="nav-item ms-2">
                  <Link className="btn btn-primary" href="/sign-up">
                    Inscription
                  </Link>
                </li>
              </>
            )}
          </ul>
        </div>
      </nav>
    </header>
  );
}
