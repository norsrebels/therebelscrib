import { createFileRoute } from "@tanstack/react-router";
import { DEFAULT_SYSTEM_PROMPT } from "@/server/chatbot.functions";
import { db } from "../../db/index.js";
import { siteSettings, players } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { withRetry, jsonResponse, errorResponse } from "@/lib/db-retry";

// Calls Gemini via raw fetch — no SDK, no bundling concerns, works in any runtime.
async function callGemini(systemInstruction: string, messages: { role: string; content: string }[]): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  // Build history: all turns except the last become chat history.
  // Gemini uses "model" for the assistant role.
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const body = {
    system_instruction: { parts: [{ text: systemInstruction }] },
    contents,
    generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${err}`);
  }

  const data = await res.json() as any;
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            messages: { role: "user" | "assistant"; content: string }[];
          };

          if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
            return errorResponse("Messages array is required", 400);
          }

          const lastMessage = body.messages[body.messages.length - 1];
          if (lastMessage.role !== "user" || !lastMessage.content.trim()) {
            return errorResponse("Last message must be a non-empty user message", 400);
          }

          const [promptRow, faqsRow, roster] = await withRetry(() =>
            Promise.all([
              db.select().from(siteSettings).where(eq(siteSettings.key, "chatbot_system_prompt")),
              db.select().from(siteSettings).where(eq(siteSettings.key, "chatbot_faqs")),
              db.select().from(players),
            ]),
          );

          const customPrompt = promptRow[0]?.value || DEFAULT_SYSTEM_PROMPT;

          let faqs: { question: string; answer: string }[] = [];
          try {
            faqs = faqsRow[0]?.value ? JSON.parse(faqsRow[0].value) : [];
          } catch { faqs = []; }

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

          const text = await callGemini(systemContent, body.messages);
          return jsonResponse({ reply: text });

        } catch (err: any) {
          console.error("Chat API error:", err?.message ?? err);
          return errorResponse("Failed to generate response", 500);
        }
      },
    },
  },
});
