import type { Lang } from "./i18n";

/* ────────────────────────────────────────────────────────────
   Per-agent context-injection model.
   Sourced from each vendor's official docs (2025/2026):
   - Claude Code   https://docs.claude.com/en/docs/claude-code/
   - Cursor        https://docs.cursor.com/
   - GitHub Copilot https://docs.github.com/en/copilot
   - Antigravity   https://antigravity.google/docs/home
   ──────────────────────────────────────────────────────────── */

export type AgentId = "claude-code" | "cursor" | "copilot" | "antigravity";

export type RuleKind = "ALWAYS" | "PATH-SCOPED" | "ON-DEMAND" | "RUNTIME";

export type CardKey =
  | "system"
  | "rules-always"
  | "rules-path"
  | "rules-ondemand"
  | "tools"
  | "env";

export type CardData = {
  key: CardKey;
  side: "left" | "right";
  slot: number;
  enter: number;
  settle: number;
  converge: number;
  ruleKind: RuleKind;
  ruleColor: string;
  label: { es: string; en: string };
  source: { es: string; en: string };
  body: { es: string; en: string };
};

export type AgentDataset = {
  id: AgentId;
  name: string;
  vendor: string;
  modelLabel: string;
  accent: string; // brand-ish color
  supportsHooks: boolean;
  hooksNote: { es: string; en: string };
  tools: string[];
  cards: CardData[];
  // The single thing that makes this agent's injection model different
  differentiator: { es: string; en: string };
};

const COLORS = {
  system: "#a78bfa",
  always: "#22d3ee",
  path: "#f472b6",
  ondemand: "#fbbf24",
  tools: "#34d399",
  env: "#60a5fa",
};

const ENV_CARD = (label = { es: "env", en: "env" }): CardData => ({
  key: "env",
  side: "right",
  slot: 2,
  enter: 0.26,
  settle: 0.34,
  converge: 0.36,
  ruleKind: "RUNTIME",
  ruleColor: COLORS.env,
  label,
  source: { es: "runtime", en: "runtime" },
  body: {
    es: "cwd: ~/proyecto\nbranch: main · limpio\nnode 20.20",
    en: "cwd: ~/project\nbranch: main · clean\nnode 20.20",
  },
});

const TOOLS_CARD = (
  tools: string[],
  enter = 0.24,
): CardData => ({
  key: "tools",
  side: "left",
  slot: 2,
  enter,
  settle: enter + 0.08,
  converge: 0.36,
  ruleKind: "ALWAYS",
  ruleColor: COLORS.tools,
  label: { es: "tools.json", en: "tools.json" },
  source: {
    es: "harness · esquemas",
    en: "harness · schemas",
  },
  body: {
    es: `[\n  ${tools.slice(0, 4).map((t) => `"${t}"`).join(", ")},\n  …\n]`,
    en: `[\n  ${tools.slice(0, 4).map((t) => `"${t}"`).join(", ")},\n  …\n]`,
  },
});

const SYSTEM_CARD = (vendorLabel: string): CardData => ({
  key: "system",
  side: "left",
  slot: 0,
  enter: 0.16,
  settle: 0.24,
  converge: 0.36,
  ruleKind: "ALWAYS",
  ruleColor: COLORS.system,
  label: { es: "system prompt", en: "system prompt" },
  source: {
    es: `${vendorLabel} · fijo`,
    en: `${vendorLabel} · fixed`,
  },
  body: {
    es:
      "Sos un agente de código interactivo.\nUsá las herramientas disponibles.\nSé conciso. Nunca corras comandos\ndestructivos sin confirmación.",
    en:
      "You are an interactive coding agent.\nUse the tools provided.\nBe concise. Never run destructive\ncommands without confirmation.",
  },
});

/* ─────────────── Claude Code ─────────────── */

