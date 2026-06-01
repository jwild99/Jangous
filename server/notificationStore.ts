export type NotificationType =
  | "challenge"
  | "message"
  | "rank_up"
  | "deposit"
  | "achievement"
  | "friend_online"
  | "system"
  | "clan_invite"
  | "clan_join_accepted"
  | "clan_join_denied"
  | "clan_challenge_received"
  | "clan_challenge_accepted"
  | "clan_challenge_declined"
  | "clan_challenge_won"
  | "clan_challenge_lost"
  | "reconnect_reminder"
  | "opponent_forfeited"
  | "you_forfeited"
  | "item_purchased"
  | "cosmetic_equipped"
  | "rank_reward_unlocked"
  | "weekly_shop_refresh"
  | "moderation_warning"
  | "moderation_ban"
  | "moderation_mute"
  | "moderation_restrict"
  | "social_reply"
  | "social_reaction";

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  linkTo?: string;
  meta?: Record<string, any>;
}

const notificationStore = new Map<string, AppNotification[]>();

export function pushNotification(
  userId: string,
  n: Omit<AppNotification, "id" | "userId" | "createdAt" | "read">
): AppNotification {
  if (!notificationStore.has(userId)) notificationStore.set(userId, []);
  const list = notificationStore.get(userId)!;
  const notification: AppNotification = {
    ...n,
    id: Math.random().toString(36).slice(2),
    userId,
    read: false,
    createdAt: new Date().toISOString(),
  };
  list.unshift(notification);
  if (list.length > 80) list.splice(80);
  return notification;
}

export function getNotifications(userId: string): AppNotification[] {
  return notificationStore.get(userId) || [];
}

export function markAllRead(userId: string): void {
  const list = notificationStore.get(userId) || [];
  list.forEach(n => { n.read = true; });
}

export function markRead(userId: string, id: string): void {
  const list = notificationStore.get(userId) || [];
  const n = list.find(x => x.id === id);
  if (n) n.read = true;
}

export function hasNotifications(userId: string): boolean {
  return notificationStore.has(userId);
}
