import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send, Trash2 } from "lucide-react";
import { useLocation } from "@tanstack/react-router";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

// Context-aware prompt chips per route
const PROMPT_CHIPS: Record<string, string[]> = {
  "/":              ["What's the latest announcement?", "Who are the Rebels?", "When is the next tournament?"],
  "/leaderboard":   ["Who leads in attack efficiency?", "Who has the most aces?", "Best pass efficiency this season?"],
  "/vis-stats":     ["What's a good pass rating target?", "How is attack efficiency calculated?", "What does BHE mean?"],
  "/player-dex":    ["Who plays as Libero?", "Who is the team captain?", "Show me the setters"],
  "/tournaments":   ["What is the current standings?", "How does the bracket work?", "When is the next match?"],
  "/gallery":       ["What events are shown here?", "How do I upload a photo?"],
  "/social":        ["Where can I follow the Rebels?"],
}

function getChips(pathname: string): string[] {
  for (const [route, chips] of Object.entries(PROMPT_CHIPS)) {
    if (pathname === route || (route !== "/" && pathname.startsWith(route))) {
      return chips
    }
  }
  return ["Tell me about the Rebels", "When is the next game?", "Who are the top players?"]
}

export function ChatBot() {
  const location = useLocation();
  const chips = getChips(location.pathname);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (open) {
      setUnread(0);
      textareaRef.current?.focus();
    }
  }, [open]);

  const resizeTextarea = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    const history = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });

      if (!res.ok) throw new Error("Request failed");

      const data = await res.json();
      const botMsg: Message = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: data.reply,
      };

      setMessages((prev) => [...prev, botMsg]);

      if (!open) {
        setUnread((prev) => prev + 1);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
        },
      ]);
    } finally {
      setSending(false);
    }
  };

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
          <div className="flex items-center justify-between px-4 py-3 border-b border-[rgb(var(--border-soft))] shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="font-semibold text-sm text-[rgb(var(--fg))]">
                Rebels Assistant
              </span>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={handleClear}
                  className="p-1.5 rounded-lg text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))] hover:bg-[rgb(var(--surface-hover))] transition-colors"
                  title="Clear chat"
                >
                  <Trash2 size={16} />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))] hover:bg-[rgb(var(--surface-hover))] transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
            {messages.length === 0 && (
              <div className="py-6">
                <div className="text-center text-[rgb(var(--muted-fg))] text-sm mb-5">
                  <MessageCircle size={32} className="mx-auto mb-3 opacity-40" />
                  <p className="font-medium">Ask me anything about the Rebels!</p>
                  <p className="text-xs mt-1 opacity-70">Players, positions, schedules, and more</p>
                </div>
                {/* Context-aware prompt chips */}
                <div className="flex flex-col gap-2 px-1">
                  {chips.map((chip) => (
                    <button
                      key={chip}
                      onClick={() => {
                        setInput(chip);
                        setTimeout(() => textareaRef.current?.focus(), 0);
                      }}
                      className="text-left text-xs px-3 py-2 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))] hover:border-blue-500/40 hover:bg-blue-500/5 transition-all"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white rounded-br-md"
                      : "bg-[rgb(var(--bg))] text-[rgb(var(--fg))] border border-[rgb(var(--border-soft))] rounded-bl-md"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex justify-start">
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
                onChange={(e) => {
                  setInput(e.target.value);
                  resizeTextarea();
                }}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                rows={1}
                className="flex-1 bg-[rgb(var(--bg))] border border-[rgb(var(--border))] rounded-xl px-3 py-2 text-sm resize-none outline-none focus:border-blue-500 text-[rgb(var(--fg))] placeholder:text-[rgb(var(--muted-fg))]"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || sending}
                className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Bubble */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-20 md:bottom-6 right-4 md:right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 hover:shadow-xl transition-all z-[99] flex items-center justify-center"
        style={{ display: open ? "none" : "flex" }}
      >
        <MessageCircle size={24} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
    </>
  );
}
