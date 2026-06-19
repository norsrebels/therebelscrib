import { createServerFn } from "@tanstack/react-start";
import { db } from "../../db/index.js";
import { siteSettings } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { withRetry } from "@/lib/db-retry";
import { getAdminUser } from "@/lib/auth-server";

const DEFAULT_SYSTEM_PROMPT = `You are a helpful assistant for the Rebels Volleyball team. You can answer questions about our players, their positions, skill levels, and the team in general. Be friendly, concise, and enthusiastic about volleyball!`;

export const getChatbotConfig = createServerFn({ method: "GET" }).handler(
  async () => {
    return withRetry(async () => {
      const [promptRow, faqsRow] = await Promise.all([
        db
          .select()
          .from(siteSettings)
          .where(eq(siteSettings.key, "chatbot_system_prompt")),
        db
          .select()
          .from(siteSettings)
          .where(eq(siteSettings.key, "chatbot_faqs")),
      ]);

      const systemPrompt =
        promptRow[0]?.value || DEFAULT_SYSTEM_PROMPT;

      let faqs: { question: string; answer: string }[] = [];
      try {
        faqs = faqsRow[0]?.value ? JSON.parse(faqsRow[0].value) : [];
      } catch {
        faqs = [];
      }

      return { systemPrompt, faqs, defaultSystemPrompt: DEFAULT_SYSTEM_PROMPT };
    });
  },
);

export const saveChatbotConfig = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      systemPrompt: string;
      faqs: { question: string; answer: string }[];
    }) => data,
  )
  .handler(async ({ data }) => {
    const admin = await getAdminUser();
    if (!admin) throw new Error("Unauthorized");

    return withRetry(async () => {
      await db
        .insert(siteSettings)
        .values({ key: "chatbot_system_prompt", value: data.systemPrompt })
        .onConflictDoUpdate({
          target: siteSettings.key,
          set: { value: data.systemPrompt, updatedAt: new Date() },
        });

      await db
        .insert(siteSettings)
        .values({
          key: "chatbot_faqs",
          value: JSON.stringify(data.faqs),
        })
        .onConflictDoUpdate({
          target: siteSettings.key,
          set: { value: JSON.stringify(data.faqs), updatedAt: new Date() },
        });

      return { success: true };
    });
  });