const CLAUDE_CODE: AgentDataset = {
  id: "claude-code",
  name: "Claude Code",
  vendor: "Anthropic",
  modelLabel: "claude-opus-4-7 · 1M context",
  accent: "#d97757",
  supportsHooks: true,
  hooksNote: {
    es: "31 eventos: PreToolUse, PostToolUse, UserPromptSubmit, SessionStart, Stop, PreCompact… JSON por stdin/stdout.",
    en: "31 events: PreToolUse, PostToolUse, UserPromptSubmit, SessionStart, Stop, PreCompact… JSON over stdin/stdout.",
  },
  tools: ["Read", "Edit", "Write", "Bash", "Grep", "Glob", "WebFetch", "Task", "Skill"],
  cards: [
    SYSTEM_CARD("Anthropic"),
    {
      key: "rules-always",
      side: "right",
      slot: 0,
      enter: 0.18,
      settle: 0.26,
      converge: 0.36,
      ruleKind: "ALWAYS",
      ruleColor: COLORS.always,
      label: { es: "CLAUDE.md", en: "CLAUDE.md" },
      source: {
        es: "siempre · jerárquico (cwd→home)",
        en: "always · hierarchical (cwd→home)",
      },
      body: {
        es: "# Convenciones\n- TypeScript estricto.\n- Logs estructurados.\n- vitest sin mocks de DB.\n@docs/style-guide.md",
        en: "# Conventions\n- TypeScript strict.\n- Structured logs.\n- vitest, no DB mocks.\n@docs/style-guide.md",
      },
    },
    {
      key: "rules-path",
      side: "left",
      slot: 1,
      enter: 0.20,
      settle: 0.28,
      converge: 0.36,
      ruleKind: "PATH-SCOPED",
      ruleColor: COLORS.path,
      label: {
        es: ".claude/rules/api.md",
        en: ".claude/rules/api.md",
      },
      source: {
        es: "paths: src/api/**/*.ts",
        en: "paths: src/api/**/*.ts",
      },
      body: {
        es: "---\npaths:\n  - 'src/api/**'\n---\n# Solo para /api\n- Validar con zod.",
        en: "---\npaths:\n  - 'src/api/**'\n---\n# Only for /api\n- Validate with zod.",
      },
    },
    {
      key: "rules-ondemand",
      side: "right",
      slot: 1,
      enter: 0.22,
      settle: 0.30,
      converge: 0.36,
      ruleKind: "ON-DEMAND",
      ruleColor: COLORS.ondemand,
      label: {
        es: ".claude/skills/refactor",
        en: ".claude/skills/refactor",
      },
      source: {
        es: "skill · invocada por modelo",
        en: "skill · model-invoked",
      },
      body: {
        es: "---\nname: refactor\ndescription: Renombra y\n  divide archivos.\n---\n# Steps\n…",
        en: "---\nname: refactor\ndescription: Rename and\n  split files safely.\n---\n# Steps\n…",
      },
    },
    TOOLS_CARD(["Read", "Edit", "Bash", "Grep"]),
    ENV_CARD(),
  ],
  differentiator: {
    es: "Único con reglas por path + skills + 31 hooks de ciclo de vida unificados.",
    en: "The only one combining path-scoped rules, on-demand skills, and 31 lifecycle hooks.",
  },
};

/* ─────────────── Cursor ─────────────── */

