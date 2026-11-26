
export type NeoGramTab =
  | 'feed'
  | 'chats'
  | 'games'
  | 'profile';

export interface NeoGramUser {
  id: string;
  username?: string;
  phone?: string;
  displayName: string;
  avatarUrl?: string;
  bannerUrl?: string;
  tag?: string;
  isCreator?: boolean;
  badges: NeoGramBadge[];
  gramBalance: number;
  createdAt?: string;
}

export type NeoGramBadge =
  | 'creator'
  | 'hold'
  | 'major'
  | 'dev';

export interface NeoGramPost {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  text: string;
  mediaUrl?: string;
  createdAt: string;
  likes: number;
  comments: number;
  isLiked?: boolean;
}

export interface NeoGramComment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: string;
}

export interface NeoGramPlayer {
  id: string;
  username?: string;
  displayName: string;
  avatarUrl?: string;
  level: number;
  experience: number;
  coins: number;
  streak: number;
}

export interface NeoGramChat {
  id: string;
  title: string;
  type: 'official_channel' | 'global' | 'private';
  lastMessage?: string;
  unreadCount: number;
  pinned: boolean;
}

export interface NeoGramClan {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  members: number;
  level: number;
  shieldEvolution: number;
  rating: number;
}

export type LeaderboardCategory =
  | 'clicker'
  | 'mouse'
  | 'clans'
  | 'wealth';

export interface LeaderboardEntry {
  userId: string;
  username: string;
  avatarUrl?: string;
  score: number;
  rank: number;
}

export interface NeoGramCase {
  id: string;
  name: string;
  price: number;
  imageUrl?: string;
  rewards: NeoGramCaseReward[];
}

export interface NeoGramCaseReward {
  id: string;
  name: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  value: number;
}

export interface NeoGramInventoryItem {
  id: string;
  rewardId: string;
  name: string;
  rarity: string;
  acquiredAt: string;
}

export interface NeoGramWallet {
  balance: number;
  currency: 'GRAM';
}

export interface NeoGramApiErrorResponse {
  ok: false;
  error: string;
  code?: string;
}

export interface NeoGramApiSuccessResponse<T> {
  ok: true;
  data: T;
}

export type NeoGramApiResponse<T> =
  | NeoGramApiSuccessResponse<T>
  | NeoGramApiErrorResponse;
