import { createFileRoute } from "@tanstack/react-router";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { DEFAULT_SYSTEM_PROMPT } from "@/server/chatbot.functions";
import { db } from "../../db/index.js";
import { siteSettings, players } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { withRetry, jsonResponse, errorResponse } from "@/lib/db-retry";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            messages: { role: "user" | "assistant"; content: string }[];
          };

          if (
            !body.messages ||
            !Array.isArray(body.messages) ||
            body.messages.length === 0
          ) {
            return errorResponse("Messages array is required", 400);
          }

          const lastMessage = body.messages[body.messages.length - 1];
          if (lastMessage.role !== "user" || !lastMessage.content.trim()) {
            return errorResponse("Last message must be a non-empty user message", 400);
          }

          const [promptRow, faqsRow, roster] = await withRetry(() =>
            Promise.all([
              db
                .select()
                .from(siteSettings)
                .where(eq(siteSettings.key, "chatbot_system_prompt")),
              db
                .select()
                .from(siteSettings)
                .where(eq(siteSettings.key, "chatbot_faqs")),
              db.select().from(players),
            ]),
          );

          const customPrompt = promptRow[0]?.value || DEFAULT_SYSTEM_PROMPT;

          let faqs: { question: string; answer: string }[] = [];
          try {
            faqs = faqsRow[0]?.value ? JSON.parse(faqsRow[0].value) : [];
          } catch {
            faqs = [];
          }

          let systemContent = customPrompt;

          if (faqs.length > 0) {
            systemContent += "\n\n## Frequently Asked Questions\nWhen a user asks one of these questions, use the provided answer:\n";
            for (const faq of faqs) {
              systemContent += `\nQ: ${faq.question}\nA: ${faq.answer}\n`;
            }
          }

          if (roster.length > 0) {
            systemContent += "\n\n## Current Player Roster\n";
            for (const p of roster) {
              const parts = [`${p.nickname}`];
              if (p.position) parts.push(`Position: ${p.position}`);
              if (p.playerLevel) parts.push(`Level: ${p.playerLevel}`);
              systemContent += `- ${parts.join(" | ")}\n`;
            }
          }

          const apiKey = process.env.GEMINI_API_KEY;
          if (!apiKey) {
            console.error("Chat API error: GEMINI_API_KEY is not set");
            return errorResponse("Chatbot is not configured", 500);
          }

          const genAI = new GoogleGenerativeAI(apiKey);
          const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            systemInstruction: systemContent,
          });

          // Gemini uses "model" for the assistant role. The final user turn is sent
          // via sendMessage; everything before it becomes the chat history.
          const history = body.messages.slice(0, -1).map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          }));

          const chat = model.startChat({
            history,
            generationConfig: { maxOutputTokens: 1024 },
          });

          const result = await chat.sendMessage(lastMessage.content);
          const text = result.response.text() || "";

          return jsonResponse({ reply: text });
        } catch (err: any) {
          console.error("Chat API error:", err?.message || err);
          return errorResponse("Failed to generate response", 500);
        }
      },
    },
  },
});
