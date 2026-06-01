import { db } from "./db";
import { parties, partyMembers, partyMessages, users, type Party, type PartyWithMembers, type PartyMessage } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { pushNotification } from "./notificationStore";

const PARTY_MEMBER_COLS = {
  id: users.id,
  username: users.username,
  firstName: users.firstName,
  lastName: users.lastName,
  profileImageUrl: users.profileImageUrl,
  reputation: users.reputation,
};

export class PartyService {
  async createParty(leaderId: string, name: string, maxSize = 4, isPrivate = true): Promise<PartyWithMembers> {
    const inviteCode = this.generateCode();

    const [party] = await db.insert(parties).values({
      name,
      leaderId,
      inviteCode,
      maxSize,
      isPrivate,
      status: "waiting",
    }).returning();

    await db.insert(partyMembers).values({
      partyId: party.id,
      userId: leaderId,
      role: "leader",
      isReady: false,
    });

    return this.getParty(party.id) as Promise<PartyWithMembers>;
  }

  async getParty(partyId: string): Promise<PartyWithMembers | null> {
    const [party] = await db.select().from(parties).where(eq(parties.id, partyId));
    if (!party) return null;

    const members = await db
      .select({
        id: partyMembers.id,
        partyId: partyMembers.partyId,
        userId: partyMembers.userId,
        role: partyMembers.role,
        isReady: partyMembers.isReady,
        joinedAt: partyMembers.joinedAt,
        user: PARTY_MEMBER_COLS,
      })
      .from(partyMembers)
      .innerJoin(users, eq(partyMembers.userId, users.id))
      .where(eq(partyMembers.partyId, partyId))
      .orderBy(partyMembers.joinedAt);

    const messages = await db
      .select({
        id: partyMessages.id,
        partyId: partyMessages.partyId,
        authorId: partyMessages.authorId,
        content: partyMessages.content,
        createdAt: partyMessages.createdAt,
        author: {
          id: users.id,
          username: users.username,
          firstName: users.firstName,
          profileImageUrl: users.profileImageUrl,
        },
      })
      .from(partyMessages)
      .innerJoin(users, eq(partyMessages.authorId, users.id))
      .where(eq(partyMessages.partyId, partyId))
      .orderBy(desc(partyMessages.createdAt))
      .limit(50);

    return { ...party, members: members as any, messages: messages.reverse() as any };
  }

  async getPartyByCode(inviteCode: string): Promise<Party | null> {
    const [party] = await db.select().from(parties).where(eq(parties.inviteCode, inviteCode));
    return party ?? null;
  }

  async getUserParty(userId: string): Promise<PartyWithMembers | null> {
    const [membership] = await db
      .select({ partyId: partyMembers.partyId })
      .from(partyMembers)
      .where(eq(partyMembers.userId, userId));

    if (!membership) return null;
    return this.getParty(membership.partyId);
  }

  async joinParty(partyId: string, userId: string): Promise<PartyWithMembers> {
    const party = await this.getParty(partyId);
    if (!party) throw new Error("Party not found");
    if (party.status === "disbanded") throw new Error("Party has been disbanded");
    if (party.members.length >= party.maxSize) throw new Error("Party is full");

    const alreadyIn = party.members.some((m: any) => m.userId === userId);
    if (alreadyIn) return party;

    await db.insert(partyMembers).values({
      partyId,
      userId,
      role: "member",
      isReady: false,
    });

    const joiner = await db.select({ firstName: users.firstName, username: users.username }).from(users).where(eq(users.id, userId));
    const joinerName = joiner[0]?.username ?? joiner[0]?.firstName ?? "A player";

    for (const m of party.members) {
      if ((m as any).userId !== userId) {
        pushNotification((m as any).userId, {
          type: "challenge",
          title: "Party Update",
          body: `${joinerName} joined the party!`,
          linkTo: `/party/${partyId}`,
        });
      }
    }

    return this.getParty(partyId) as Promise<PartyWithMembers>;
  }

  async leaveParty(partyId: string, userId: string): Promise<{ disbanded: boolean }> {
    const party = await this.getParty(partyId);
    if (!party) return { disbanded: false };

    await db.delete(partyMembers)
      .where(and(eq(partyMembers.partyId, partyId), eq(partyMembers.userId, userId)));

    const remaining = await db.select().from(partyMembers).where(eq(partyMembers.partyId, partyId));

    if (remaining.length === 0) {
      await db.update(parties).set({ status: "disbanded" }).where(eq(parties.id, partyId));
      return { disbanded: true };
    }

    if (party.leaderId === userId && remaining.length > 0) {
      const newLeader = remaining[0];
      await db.update(parties).set({ leaderId: newLeader.userId }).where(eq(parties.id, partyId));
      await db.update(partyMembers).set({ role: "leader" }).where(
        and(eq(partyMembers.partyId, partyId), eq(partyMembers.userId, newLeader.userId))
      );
      pushNotification(newLeader.userId, {
        type: "challenge",
        title: "You're now the party leader!",
        body: "The previous leader left.",
        linkTo: `/party/${partyId}`,
      });
    }

    return { disbanded: false };
  }

  async kickMember(partyId: string, leaderId: string, targetUserId: string): Promise<void> {
    const [party] = await db.select().from(parties).where(eq(parties.id, partyId));
    if (!party || party.leaderId !== leaderId) throw new Error("Only the leader can kick members");
    if (targetUserId === leaderId) throw new Error("Cannot kick yourself");

    await db.delete(partyMembers).where(
      and(eq(partyMembers.partyId, partyId), eq(partyMembers.userId, targetUserId))
    );

    pushNotification(targetUserId, {
      type: "challenge",
      title: "Removed from party",
      body: "You were removed from the party by the leader.",
    });
  }

  async setReady(partyId: string, userId: string, isReady: boolean): Promise<void> {
    await db.update(partyMembers)
      .set({ isReady })
      .where(and(eq(partyMembers.partyId, partyId), eq(partyMembers.userId, userId)));
  }

  async setGame(partyId: string, leaderId: string, gameType: string, betAmount: string): Promise<void> {
    const [party] = await db.select().from(parties).where(eq(parties.id, partyId));
    if (!party || party.leaderId !== leaderId) throw new Error("Only leader can select games");

    await db.update(parties).set({ gameType, betAmount }).where(eq(parties.id, partyId));

    const members = await db.select({ userId: partyMembers.userId }).from(partyMembers).where(eq(partyMembers.partyId, partyId));
    for (const m of members) {
      if (m.userId !== leaderId) {
        pushNotification(m.userId, {
          type: "challenge",
          title: "Game selected!",
          body: `Leader picked ${gameType.replace(/-/g, " ")}. Ready up to play!`,
          linkTo: `/party/${partyId}`,
        });
      }
    }
  }

  async sendMessage(partyId: string, authorId: string, content: string): Promise<PartyMessage> {
    const [msg] = await db.insert(partyMessages).values({ partyId, authorId, content }).returning();
    return msg;
  }

  async updateStatus(partyId: string, status: string): Promise<void> {
    await db.update(parties).set({ status }).where(eq(parties.id, partyId));
  }

  private generateCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }
}

export const partyService = new PartyService();
export type { PartyMessage };
