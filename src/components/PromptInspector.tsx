"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useMemo, useState } from "react";
import { Header } from "./AgentLoop";
import { Send, RotateCcw } from "lucide-react";

type Block = {
  id: string;
  label: string;
  source: string;
  color: string;
  body: string;
};

const baseBlocks = (userMsg: string): Block[] => [
  {
    id: "system",
    label: "system prompt",
    source: "vendor (Anthropic / OpenAI)",
    color: "#a78bfa",
    body:
      "You are an interactive coding agent. Use the tools provided. Be concise. Never run destructive commands without confirmation. Today's date is 2026-05-03.",
  },
  {
    id: "agents",
    label: "AGENTS.md / CLAUDE.md",
    source: "project rules · auto-loaded",
    color: "#22d3ee",
    body:
      "# Project conventions\n- Use TypeScript strict mode.\n- Prefer functional components.\n- All tests run with vitest. Don't mock the database — use a real test instance.\n- Ship Tailwind utility classes; no styled-components.",
  },
  {
    id: "tools",
    label: "tool schemas",
    source: "harness · JSON schema",
    color: "#34d399",
    body:
      "[Read, Edit, Write, Bash, Grep, Glob, WebFetch, TaskCreate, …]\nEach tool: name, description, JSON schema for params, return shape.",
  },
  {
    id: "env",
    label: "environment",
    source: "runtime context",
    color: "#fbbf24",
    body:
      "cwd: ~/Documents/Github/how-agents-work\nbranch: main · clean working tree\nplatform: linux · node 20.20.2",
  },
  {
    id: "history",
    label: "conversation history",
    source: "previous turns",
    color: "#f472b6",
    body:
      "[turn 1] user: build the visualizer\n[turn 1] assistant: → Edit src/Hero.tsx\n[turn 1] tool_result: ok",
  },
  {
    id: "user",
    label: "user message",
    source: "your input",
    color: "#60a5fa",
    body: userMsg || "(your prompt goes here)",
  },
];

function tokens(s: string) {
  return Math.max(1, Math.ceil(s.length / 4));
}

export default function PromptInspector() {
  const [msg, setMsg] = useState("Add a dark mode toggle to the header.");
  const [submitted, setSubmitted] = useState(false);
  const [enabled, setEnabled] = useState<Record<string, boolean>>({
    system: true,
    agents: true,
    tools: true,
    env: true,
    history: true,
    user: true,
  });

  const blocks = useMemo(() => baseBlocks(msg), [msg]);
  const total = useMemo(
    () =>
      blocks
        .filter((b) => enabled[b.id])
        .reduce((acc, b) => acc + tokens(b.body) + tokens(b.label) + 4, 0),
    [blocks, enabled],
  );

  return (
    <section
      id="inspector"
      className="relative w-full px-6 py-24 flex flex-col items-center"
    >
      <div className="max-w-6xl w-full">
        <Header
          eyebrow="02 · the inspector"
          title="What the model actually sees"
          subtitle="Type a prompt. Watch the harness assemble the real input — every system rule, every tool schema, every prior turn — and count the tokens by source."
        />

        <div className="grid lg:grid-cols-[1fr_1.2fr] gap-8">
          <div className="glass rounded-3xl p-6 flex flex-col gap-4">
            <label className="mono text-xs text-white/50">
              your prompt
            </label>
            <textarea
              value={msg}
              onChange={(e) => {
                setMsg(e.target.value);
                setSubmitted(false);
              }}
              rows={4}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30 resize-none"
              placeholder="Ask the agent to do something…"
            />
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => setSubmitted(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white text-black text-sm font-medium hover:bg-white/90 transition"
              >
                <Send size={14} />
                Assemble prompt
              </button>
              <button
                onClick={() => {
                  setMsg("");
                  setSubmitted(false);
                }}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-full glass text-xs hover:bg-white/10 transition"
              >
                <RotateCcw size={13} />
                clear
              </button>
            </div>

            <div className="border-t border-white/5 pt-4">
              <div className="mono text-xs text-white/50 mb-2">
                toggle context sources
              </div>
              <div className="flex flex-wrap gap-2">
                {blocks.map((b) => (
                  <button
                    key={b.id}
                    onClick={() =>
                      setEnabled((e) => ({ ...e, [b.id]: !e[b.id] }))
                    }
                    className="token-pill transition"
                    style={{
                      background: enabled[b.id] ? `${b.color}1f` : "transparent",
                      borderColor: enabled[b.id] ? `${b.color}88` : "rgba(255,255,255,0.1)",
                      color: enabled[b.id] ? b.color : "rgba(255,255,255,0.45)",
                      opacity: enabled[b.id] ? 1 : 0.55,
                    }}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: b.color }}
                    />
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-white/5 pt-4 mono text-xs">
              <div className="flex items-center justify-between text-white/60">
                <span>total tokens (approx)</span>
                <motion.span
                  key={total}
                  initial={{ scale: 1.15, color: "#a78bfa" }}
                  animate={{ scale: 1, color: "#ffffff" }}
                  transition={{ duration: 0.4 }}
                  className="text-base font-semibold"
                >
                  {total.toLocaleString()}
                </motion.span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-white/5 overflow-hidden flex">
                {blocks
                  .filter((b) => enabled[b.id])
                  .map((b) => {
                    const t = tokens(b.body) + tokens(b.label) + 4;
                    const pct = (t / total) * 100;
                    return (
                      <motion.div
                        key={b.id}
                        layout
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.4 }}
                        style={{ background: b.color }}
                      />
                    );
                  })}
              </div>
            </div>
          </div>

          <div className="glass rounded-3xl p-6 max-h-[640px] overflow-y-auto">
            <div className="mono text-xs text-white/50 mb-3 flex items-center justify-between">
              <span>assembled prompt · sent to model</span>
              <AnimatePresence>
                {submitted && (
                  <motion.span
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-emerald-400 flex items-center gap-1"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    streaming…
                  </motion.span>
                )}
              </AnimatePresence>
            </div>

            <div className="space-y-3">
              {blocks
                .filter((b) => enabled[b.id])
                .map((b, i) => (
                  <motion.div
                    key={b.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: submitted ? i * 0.08 : 0 }}
                    className="rounded-xl border bg-black/30"
                    style={{ borderColor: `${b.color}33` }}
                  >
                    <div
                      className="flex items-center justify-between px-4 py-2 border-b mono text-[11px]"
                      style={{
                        borderColor: `${b.color}22`,
                        background: `${b.color}0c`,
                      }}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: b.color }}
                        />
                        <span style={{ color: b.color }}>{b.label}</span>
                        <span className="text-white/30">·</span>
                        <span className="text-white/45">{b.source}</span>
                      </span>
                      <span className="text-white/45">
                        ~{tokens(b.body)} tok
                      </span>
                    </div>
                    <pre className="px-4 py-3 mono text-[12px] leading-relaxed text-white/80 whitespace-pre-wrap">
                      {b.body}
                    </pre>
                  </motion.div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
