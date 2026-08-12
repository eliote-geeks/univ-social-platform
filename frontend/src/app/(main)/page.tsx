import { PostFeed } from '@/components/webestica/PostFeed';

export default function FeedPage() {
  return <PostFeed feedEndpoint="/feed" canPost emptyMessage="Aucune publication pour l'instant. Sois le premier à publier !" />;
}
