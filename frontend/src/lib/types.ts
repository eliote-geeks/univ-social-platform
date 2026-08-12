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

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  parentId: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: UserSummary;
  replies?: Comment[];
}

export interface PostDetail extends Post {
  comments: Comment[];
}

export interface PublicProfile {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  bio: string | null;
  role: SiteRole;
  createdAt: string;
  _count: { followers: number; following: number; posts: number };
  isFollowing: boolean;
  isSelf: boolean;
}

// Nommé Paginated (pas Page) pour ne pas entrer en collision avec le concept métier "Page"
// (page communautaire, cf. backend PagesModule).
export interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
}

// --- Notifications ---

export type NotificationType = 'REACTION' | 'COMMENT' | 'FOLLOW' | 'MENTION';

export interface AppNotification {
  id: string;
  recipientId: string;
  actorId: string;
  type: NotificationType;
  postId: string | null;
  commentId: string | null;
  readAt: string | null;
  createdAt: string;
  actor: UserSummary;
  post: { id: string; body: string | null } | null;
  comment: { id: string; body: string; postId: string } | null;
}

// --- Groupes ---

export type GroupRole = 'OWNER' | 'ADMIN' | 'MEMBER';
export type GroupVisibility = 'PUBLIC' | 'PRIVATE';

export interface Group {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  visibility: GroupVisibility;
  coverUrl: string | null;
  createdAt: string;
  createdBy: UserSummary;
  _count: { members: number };
  // null si non-membre (visiteur anonyme ou pas encore rejoint).
  myRole: GroupRole | null;
}

export interface GroupMemberEntry extends UserSummary {
  role: GroupRole;
  joinedAt: string;
}

// --- Pages communautaires ---

export interface CommunityPage {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  createdAt: string;
  owner: UserSummary;
  _count: { followers: number };
  isFollowing: boolean;
}

// --- Événements ---

export type EventRsvpStatus = 'GOING' | 'INTERESTED' | 'NOT_GOING';

export interface Event {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  onlineUrl: string | null;
  startAt: string;
  endAt: string | null;
  coverUrl: string | null;
  groupId: string | null;
  pageId: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  createdBy: UserSummary;
  group: { slug: string; name: string } | null;
  page: { slug: string; name: string } | null;
  _count: { attendees: number };
  myStatus: EventRsvpStatus | null;
}

export interface EventAttendeeEntry extends UserSummary {
  status: EventRsvpStatus;
  respondedAt: string;
}

// --- Messagerie ---

export type ConversationRole = 'OWNER' | 'MEMBER';

export interface Conversation {
  id: string;
  isGroup: boolean;
  title: string | null;
  participants: UserSummary[];
  myRole: ConversationRole;
  lastMessage: Message | null;
  lastMessageAt: string;
  unread: boolean;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
  sender: UserSummary;
}
