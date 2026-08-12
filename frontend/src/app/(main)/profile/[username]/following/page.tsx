'use client';

import { FollowList } from '@/components/webestica/FollowList';
import { useProfileContext } from '../profile-context';

export default function ProfileFollowingPage() {
  const { profile, username } = useProfileContext();
  return (
    <FollowList
      endpoint={`/users/${username}/following`}
      emptyMessage={profile.isSelf ? "Tu ne suis encore personne." : `${profile.displayName} ne suit encore personne.`}
    />
  );
}
