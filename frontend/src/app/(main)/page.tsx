import { PostFeed } from '@/components/webestica/PostFeed';
import { WhoToFollow } from '@/components/webestica/WhoToFollow';

export default function FeedPage() {
  return (
    <div className="row g-4">
      <div className="col-lg-8">
        <PostFeed feedEndpoint="/feed" canPost emptyMessage="Aucune publication pour l'instant. Sois le premier à publier !" />
      </div>
      <div className="col-lg-4">
        <WhoToFollow />
      </div>
    </div>
  );
}
