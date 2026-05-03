"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import {
  FileText,
  Wrench,
  CheckCircle,
  Repeat,
  ShieldAlert,
  Play,
  Pause,
} from "lucide-react";

type Step = {
  id: string;
  title: string;
  short: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  details: string[];
};

const steps: Step[] = [
  {
    id: "ctx",
    title: "1. Context Assembly",
    short: "Read AGENTS.md, CLAUDE.md, project files, recent edits.",
    description:
      "The harness gathers everything the model needs to know before it sees your prompt.",
    icon: <FileText size={22} />,
    color: "#a78bfa",
    details: [
      "Loads system prompt (vendor-defined, fixed).",
      "Reads project rules: AGENTS.md, CLAUDE.md, .cursorrules, copilot-instructions.md.",
      "Inlines tool schemas (Read, Edit, Bash, Grep, …) so the model knows what it can call.",
      "Adds environment context: cwd, git status, OS, recent diffs.",
    ],
  },
  {
    id: "intent",
    title: "2. Intent + PreToolUse hook",
    short: "Model picks a tool. Hook intercepts before it runs.",
    description:
      "A user-defined PreToolUse hook can inspect, modify, or block the call.",
    icon: <ShieldAlert size={22} />,
    color: "#fbbf24",
    details: [
      "Model emits a structured tool_use block with arguments.",
      "PreToolUse hook receives JSON on stdin; can deny (exit 2) or allow.",
      "Common policies: block writes to /etc, require approval for git push, redact secrets.",
      "If denied, the message goes back to the model so it can rethink.",
    ],
  },
  {
    id: "exec",
    title: "3. Tool execution",
    short: "Sandboxed side effects: files, shell, network.",
    description:
      "The actual work — and where things diverge across agents.",
    icon: <Wrench size={22} />,
    color: "#22d3ee",
    details: [
      "Tool runs in the harness, not the model. Output is captured.",
      "stdout, stderr, exit code, and any artifact paths are collected.",
      "Errors are returned as a tool_result, not raised — the model handles them.",
    ],
  },
  {
    id: "post",
    title: "4. PostToolUse hook + audit",
    short: "Lint, format, log, react to outcome.",
    description:
      "After the tool runs, hooks observe and the model receives the result.",
    icon: <CheckCircle size={22} />,
    color: "#34d399",
    details: [
      "PostToolUse can run a formatter, type-check, or block-on-failure.",
      "Audit logs capture: what was called, by whom, with what args, what changed.",
      "Tool result is appended to the conversation as a new message.",
    ],
  },
  {
    id: "loop",
    title: "5. Re-prompt the model (loop)",
    short: "Back to the top with new state, until done.",
    description:
      "The agent isn't a single call — it's a tight loop until a stop condition.",
    icon: <Repeat size={22} />,
    color: "#f472b6",
    details: [
      "Updated context (now with tool_result) is sent back to the model.",
      "Loop ends when: model emits a final answer, hits a budget, or is interrupted.",
      "Long sessions trigger compaction: older turns get summarized to free tokens.",
    ],
  },
];

