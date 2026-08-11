export type SiteRole = 'USER' | 'MODERATOR' | 'ADMIN';

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  role: SiteRole;
}

export interface Me extends AuthUser {
  bio: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  emailVerified: boolean;
  createdAt: string;
}

export interface UserSummary {
  id?: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export type MediaType = 'IMAGE' | 'VIDEO';
export type PostVisibility = 'PUBLIC' | 'FOLLOWERS' | 'ONLY_ME';
export type ReactionType = 'LIKE' | 'LOVE' | 'HAHA' | 'WOW' | 'SAD' | 'ANGRY';

export interface PostMedia {
  id: string;
  type: MediaType;
  url: string;
  altText: string | null;
  width: number | null;
  height: number | null;
  sortOrder: number;
}

export interface Post {
  id: string;
  authorId: string;
  body: string | null;
  visibility: PostVisibility;
  groupId: string | null;
  pageId: string | null;
  publishedAt: string;
  updatedAt: string;
  author: UserSummary;
  group: { slug: string; name: string } | null;
  page: { slug: string; name: string } | null;
  media: PostMedia[];
  _count: { reactions: number; comments: number };
  // Renseigné côté client seulement (le backend ne renvoie pas la réaction de l'utilisateur
  // courant dans la liste de fil) : voir usePostReaction dans PostCard.
  myReaction?: ReactionType | null;
}

export interface PublicProfile {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  _count: { followers: number; following: number; posts: number };
  isFollowing: boolean;
  isSelf: boolean;
}

// Nommé Paginated (pas Page) pour ne pas entrer en collision avec le concept métier "Page"
// (page communautaire, cf. backend PagesModule) qui arrivera dans une prochaine itération.
export interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
}
