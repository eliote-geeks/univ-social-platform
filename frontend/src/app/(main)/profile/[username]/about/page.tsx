'use client';

import { monthYear } from '@/lib/format';
import { useProfileContext } from '../profile-context';

export default function ProfileAboutPage() {
  const { profile } = useProfileContext();

  return (
    <div className="row g-4">
      <div className="col-lg-8">
        <div className="card">
          <div className="card-header border-0">
            <h5 className="card-title">À propos</h5>
          </div>
          <div className="card-body position-relative pt-0">
            {profile.bio ? <p>{profile.bio}</p> : <p className="text-body-secondary mb-0">Aucune biographie pour l&apos;instant.</p>}
            <ul className="list-unstyled mt-3 mb-0">
              <li className="mb-2">
                <i className="bi bi-person fa-fw pe-1" /> Identifiant : <strong>@{profile.username}</strong>
              </li>
              <li>
                <i className="bi bi-calendar2-plus fa-fw pe-1" /> Membre depuis <strong>{monthYear(profile.createdAt)}</strong>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
