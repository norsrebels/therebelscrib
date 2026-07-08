import { createFileRoute } from "@tanstack/react-router";
import { DEFAULT_SYSTEM_PROMPT } from "@/server/chatbot.functions";
import { db } from "../../db/index.js";
import { siteSettings, players } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { withRetry, jsonResponse, errorResponse } from "@/lib/db-retry";

// Calls Gemini via raw fetch — no SDK, no bundling concerns, works in any runtime.
async function callGemini(systemInstruction: string, messages: { role: string; content: string }[]): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set in the environment");

  // Model is configurable via env so a future Google rename never strands us again.
  // Default is a current stable Flash model (gemini-1.5-* was retired and returns 404).
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

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
    // Surface the model + status so the real cause (404 retired model, 403 bad key,
    // 429 quota) is visible in logs instead of a generic failure.
    throw new Error(`Gemini API error ${res.status} for model "${model}": ${err}`);
  }

  const data = await res.json() as any;
  // A blocked/empty response has no candidate text — return a clear signal, not "".
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    const blockReason = data?.promptFeedback?.blockReason;
    throw new Error(blockReason ? `Gemini blocked the response: ${blockReason}` : "Gemini returned an empty response");
  }
  return text;
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
          const detail = err?.message ?? String(err);
          console.error("Chat API error:", detail);
          // Include the detail in the response so an admin can see the real cause
          // (retired model, bad key, quota) instead of a generic failure.
          return errorResponse(`Failed to generate response: ${detail}`, 500);
        }
      },
    },
  },
});
