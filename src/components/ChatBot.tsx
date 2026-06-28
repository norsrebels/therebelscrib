import { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, Trash2, Sparkles } from "lucide-react";
import { useLocation } from "@tanstack/react-router";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

// --- Wolf mascot SVG: geometric wolf head on a volleyball disc, themed to the
// app accent (uses currentColor-friendly accent tokens, not hardcoded cyan). ---
function WolfMascot({ className = "w-12 h-12", glowing = false }: { className?: string; glowing?: boolean }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      {glowing && (
        <circle cx="50" cy="50" r="46" stroke="rgb(var(--accent-500))" strokeWidth="1.5"
          strokeDasharray="4 4" className="animate-spin opacity-40" style={{ animationDuration: "20s" }} />
      )}
      <circle cx="50" cy="50" r="41" fill="rgb(var(--surface))" stroke="rgb(var(--accent-500))" strokeWidth="1.5" />
      {/* volleyball seams */}
      <path d="M22 36C35 45 42 30 50 10" stroke="rgb(var(--accent-500))" strokeWidth="0.75" strokeDasharray="1 2" className="opacity-50" />
      <path d="M78 36C65 45 58 30 50 10" stroke="rgb(var(--accent-500))" strokeWidth="0.75" strokeDasharray="1 2" className="opacity-50" />
      <path d="M50 90C50 70 30 65 22 36" stroke="rgb(var(--accent-500))" strokeWidth="0.75" strokeDasharray="1 2" className="opacity-50" />
      <path d="M50 90C50 70 70 65 78 36" stroke="rgb(var(--accent-500))" strokeWidth="0.75" strokeDasharray="1 2" className="opacity-50" />
      {/* ears */}
      <polygon points="25,25 42,40 32,48" fill="rgb(var(--surface-hover))" stroke="rgb(var(--accent-500))" strokeWidth="1" />
      <polygon points="75,25 58,40 68,48" fill="rgb(var(--surface-hover))" stroke="rgb(var(--accent-500))" strokeWidth="1" />
      {/* jaw / cheeks */}
      <polygon points="18,52 35,48 50,30" fill="rgb(var(--border))" stroke="rgb(var(--border-soft))" strokeWidth="1" />
      <polygon points="82,52 65,48 50,30" fill="rgb(var(--border))" stroke="rgb(var(--border-soft))" strokeWidth="1" />
      <polygon points="18,52 38,64 50,55" fill="rgb(var(--surface-hover))" stroke="rgb(var(--accent-500))" strokeWidth="1" />
      <polygon points="82,52 62,64 50,55" fill="rgb(var(--surface-hover))" stroke="rgb(var(--accent-500))" strokeWidth="1" />
      {/* snout */}
      <polygon points="50,30 38,55 50,75" fill="rgb(var(--muted-fg))" className="opacity-60" />
      <polygon points="50,30 62,55 50,75" fill="rgb(var(--border))" />
      {/* eyes */}
      <polygon points="35,50 43,51 38,54" fill="rgb(var(--accent-500))" className={glowing ? "animate-pulse" : ""} />
      <polygon points="65,50 57,51 62,54" fill="rgb(var(--accent-500))" className={glowing ? "animate-pulse" : ""} />
      {/* fangs */}
      <polygon points="44,75 46,78 47,75" fill="#FFFFFF" />
      <polygon points="56,75 54,78 53,75" fill="#FFFFFF" />
      {/* nose */}
      <polygon points="46,75 54,75 50,81" fill="rgb(var(--fg))" stroke="rgb(var(--accent-500))" strokeWidth="1" />
    </svg>
  );
}

// Render **bold** segments inline without a markdown lib.
function renderBold(text: string) {
  return text.split("**").map((chunk, i) =>
    i % 2 === 1 ? <strong key={i} className="font-bold text-[rgb(var(--accent-500))]">{chunk}</strong> : chunk
  );
}

// Context-aware prompt chips per route
const PROMPT_CHIPS: Record<string, string[]> = {
  "/":              ["How do I use the app?", "How do I join?", "How do I install the app?"],
  "/leaderboard":   ["How does the leaderboard work?", "Why pick a schedule first?", "What do the position codes mean?"],
  "/vis-stats":     ["What's a good pass rating target?", "How is attack efficiency calculated?", "What does BHE mean?"],
  "/player-dex":    ["Who plays as Libero?", "How are players linked to accounts?", "Show me the setters"],
  "/tournaments":   ["How do tournaments work?", "What are community tags?", "How does live scoring work?"],
  "/gallery":       ["How do I react to photos?", "How do I view a photo larger?"],
  "/social":        ["Where can I follow the Rebels?"],
};

function getChips(pathname: string): string[] {
  for (const [route, chips] of Object.entries(PROMPT_CHIPS)) {
    if (pathname === route || (route !== "/" && pathname.startsWith(route))) {
      return chips;
    }
  }
  return ["How do I use the app?", "How do I join?", "Tell me about the Rebels"];
}

