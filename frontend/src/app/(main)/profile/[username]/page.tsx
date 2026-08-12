'use client';

import { ProfilePhotos } from '@/components/webestica/ProfilePhotos';
import { PostFeed } from '@/components/webestica/PostFeed';
import { useProfileContext } from './profile-context';

export default function ProfilePostsPage() {
  const { profile, username } = useProfileContext();

  return (
    <div className="row g-4">
      <div className="col-lg-8">
        <PostFeed
          feedEndpoint={`/users/${username}/posts`}
          canPost={profile.isSelf}
          emptyMessage={profile.isSelf ? "Tu n'as encore rien publié." : "Aucune publication pour l'instant."}
        />
      </div>
      <div className="col-lg-4">
        <ProfilePhotos username={username} />
      </div>
    </div>
  );
}
