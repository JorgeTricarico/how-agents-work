"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { Header } from "./AgentLoop";

type Tool = {
  id: string;
  name: string;
  vendor: string;
  color: string;
  rules: { file: string; scope: string; note: string }[];
  tools: string[];
  hooks: string;
  notes: string;
};

const TOOLS: Tool[] = [
  {
    id: "claude",
    name: "Claude Code",
    vendor: "Anthropic",
    color: "#a78bfa",
    rules: [
      { file: "~/.claude/CLAUDE.md", scope: "global", note: "user-wide preferences" },
      { file: "./CLAUDE.md", scope: "project", note: "merged on session start" },
      { file: "./AGENTS.md", scope: "project", note: "imported via @AGENTS.md" },
    ],
    tools: ["Read", "Edit", "Write", "Bash", "Grep", "Glob", "WebFetch", "TaskCreate", "Agent"],
    hooks: "PreToolUse · PostToolUse · UserPromptSubmit · Stop · Notification — JSON over stdin in settings.json",
    notes:
      "First-class subagents (Agent tool). Hooks are real shell commands the harness runs around tool calls.",
  },
  {
    id: "cursor",
    name: "Cursor",
    vendor: "Anysphere",
    color: "#22d3ee",
    rules: [
      { file: ".cursor/rules/*.mdc", scope: "project", note: "scoped by globs (always / auto / manual)" },
      { file: ".cursorrules", scope: "project", note: "legacy, still read" },
      { file: "User Rules (Settings)", scope: "global", note: "stored in account, not file" },
    ],
    tools: ["edit_file", "read_file", "run_terminal_cmd", "codebase_search", "grep_search", "web_search"],
    hooks: "No user-defined hooks. Auto-run mode is gated by a per-command allowlist.",
    notes:
      "Strong indexed-codebase RAG: semantic search runs before each turn and injects the most relevant chunks.",
  },
  {
    id: "copilot",
    name: "GitHub Copilot",
    vendor: "GitHub / OpenAI",
    color: "#34d399",
    rules: [
      { file: ".github/copilot-instructions.md", scope: "repo", note: "applied to every chat in the repo" },
      { file: ".github/instructions/*.instructions.md", scope: "scoped", note: "applyTo glob frontmatter" },
      { file: "VS Code settings", scope: "global", note: "github.copilot.chat.* keys" },
    ],
    tools: ["editFiles", "runCommands", "search", "fetch", "usages", "problems", "testFailure"],
    hooks: "MCP servers + 'agent mode' tool allowlist. No PreToolUse-style scripting.",
    notes:
      "Tight VS Code integration: open editors, problems pane, and selection are auto-injected into context.",
  },
  {
    id: "aider",
    name: "Aider",
    vendor: "open source",
    color: "#fbbf24",
    rules: [
      { file: "CONVENTIONS.md", scope: "project", note: "loaded via --read or .aider.conf.yml" },
      { file: ".aider.conf.yml", scope: "project", note: "model, edit-format, repo-map size" },
      { file: ".aiderignore", scope: "project", note: "files excluded from the repo map" },
    ],
    tools: ["search/replace blocks", "shell (with confirm)", "git auto-commit", "lint/test runners"],
    hooks: "auto-lint and auto-test commands run after every edit; configurable per language.",
    notes:
      "Repo-map: a tree-sitter summary of the whole repo is injected so the model knows what exists without reading it all.",
  },
];

export default function ToolComparator() {
  const [active, setActive] = useState(TOOLS[0].id);
  const t = TOOLS.find((x) => x.id === active)!;

  return (
    <section
      id="compare"
      className="relative w-full px-6 py-24 flex flex-col items-center"
    >
      <div className="max-w-6xl w-full">
        <Header
          eyebrow="03 · the comparison"
          title="Same loop, different fuel"
          subtitle="Every agent reads project rules, exposes tools, and (sometimes) lets you hook the lifecycle. Here's exactly what changes between the four big ones."
        />

        <div className="flex flex-wrap gap-2 mb-6">
          {TOOLS.map((x) => {
            const on = x.id === active;
            return (
              <button
                key={x.id}
                onClick={() => setActive(x.id)}
                className="relative px-4 py-2 rounded-full text-sm transition border"
                style={{
                  borderColor: on ? x.color : "rgba(255,255,255,0.1)",
                  background: on ? `${x.color}1f` : "transparent",
                  color: on ? x.color : "rgba(255,255,255,0.7)",
                }}
              >
                {on && (
                  <motion.span
                    layoutId="cmp-glow"
                    className="absolute inset-0 rounded-full"
                    style={{ boxShadow: `0 0 30px ${x.color}55` }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                <span className="relative">{x.name}</span>
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.35 }}
            className="grid lg:grid-cols-3 gap-5"
          >
            <Card title="Rule files" color={t.color}>
              <div className="space-y-3">
                {t.rules.map((r, i) => (
                  <motion.div
                    key={r.file}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="rounded-lg border border-white/8 bg-black/30 p-3"
                  >
                    <div className="mono text-[12px] text-white/90">{r.file}</div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span
                        className="token-pill"
                        style={{
                          background: `${t.color}14`,
                          borderColor: `${t.color}55`,
                          color: t.color,
                        }}
                      >
                        {r.scope}
                      </span>
                      <span className="text-xs text-white/55">{r.note}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </Card>

            <Card title="Tools exposed" color={t.color}>
              <div className="flex flex-wrap gap-1.5">
                {t.tools.map((tool, i) => (
                  <motion.span
                    key={tool}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.04 }}
                    className="mono text-[11px] px-2 py-1 rounded-md bg-white/5 border border-white/10 text-white/80"
                  >
                    {tool}
                  </motion.span>
                ))}
              </div>
              <div className="mt-5 mono text-[11px] text-white/45 uppercase tracking-wide mb-2">
                hooks / lifecycle
              </div>
              <p className="text-sm text-white/75">{t.hooks}</p>
            </Card>

            <Card title="What's special" color={t.color}>
              <p className="text-sm text-white/80 leading-relaxed">{t.notes}</p>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <Stat k="vendor" v={t.vendor} />
                <Stat k="rule files" v={String(t.rules.length)} />
              </div>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}

function Card({
  title,
  color,
  children,
}: {
  title: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="glass rounded-2xl p-5"
      style={{ boxShadow: `0 0 0 1px ${color}22 inset` }}
    >
      <div className="mono text-[11px] tracking-wide uppercase text-white/45 mb-3">
        {title}
      </div>
      {children}
    </div>
  );
}
function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 mono text-[11px]">
      <div className="text-white/40">{k}</div>
      <div className="text-white/90 mt-0.5">{v}</div>
    </div>
  );
}
