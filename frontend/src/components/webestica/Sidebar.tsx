'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

const NAV_ITEMS = [
  { href: '/', label: 'Fil', icon: 'home-outline-filled' },
  { href: '/groups', label: 'Groupes', icon: 'chat-outline-filled' },
  { href: '/pages', label: 'Pages', icon: 'earth-outline-filled' },
  { href: '/events', label: 'Événements', icon: 'calendar-outline-filled' },
  { href: '/notifications', label: 'Notifications', icon: 'notification-outlined-filled' },
];

export function Sidebar() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="col-lg-3">
        <div className="card card-body text-center p-4">
          <h6>Rejoins la communauté</h6>
          <p className="small mb-3">Connecte-toi pour publier, réagir et suivre tes camarades.</p>
          <Link className="btn btn-primary btn-sm mb-2" href="/sign-in">
            Connexion
          </Link>
          <Link className="btn btn-outline-primary btn-sm" href="/sign-up">
            Créer un compte
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="col-lg-3">
      <div className="card overflow-hidden">
        <div className="h-50px bg-primary bg-opacity-10" />
        <div className="card-body pt-0">
          <div className="text-center">
            <div className="avatar avatar-lg mt-n5 mb-3">
              <Link href={`/profile/${user.username}`}>
                {user.avatarUrl ? (
                  <img className="avatar-img rounded border border-white border-3" src={user.avatarUrl} alt={user.displayName} />
                ) : (
                  <span className="avatar-img rounded border border-white border-3 bg-primary d-flex align-items-center justify-content-center text-white fw-bold fs-4">
                    {user.displayName.slice(0, 1).toUpperCase()}
                  </span>
                )}
              </Link>
            </div>
            <h5 className="mb-0">
              <Link href={`/profile/${user.username}`}>{user.displayName}</Link>
            </h5>
            <small>@{user.username}</small>
            {user.bio && <p className="mt-3">{user.bio}</p>}
          </div>

          <hr />

          <ul className="nav nav-link-secondary flex-column fw-bold gap-2">
            {NAV_ITEMS.map((item) => (
              <li className="nav-item" key={item.href}>
                <Link className="nav-link" href={item.href}>
                  <img className="me-2 h-20px fa-fw" src={`/webestica/images/icon/${item.icon}.svg`} alt="" />
                  <span>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="card-footer text-center py-2">
          <Link className="btn btn-link btn-sm" href={`/profile/${user.username}`}>
            Voir le profil
          </Link>
        </div>
      </div>
    </div>
  );
}
