import { db } from "./db";
import { achievements } from "@shared/schema";
import { achievementDefinitions } from "@shared/achievementDefinitions";
import { eq } from "drizzle-orm";

export async function seedAchievements() {
  console.log("Seeding achievements...");
  
  for (const achievement of achievementDefinitions) {
    try {
      // Check if achievement already exists
      const existing = await db
        .select()
        .from(achievements)
        .where(eq(achievements.id, achievement.id))
        .limit(1);
      
      if (existing.length === 0) {
        // Insert new achievement
        await db.insert(achievements).values(achievement);
        console.log(`✓ Added achievement: ${achievement.name}`);
      } else {
        // Update existing achievement
        await db
          .update(achievements)
          .set(achievement)
          .where(eq(achievements.id, achievement.id));
        console.log(`↻ Updated achievement: ${achievement.name}`);
      }
    } catch (error) {
      console.error(`✗ Error seeding achievement ${achievement.id}:`, error);
    }
  }
  
  console.log("Achievement seeding complete!");
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedAchievements()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Error seeding achievements:", error);
      process.exit(1);
    });
}
