import { db } from "./db";
import { socialPosts, users } from "@shared/schema";
import { eq } from "drizzle-orm";

export const SYSTEM_USER_ID = "jango-platform";

export async function ensureSystemUser() {
  try {
    const [existing] = await db.select().from(users).where(eq(users.id, SYSTEM_USER_ID));
    if (!existing) {
      await db.insert(users).values({
        id: SYSTEM_USER_ID,
        firstName: "Jango",
        lastName: "Platform",
        username: "JangoPlatform",
        email: "platform@jango.gg",
        profileImageUrl: null,
        nicknameColor: "#22d3ee",
      });
      console.log("[SOCIAL-AUTO] Created system user for auto-posts");
    }
  } catch (err) {
    console.error("[SOCIAL-AUTO] Failed to ensure system user:", err);
  }
}

export async function createAutoPost(subjectUserId: string, content: string, type: string = "auto") {
  try {
    await db.insert(socialPosts).values({
      authorId: SYSTEM_USER_ID,
      subjectUserId: subjectUserId !== SYSTEM_USER_ID ? subjectUserId : null,
      type,
      content,
    });
  } catch (err) {
    console.error("[SOCIAL-AUTO] Failed to create auto post:", err);
  }
}

async function resolvePlayerName(userId: string): Promise<string> {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    return user?.username || user?.firstName || "A player";
  } catch {
    return "A player";
  }
}

export async function createWinPost(winnerId: string, winnerName: string, gameType: string, betAmount: string | number, score?: string) {
  const name = winnerName || await resolvePlayerName(winnerId);
  const scoreStr = score ? ` (${score})` : "";
  const content = `${name} won a ${gameType} match${scoreStr} and earned ${betAmount} SCALPS!`;
  await createAutoPost(winnerId, content, "auto");
}

export async function createBigWinPost(winnerId: string, winnerName: string, amount: number) {
  const name = winnerName || await resolvePlayerName(winnerId);
  const content = `Massive win! ${name} just earned ${amount} SCALPS in a single match!`;
  await createAutoPost(winnerId, content, "auto");
}

export async function createRankUpPost(userId: string, newTier: string, gameType: string = "Air Hockey") {
  const name = await resolvePlayerName(userId);
  const content = `${name} ranked up to ${newTier} in ${gameType}! Climbing the ladder one match at a time.`;
  await createAutoPost(userId, content, "auto");
}

export async function createGoatPost(userId: string, userName: string) {
  const name = userName || await resolvePlayerName(userId);
  const content = `${name} has claimed the #1 GOAT spot on the global leaderboard!`;
  await createAutoPost(userId, content, "auto");
}

export async function createClanWarWinPost(clanName: string, leaderId?: string) {
  const content = `${clanName} just won a clan war! Glory to the victors!`;
  await createAutoPost(leaderId || SYSTEM_USER_ID, content, "auto");
}

export async function createAchievementPost(userId: string, achievementName: string) {
  const name = await resolvePlayerName(userId);
  const content = `${name} unlocked achievement: ${achievementName}!`;
  await createAutoPost(userId, content, "auto");
}

export async function checkGoatChange(previousGoatId: string | null): Promise<string | null> {
  try {
    const { getLeaderboard } = (await import("./storage")).storage;
    const leaderboard = await getLeaderboard(50);
    if (!leaderboard.length) return previousGoatId;
    const sorted = [...leaderboard].sort((a, b) => ((b as unknown as Record<string, number>).overallRating ?? 0) - ((a as unknown as Record<string, number>).overallRating ?? 0));
    const currentGoat = sorted[0] as any;
    if (currentGoat.id !== previousGoatId && previousGoatId !== null) {
      const goatName = currentGoat.username || currentGoat.firstName || "A player";
      await createGoatPost(currentGoat.id, goatName);
    }
    return currentGoat.id;
  } catch {
    return previousGoatId;
  }
}

export async function seedExamplePosts() {
  try {
    await ensureSystemUser();

    const existing = await db.select().from(socialPosts).limit(1);
    if (existing.length > 0) return;

    const allUsers = await db.select().from(users).limit(5);
    if (allUsers.length === 0) return;

    const userPosts = [
      { type: "general", content: "Anyone else notice the new mini golf course is way harder? Hole 7 is brutal." },
      { type: "challenge", content: "Looking for a worthy opponent in Connect 4. 50 SCALPS wager. Who's brave enough?" },
      { type: "general", content: "The competitive scene on this platform is no joke. Every match feels intense." },
    ];

    const autoPosts = [
      { type: "auto", content: `${allUsers[0]?.username || allUsers[0]?.firstName || "A player"} won a Chess match (3-1) and earned 50 SCALPS!` },
      { type: "auto", content: `${allUsers[1]?.username || allUsers[1]?.firstName || "A player"} ranked up to Diamond in Air Hockey!` },
      { type: "auto", content: `${allUsers[2]?.username || allUsers[2]?.firstName || "A player"} has claimed the #1 GOAT spot on the global leaderboard!` },
    ];

    for (let i = 0; i < userPosts.length; i++) {
      const author = allUsers[i % allUsers.length];
      await db.insert(socialPosts).values({
        authorId: author.id,
        type: userPosts[i].type,
        content: userPosts[i].content,
      });
    }

    for (const ap of autoPosts) {
      await db.insert(socialPosts).values({
        authorId: SYSTEM_USER_ID,
        type: ap.type,
        content: ap.content,
      });
    }

    console.log("[SOCIAL-AUTO] Seeded example posts");
  } catch (err) {
    console.error("[SOCIAL-AUTO] Failed to seed posts:", err);
  }
}