export default function AgentLoop() {
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setActive((p) => (p + 1) % steps.length), 4200);
    return () => clearInterval(id);
  }, [playing]);

  const step = steps[active];

  return (
    <section
      id="loop"
      className="relative min-h-screen w-full px-6 py-24 flex flex-col items-center"
    >
      <div className="max-w-6xl w-full">
        <Header
          eyebrow="01 · the loop"
          title="An agent is a loop, not a call"
          subtitle="Every coding agent — Claude Code, Cursor, Copilot, Aider — runs the same five-step cycle. The interesting differences live in steps 1, 2 and 4."
        />

        <div className="grid lg:grid-cols-[1fr_1.1fr] gap-10 lg:gap-16 items-start">
          <div className="relative">
            <div className="absolute left-[31px] top-4 bottom-4 w-px bg-gradient-to-b from-transparent via-white/15 to-transparent" />
            <div className="space-y-3">
              {steps.map((s, i) => {
                const isActive = i === active;
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      setActive(i);
                      setPlaying(false);
                    }}
                    className="w-full text-left group relative flex items-center gap-5"
                  >
                    <motion.div
                      className="relative h-16 w-16 shrink-0 rounded-2xl flex items-center justify-center border"
                      animate={{
                        scale: isActive ? 1.05 : 1,
                        borderColor: isActive ? s.color : "rgba(255,255,255,0.08)",
                        backgroundColor: isActive
                          ? `${s.color}1f`
                          : "rgba(20,20,28,0.6)",
                      }}
                      transition={{ duration: 0.4 }}
                    >
                      <span style={{ color: isActive ? s.color : "#9ca3af" }}>
                        {s.icon}
                      </span>
                      {isActive && (
                        <motion.span
                          layoutId="loop-ring"
                          className="absolute inset-0 rounded-2xl"
                          style={{
                            boxShadow: `0 0 0 1px ${s.color}, 0 0 30px ${s.color}55`,
                          }}
                        />
                      )}
                    </motion.div>
                    <div
                      className={`flex-1 rounded-xl px-4 py-3 transition border ${
                        isActive
                          ? "border-white/15 bg-white/5"
                          : "border-white/5 bg-white/[0.02] group-hover:bg-white/[0.04]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-base">{s.title}</h3>
                        {isActive && (
                          <span className="mono text-[10px] text-white/50">
                            running…
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-white/55 mt-0.5">{s.short}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={() => setPlaying((p) => !p)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-sm hover:bg-white/10 transition"
              >
                {playing ? <Pause size={16} /> : <Play size={16} />}
                {playing ? "Pause" : "Auto-advance"}
              </button>
              <button
                onClick={() => setActive((p) => (p + 1) % steps.length)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-sm hover:bg-white/10 transition"
              >
                Next step
              </button>
            </div>
          </div>

          <div className="lg:sticky lg:top-24">
            <AnimatePresence mode="wait">
              <motion.div
                key={step.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.35 }}
                className="glass rounded-3xl p-8 relative overflow-hidden"
                style={{
                  boxShadow: `0 30px 80px -20px ${step.color}33, 0 0 0 1px ${step.color}33 inset`,
                }}
              >
                <div
                  className="absolute -top-32 -right-20 h-72 w-72 rounded-full"
                  style={{
                    background: `radial-gradient(closest-side, ${step.color}40, transparent)`,
                    filter: "blur(20px)",
                  }}
                />
                <div className="relative">
                  <div className="flex items-center gap-3 mb-1">
                    <span
                      className="h-9 w-9 rounded-lg flex items-center justify-center"
                      style={{
                        background: `${step.color}22`,
                        color: step.color,
                      }}
                    >
                      {step.icon}
                    </span>
                    <span className="mono text-[11px] tracking-wide text-white/50 uppercase">
                      {step.id}
                    </span>
                  </div>
                  <h2 className="text-3xl font-semibold tracking-tight">
                    {step.title}
                  </h2>
                  <p className="mt-2 text-white/60">{step.description}</p>

                  <ul className="mt-6 space-y-2.5">
                    {step.details.map((d, i) => (
                      <motion.li
                        key={i}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.07 }}
                        className="flex items-start gap-3 text-sm text-white/80"
                      >
                        <span
                          className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0"
                          style={{ background: step.color }}
                        />
                        <span>{d}</span>
                      </motion.li>
                    ))}
                  </ul>

                  <div className="mt-6 grid grid-cols-3 gap-2 text-[11px] mono">
                    <Stat label="iter" value={`${active + 1}/${steps.length}`} />
                    <Stat label="cost" value={fakeCost(active)} />
                    <Stat label="tokens" value={fakeTokens(active)} />
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2">
      <div className="text-white/40">{label}</div>
      <div className="text-white/90 mt-0.5">{value}</div>
    </div>
  );
}

function fakeCost(i: number) {
  return ["$0.0021", "$0.0024", "$0.0031", "$0.0033", "$0.0044"][i] || "—";
}
function fakeTokens(i: number) {
  return ["8.4k", "8.7k", "9.5k", "10.1k", "11.6k"][i] || "—";
}

export function Header({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-14 max-w-3xl">
      <div className="mono text-[11px] tracking-[0.18em] uppercase text-white/40 mb-3">
        {eyebrow}
      </div>
      <h2 className="text-3xl md:text-5xl font-semibold tracking-tight leading-tight">
        {title}
      </h2>
      <p className="mt-4 text-white/60 text-lg">{subtitle}</p>
    </div>
  );
}
