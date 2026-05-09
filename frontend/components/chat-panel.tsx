"use client";

import { useState, useRef } from "react";
import { Send, Loader2, MessageSquare } from "lucide-react";
import { apiFetch } from "@/lib/api";

type Message = { role: "user" | "agent"; text: string };

export default function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function handleAsk() {
    const q = question.trim();
    if (!q || isStreaming) return;
    setQuestion("");
    setMessages((prev) => [...prev, { role: "user", text: q }]);
    setIsStreaming(true);

    try {
      const res = await apiFetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });

      if (!res.ok || !res.body) {
        setMessages((prev) => [...prev, { role: "agent", text: "Sorry, I couldn't get an answer right now." }]);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      setMessages((prev) => [...prev, { role: "agent", text: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "agent", text: accumulated };
          return updated;
        });
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    } catch {
      setMessages((prev) => [...prev, { role: "agent", text: "Sorry, I couldn't get an answer right now." }]);
    } finally {
      setIsStreaming(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  return (
    <div className="flex flex-col rounded-xl border overflow-hidden"
      style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)", height: "100%", minHeight: 480 }}>

      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center gap-2 shrink-0" style={{ borderColor: "var(--border)" }}>
        <span className="text-blue-400">✦</span>
        <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>Ask the Agent</span>
        <MessageSquare size={13} style={{ color: "var(--muted)" }} className="ml-auto" />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3 min-h-0">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 opacity-40">
            <span className="text-2xl text-blue-400">✦</span>
            <p className="text-xs text-center" style={{ color: "var(--muted)" }}>
              Ask about your floor,<br />failures, bottlenecks, or targets.
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex flex-col gap-0.5 ${msg.role === "user" ? "items-end" : "items-start"}`}>
            <span className="text-[10px] font-semibold uppercase tracking-wide"
              style={{ color: msg.role === "user" ? "#7a7870" : "#60a5fa" }}>
              {msg.role === "user" ? "You" : "Agent"}
            </span>
            <div className={`rounded-xl px-3 py-2 text-sm leading-relaxed max-w-[90%] whitespace-pre-wrap ${
              msg.role === "user"
                ? "bg-blue-600/20 text-blue-100"
                : "bg-white/5 text-gray-200"
            }`}>
              {msg.text || (isStreaming && i === messages.length - 1 ? (
                <Loader2 size={12} className="animate-spin text-blue-400" />
              ) : "")}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 pb-3 pt-2 border-t shrink-0 flex gap-2" style={{ borderColor: "var(--border)" }}>
        <input
          ref={inputRef}
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAsk()}
          placeholder="What's causing the most failures?"
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 outline-none focus:border-blue-500/50 transition-colors"
          disabled={isStreaming}
        />
        <button
          onClick={handleAsk}
          disabled={isStreaming || !question.trim()}
          className="bg-blue-500 hover:bg-blue-400 text-white px-3 py-2 rounded-lg text-sm transition-colors disabled:opacity-40 flex items-center gap-1.5"
        >
          {isStreaming ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
        </button>
      </div>
    </div>
  );
}
