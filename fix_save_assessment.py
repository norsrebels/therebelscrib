import re

with open("src/server/assessment.functions.ts", "r") as f:
    content = f.read()

# Update saveAssessment to save into `scores` jsonb column
save_old = """export const saveAssessment = createServerFn({ method: "POST" })
  .validator(
    (d: {
      playerId: number;
      assessment: any;
      overallScore: number;
      playerLevel: string;
    }) => d
  )
  .handler(async ({ data: { playerId, assessment, overallScore, playerLevel } }) => {
    const admin = await getAdminUser();
    if (!admin) throw new Error("Admin access required");

    const existing = await db
      .select()
      .from(assessments)
      .where(eq(assessments.playerId, playerId));

    if (existing.length > 0) {
      await db
        .update(assessments)
        .set({
          ...assessment,
          updatedAt: new Date(),
        })
        .where(eq(assessments.playerId, playerId));
    } else {
      await db.insert(assessments).values({
        playerId,
        ...assessment,
      });
    }"""

save_new = """export const saveAssessment = createServerFn({ method: "POST" })
  .validator(
    (d: {
      playerId: number;
      assessment: any;
      overallScore: number;
      playerLevel: string;
    }) => d
  )
  .handler(async ({ data: { playerId, assessment, overallScore, playerLevel } }) => {
    const admin = await getAdminUser();
    if (!admin) throw new Error("Admin access required");

    const existing = await db
      .select()
      .from(assessments)
      .where(eq(assessments.playerId, playerId));

    if (existing.length > 0) {
      await db
        .update(assessments)
        .set({
          scores: assessment,
          updatedAt: new Date(),
        })
        .where(eq(assessments.playerId, playerId));
    } else {
      await db.insert(assessments).values({
        playerId,
        scores: assessment,
      });
    }"""

content = content.replace(save_old, save_new)

with open("src/server/assessment.functions.ts", "w") as f:
    f.write(content)