const CURSOR: AgentDataset = {
  id: "cursor",
  name: "Cursor",
  vendor: "Anysphere",
  modelLabel: "claude-sonnet · cursor",
  accent: "#22d3ee",
  supportsHooks: true,
  hooksNote: {
    es: ".cursor/hooks.json — beforeShellExecution, afterFileEdit, beforeSubmitPrompt, preToolUse… JSON stdin/stdout.",
    en: ".cursor/hooks.json — beforeShellExecution, afterFileEdit, beforeSubmitPrompt, preToolUse… JSON stdin/stdout.",
  },
  tools: [
    "Read",
    "Edit",
    "Codebase Search",
    "Grep",
    "Terminal",
    "Web Search",
    "Apply Model",
    "Task",
  ],
  cards: [
    SYSTEM_CARD("vendor"),
    {
      key: "rules-always",
      side: "right",
      slot: 0,
      enter: 0.18,
      settle: 0.26,
      converge: 0.36,
      ruleKind: "ALWAYS",
      ruleColor: COLORS.always,
      label: {
        es: ".cursor/rules/base.mdc",
        en: ".cursor/rules/base.mdc",
      },
      source: {
        es: "alwaysApply: true",
        en: "alwaysApply: true",
      },
      body: {
        es: "---\nalwaysApply: true\n---\n# Convenciones\n- TS estricto.\n- vitest sin mocks de DB.",
        en: "---\nalwaysApply: true\n---\n# Conventions\n- TS strict.\n- vitest, no DB mocks.",
      },
    },
    {
      key: "rules-path",
      side: "left",
      slot: 1,
      enter: 0.20,
      settle: 0.28,
      converge: 0.36,
      ruleKind: "PATH-SCOPED",
      ruleColor: COLORS.path,
      label: {
        es: ".cursor/rules/api.mdc",
        en: ".cursor/rules/api.mdc",
      },
      source: {
        es: "Auto Attached · globs",
        en: "Auto Attached · globs",
      },
      body: {
        es: "---\nglobs: src/api/**\nalwaysApply: false\n---\n# Para /api\n- Validar con zod.",
        en: "---\nglobs: src/api/**\nalwaysApply: false\n---\n# For /api\n- Validate with zod.",
      },
    },
    {
      key: "rules-ondemand",
      side: "right",
      slot: 1,
      enter: 0.22,
      settle: 0.30,
      converge: 0.36,
      ruleKind: "ON-DEMAND",
      ruleColor: COLORS.ondemand,
      label: {
        es: ".cursor/rules/refactor.mdc",
        en: ".cursor/rules/refactor.mdc",
      },
      source: {
        es: "Agent Requested · descripción",
        en: "Agent Requested · description",
      },
      body: {
        es: "---\ndescription: Cuando hay\n  que dividir archivos\n  o renombrar símbolos.\n---\n# Steps…",
        en: "---\ndescription: When you need\n  to split files or rename\n  symbols safely.\n---\n# Steps…",
      },
    },
    TOOLS_CARD(["Read", "Edit", "Codebase Search", "Terminal"]),
    ENV_CARD(),
  ],
  differentiator: {
    es: "4 tipos de reglas explícitos por quién las activa: Always, Auto-Attached, Agent-Requested, Manual @-mention.",
    en: "Four explicit rule tiers based on *who* triggers them: Always, Auto-Attached, Agent-Requested, Manual @-mention.",
  },
};

/* ─────────────── GitHub Copilot ─────────────── */

const COPILOT: AgentDataset = {
  id: "copilot",
  name: "GitHub Copilot",
  vendor: "GitHub / Microsoft",
  modelLabel: "gpt-5 · agent mode",
  accent: "#34d399",
  supportsHooks: false,
  hooksNote: {
    es: "Sin hooks de ciclo de vida nativos. Sólo allowlists de comandos en agent mode + MCP servers.",
    en: "No native lifecycle hooks. Only command allowlists in agent mode + MCP servers.",
  },
  tools: [
    "codebase",
    "search",
    "usages",
    "fetch",
    "editFiles",
    "runCommands",
    "runTests",
    "problems",
  ],
  cards: [
    SYSTEM_CARD("GitHub"),
    {
      key: "rules-always",
      side: "right",
      slot: 0,
      enter: 0.18,
      settle: 0.26,
      converge: 0.36,
      ruleKind: "ALWAYS",
      ruleColor: COLORS.always,
      label: {
        es: ".github/copilot-instructions.md",
        en: ".github/copilot-instructions.md",
      },
      source: {
        es: "siempre · workspace",
        en: "always · workspace",
      },
      body: {
        es: "# Convenciones\n- TS estricto.\n- vitest sin mocks de DB.\n- Mensajes de commit Conventional.",
        en: "# Conventions\n- TS strict.\n- vitest, no DB mocks.\n- Conventional Commits.",
      },
    },
    {
      key: "rules-path",
      side: "left",
      slot: 1,
      enter: 0.20,
      settle: 0.28,
      converge: 0.36,
      ruleKind: "PATH-SCOPED",
      ruleColor: COLORS.path,
      label: {
        es: ".github/instructions/api.instructions.md",
        en: ".github/instructions/api.instructions.md",
      },
      source: {
        es: "applyTo · globs",
        en: "applyTo · globs",
      },
      body: {
        es: "---\napplyTo: \"**/*.ts\"\n---\n# TypeScript\n- Sin any.\n- Validar con zod.",
        en: "---\napplyTo: \"**/*.ts\"\n---\n# TypeScript\n- No any.\n- Validate with zod.",
      },
    },
    {
      key: "rules-ondemand",
      side: "right",
      slot: 1,
      enter: 0.22,
      settle: 0.30,
      converge: 0.36,
      ruleKind: "ON-DEMAND",
      ruleColor: COLORS.ondemand,
      label: {
        es: ".github/prompts/refactor.prompt.md",
        en: ".github/prompts/refactor.prompt.md",
      },
      source: {
        es: "slash command /refactor",
        en: "slash command /refactor",
      },
      body: {
        es: "---\nagent: agent\nmodel: GPT-5\n---\n# Refactor\nSplit large files…",
        en: "---\nagent: agent\nmodel: GPT-5\n---\n# Refactor\nSplit large files…",
      },
    },
    TOOLS_CARD(["codebase", "editFiles", "runCommands", "fetch"]),
    ENV_CARD({ es: "VS Code state", en: "VS Code state" }),
  ],
  differentiator: {
    es: "Tres archivos con propósito distinto: copilot-instructions (always), .instructions.md (glob), .prompt.md (slash). Sin hooks.",
    en: "Three purpose-typed files: copilot-instructions (always), .instructions.md (glob), .prompt.md (slash). No hooks.",
  },
};

