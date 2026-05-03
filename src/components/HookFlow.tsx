"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { Header } from "./AgentLoop";
import { Shield, Wrench, ScrollText, Ban, Check } from "lucide-react";

type Frame = {
  stage: "intent" | "pre" | "tool" | "post" | "log";
  title: string;
  payload: string;
  status: "pending" | "ok" | "blocked";
};

const SCENARIOS: Record<string, Frame[]> = {
  "git push to main": [
    { stage: "intent", title: "Model emits tool call", status: "pending",
      payload: `{
  "tool": "Bash",
  "input": { "command": "git push origin main" }
}` },
    { stage: "pre", title: "PreToolUse hook fires", status: "blocked",
      payload: `# .claude/hooks/no-direct-push.sh
if echo "$INPUT" | jq -re '.input.command | test("git push.*main")'; then
  echo "blocked: push to main requires PR"
  exit 2   # exit 2 = deny, message goes back to model
fi` },
    { stage: "log", title: "Audit log", status: "blocked",
      payload: `[2026-05-03T19:21:08Z] tool=Bash decision=DENY
  reason="no direct push to main"
  hook=no-direct-push.sh user=jorge` },
  ],
  "edit a config file": [
    { stage: "intent", title: "Model emits tool call", status: "pending",
      payload: `{
  "tool": "Edit",
  "input": { "path": "next.config.ts", "..." : "..." }
}` },
    { stage: "pre", title: "PreToolUse hook fires", status: "ok",
      payload: `# allowed: not in deny-list
echo "ok"
exit 0` },
    { stage: "tool", title: "Tool runs", status: "ok",
      payload: `→ patched next.config.ts (12 lines changed)
→ exit 0` },
    { stage: "post", title: "PostToolUse hook fires", status: "ok",
      payload: `# .claude/hooks/format-and-typecheck.sh
prettier --write "$EDITED_FILE"
tsc --noEmit
# exit 0 → result + lint-clean signal returned to model` },
    { stage: "log", title: "Audit log", status: "ok",
      payload: `[2026-05-03T19:21:14Z] tool=Edit decision=ALLOW
  file=next.config.ts diff=+8/-4
  post=format-and-typecheck.sh status=clean` },
  ],
};

const STAGE_META = {
  intent: { color: "#a78bfa", icon: <Wrench size={16} />, label: "intent" },
  pre: { color: "#fbbf24", icon: <Shield size={16} />, label: "pre-hook" },
  tool: { color: "#22d3ee", icon: <Wrench size={16} />, label: "tool" },
  post: { color: "#34d399", icon: <Check size={16} />, label: "post-hook" },
  log: { color: "#f472b6", icon: <ScrollText size={16} />, label: "audit" },
};

export default function HookFlow() {
  const scenarios = Object.keys(SCENARIOS);
  const [active, setActive] = useState(scenarios[0]);
  const [step, setStep] = useState(0);
  const frames = SCENARIOS[active];

  useEffect(() => {
    setStep(0);
    const id = setInterval(() => {
      setStep((s) => (s + 1) % (frames.length + 1));
    }, 2200);
    return () => clearInterval(id);
  }, [active, frames.length]);

  const visible = frames.slice(0, step);

  return (
    <section
      id="hooks"
      className="relative w-full px-6 py-24 flex flex-col items-center"
    >
      <div className="max-w-6xl w-full">
        <Header
          eyebrow="04 · the hooks"
          title="Hooks: where you put the guardrails"
          subtitle="Hooks are shell commands the harness runs around every tool call. They can block, mutate, format, log — pure stdin/stdout. Pick a scenario:"
        />

        <div className="flex flex-wrap gap-2 mb-6">
          {scenarios.map((s) => (
            <button
              key={s}
              onClick={() => setActive(s)}
              className={`mono text-xs px-3 py-2 rounded-full border transition ${
                s === active
                  ? "border-white/30 bg-white/10 text-white"
                  : "border-white/10 text-white/60 hover:bg-white/5"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="glass rounded-3xl p-5 md:p-8 min-h-[480px]">
          <div className="grid md:grid-cols-[200px_1fr] gap-6">
            <div className="flex md:flex-col gap-2 md:gap-3">
              {(Object.keys(STAGE_META) as (keyof typeof STAGE_META)[]).map(
                (k, i) => {
                  const m = STAGE_META[k];
                  const reached = visible.some((f) => f.stage === k);
                  return (
                    <div
                      key={k}
                      className="flex items-center gap-3 transition"
                      style={{ opacity: reached ? 1 : 0.35 }}
                    >
                      <div
                        className="h-9 w-9 rounded-lg flex items-center justify-center border"
                        style={{
                          borderColor: reached ? m.color : "rgba(255,255,255,0.1)",
                          background: reached ? `${m.color}1f` : "transparent",
                          color: reached ? m.color : "rgba(255,255,255,0.5)",
                        }}
                      >
                        {m.icon}
                      </div>
                      <div className="mono text-[11px] uppercase tracking-wide text-white/60">
                        {m.label}
                      </div>
                      {i < 4 && (
                        <div className="hidden md:block flex-1" />
                      )}
                    </div>
                  );
                },
              )}
            </div>

            <div className="space-y-3">
              <AnimatePresence>
                {visible.map((f, i) => {
                  const m = STAGE_META[f.stage];
                  const accent =
                    f.status === "blocked" ? "#f87171" : m.color;
                  return (
                    <motion.div
                      key={`${active}-${i}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="rounded-xl border bg-black/40"
                      style={{ borderColor: `${accent}55` }}
                    >
                      <div
                        className="flex items-center justify-between px-4 py-2 mono text-[11px] border-b"
                        style={{
                          borderColor: `${accent}33`,
                          background: `${accent}10`,
                        }}
                      >
                        <span
                          className="flex items-center gap-2"
                          style={{ color: accent }}
                        >
                          {m.icon}
                          <span className="uppercase tracking-wide">
                            {m.label}
                          </span>
                          <span className="text-white/30">·</span>
                          <span className="text-white/70">{f.title}</span>
                        </span>
                        <span className="flex items-center gap-1 text-white/60">
                          {f.status === "blocked" ? (
                            <>
                              <Ban size={12} className="text-red-400" />
                              <span className="text-red-400">DENY</span>
                            </>
                          ) : (
                            <>
                              <Check size={12} className="text-emerald-400" />
                              <span className="text-emerald-400">OK</span>
                            </>
                          )}
                        </span>
                      </div>
                      <pre className="px-4 py-3 mono text-[12px] leading-relaxed text-white/85 whitespace-pre-wrap overflow-x-auto">
                        {f.payload}
                      </pre>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {step === 0 && (
                <div className="text-center py-16 text-white/40 mono text-sm">
                  press play (or wait) to step through the lifecycle…
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
