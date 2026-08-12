'use client';

import { FollowList } from '@/components/webestica/FollowList';
import { useProfileContext } from '../profile-context';

export default function ProfileFollowersPage() {
  const { profile, username } = useProfileContext();
  return (
    <FollowList
      endpoint={`/users/${username}/followers`}
      emptyMessage={profile.isSelf ? "Personne ne te suit encore." : `${profile.displayName} n'a pas encore d'abonné·e.`}
    />
  );
}