/* ─────────────── Antigravity ─────────────── */

const ANTIGRAVITY: AgentDataset = {
  id: "antigravity",
  name: "Antigravity",
  vendor: "Google",
  modelLabel: "gemini-3-pro · agent",
  accent: "#fbbf24",
  supportsHooks: false,
  hooksNote: {
    es: "Sin hooks nativos. Se emulan vía .agents/workflows/ y .agent/rules/.",
    en: "No native hooks. Emulated via .agents/workflows/ and .agent/rules/.",
  },
  tools: [
    "Editor",
    "Terminal",
    "Browser",
    "Read",
    "Write",
    "Command",
    "MCP",
  ],
  cards: [
    SYSTEM_CARD("Google"),
    {
      key: "rules-always",
      side: "right",
      slot: 0,
      enter: 0.18,
      settle: 0.26,
      converge: 0.36,
      ruleKind: "ALWAYS",
      ruleColor: COLORS.always,
      label: { es: "GEMINI.md / AGENTS.md", en: "GEMINI.md / AGENTS.md" },
      source: {
        es: "siempre · raíz del proyecto",
        en: "always · project root",
      },
      body: {
        es: "# Convenciones\n- TS estricto.\n- Logs estructurados.\n- vitest sin mocks de DB.",
        en: "# Conventions\n- TS strict.\n- Structured logs.\n- vitest, no DB mocks.",
      },
    },
    {
      key: "rules-path",
      side: "left",
      slot: 1,
      enter: 0.20,
      settle: 0.28,
      converge: 0.36,
      ruleKind: "PATH-SCOPED",
      ruleColor: COLORS.path,
      label: {
        es: "src/api/AGENTS.md",
        en: "src/api/AGENTS.md",
      },
      source: {
        es: "anidado · scope por directorio",
        en: "nested · directory-scoped",
      },
      body: {
        es: "# Solo para /api\n- Validar con zod.\n- Logs estructurados.",
        en: "# Only for /api\n- Validate with zod.\n- Structured logs.",
      },
    },
    {
      key: "rules-ondemand",
      side: "right",
      slot: 1,
      enter: 0.22,
      settle: 0.30,
      converge: 0.36,
      ruleKind: "ON-DEMAND",
      ruleColor: COLORS.ondemand,
      label: {
        es: ".agents/skills/refactor",
        en: ".agents/skills/refactor",
      },
      source: {
        es: "skill + Knowledge Items",
        en: "skill + Knowledge Items",
      },
      body: {
        es: "---\nname: refactor\n---\n# Steps…\n\n+ KIs persistidos\n  por subagente.",
        en: "---\nname: refactor\n---\n# Steps…\n\n+ KIs persisted by\n  knowledge subagent.",
      },
    },
    TOOLS_CARD(["Editor", "Terminal", "Browser", "Read"]),
    ENV_CARD(),
  ],
  differentiator: {
    es: "Único agent-driven: el propio agente escribe task.md / plan.md y un subagente extrae Knowledge Items al cerrar la sesión.",
    en: "Only artifact-driven model: the agent itself writes task.md / plan.md and a knowledge subagent harvests Knowledge Items at session end.",
  },
};

export const AGENTS: Record<AgentId, AgentDataset> = {
  "claude-code": CLAUDE_CODE,
  cursor: CURSOR,
  copilot: COPILOT,
  antigravity: ANTIGRAVITY,
};

export const AGENT_ORDER: AgentId[] = [
  "claude-code",
  "cursor",
  "copilot",
  "antigravity",
];

export function pickLang<T>(field: { es: T; en: T }, lang: Lang): T {
  return field[lang];
}