export function ChatBot() {
  const location = useLocation();
  const chips = getChips(location.pathname);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(0);
  const [showBubbleHint, setShowBubbleHint] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  useEffect(() => {
    if (open) {
      setUnread(0);
      setShowBubbleHint(false);
      textareaRef.current?.focus();
    }
  }, [open]);

  const resizeTextarea = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  };

  const sendText = async (text: string) => {
    if (!text.trim() || sending) return;
    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      if (!res.ok) throw new Error("Request failed");
      const data = await res.json();
      const botMsg: Message = { id: `a-${Date.now()}`, role: "assistant", content: data.reply };
      setMessages((prev) => [...prev, botMsg]);
      if (!open) setUnread((prev) => prev + 1);
    } catch {
      setMessages((prev) => [...prev, {
        id: `e-${Date.now()}`, role: "assistant",
        content: "Sorry, the howl didn't reach the den. Please try again.",
      }]);
    } finally {
      setSending(false);
    }
  };

  const handleSend = () => sendText(input);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    setMessages([]);
    setUnread(0);
  };

  return (
    <>
      {/* Chat Window */}
      {open && (
        <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 w-[calc(100%-2rem)] md:w-96 max-h-[70vh] md:max-h-[32rem] bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl shadow-2xl z-[100] flex flex-col chatbot-slide-up overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[rgb(var(--border-soft))] shrink-0 bg-gradient-to-r from-[rgb(var(--accent-500))]/10 to-transparent">
            <div className="flex items-center gap-2.5">
              <div className="relative p-0.5 rounded-full bg-[rgb(var(--surface-hover))] border border-[rgb(var(--accent-500))]/40">
                <WolfMascot className="w-8 h-8" glowing />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-[rgb(var(--surface))]" />
              </div>
              <div>
                <span className="block font-bold text-sm text-[rgb(var(--fg))] leading-tight">Rebels Court Guide</span>
                <span className="block text-[10px] text-[rgb(var(--muted-fg))]">Your in-app help • Awooo!</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button onClick={handleClear}
                  className="p-1.5 rounded-lg text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))] hover:bg-[rgb(var(--surface-hover))] transition-colors"
                  title="Clear chat">
                  <Trash2 size={16} />
                </button>
              )}
              <button onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))] hover:bg-[rgb(var(--surface-hover))] transition-colors">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
            {messages.length === 0 && (
              <div className="py-6">
                <div className="text-center text-[rgb(var(--muted-fg))] text-sm mb-5">
                  <WolfMascot className="w-16 h-16 mx-auto mb-3" glowing />
                  <p className="font-semibold text-[rgb(var(--fg))]">Awooo! I'm your help guide 🏐</p>
                  <p className="text-xs mt-1 opacity-70">Ask me how anything in the app works</p>
                </div>
                <div className="flex flex-col gap-2 px-1">
                  {chips.map((chip) => (
                    <button key={chip} onClick={() => sendText(chip)}
                      className="text-left text-xs px-3 py-2 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))] hover:border-[rgb(var(--accent-500))]/40 hover:bg-[rgb(var(--accent-500))]/5 transition-all flex items-center gap-2">
                      <Sparkles size={12} className="text-[rgb(var(--accent-500))] shrink-0" />
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className={`flex items-end gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <div className="shrink-0 mb-0.5"><WolfMascot className="w-6 h-6" /></div>
                )}
                <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white rounded-br-md"
                    : "bg-[rgb(var(--bg))] text-[rgb(var(--fg))] border border-[rgb(var(--border-soft))] rounded-bl-md"
                }`}>
                  {msg.role === "assistant" ? renderBold(msg.content) : msg.content}
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex items-end gap-2 justify-start">
                <div className="shrink-0 mb-0.5 animate-bounce"><WolfMascot className="w-6 h-6" /></div>
                <div className="bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1.5">
                    <span className="typing-dot" />
                    <span className="typing-dot" style={{ animationDelay: "0.2s" }} />
                    <span className="typing-dot" style={{ animationDelay: "0.4s" }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t border-[rgb(var(--border-soft))] shrink-0">
            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => { setInput(e.target.value); resizeTextarea(); }}
                onKeyDown={handleKeyDown}
                placeholder="Type your question..."
                rows={1}
                className="flex-1 bg-[rgb(var(--bg))] border border-[rgb(var(--border))] rounded-xl px-3 py-2 text-sm resize-none outline-none focus:border-blue-500 text-[rgb(var(--fg))] placeholder:text-[rgb(var(--muted-fg))]"
              />
              <button onClick={handleSend} disabled={!input.trim() || sending}
                className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0">
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating bubble + hint */}
      {!open && (
        <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-[99] flex flex-col items-end gap-2">
          {showBubbleHint && messages.length === 0 && (
            <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--accent-500))]/40 text-[rgb(var(--fg))] text-[11px] px-3 py-1.5 rounded-xl shadow-lg flex items-center gap-2 chatbot-slide-up">
              <span className="w-2 h-2 rounded-full bg-[rgb(var(--accent-500))] animate-pulse" />
              <span>Awooo! Need help using the app?</span>
              <button onClick={(e) => { e.stopPropagation(); setShowBubbleHint(false); }}
                className="text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))]">
                <X size={12} />
              </button>
            </div>
          )}
          <button onClick={() => setOpen(true)}
            className="relative w-16 h-16 rounded-full shadow-lg hover:scale-105 active:scale-95 transition-transform flex items-center justify-center bg-[rgb(var(--surface))] border-2 border-[rgb(var(--accent-500))]"
            title="Talk with the Rebels help guide">
            <WolfMascot className="w-14 h-14" glowing />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-[rgb(var(--surface))]">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>
        </div>
      )}
    </>
  );
}
