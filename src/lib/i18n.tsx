"use client";

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

export type Lang = "es" | "en";

type Dict = {
  // global
  langToggle: { es: string; en: string };

  // cinematic
  cinemaBadge: string;
  cinemaTitle1: string;
  cinemaTitle2: string;
  cinemaSubtitle: string;
  cinemaCaption: string;
  ready: string;
  thinking: string;
  iter: string;
  initBoot: string;
  user: string;
  assistant: string;
  toolUse: string;
  toolResult: string;
  preHook: string;
  preHookCheck: string;
  allow: string;
  postPrettier: string;
  postTsc: string;
  postAudit: string;
  userMsg: string;
  streamLines: string[];
  assistMsg: string;
  ctx: {
    system: { label: string; source: string; body: string };
    claude: { label: string; source: string; body: string };
    skill: { label: string; source: string; body: string };
    pathrule: { label: string; source: string; body: string };
    tools: { label: string; source: string; body: string };
    env: { label: string; source: string; body: string };
  };
  ruleKindLabels: { ALWAYS: string; "PATH-SCOPED": string; "ON-DEMAND": string; RUNTIME: string };
  injectsInto: string;

  levelLabel: string;
  levels: { id: 1 | 2 | 3; name: string; subtitle: string }[];

  // agent loop
  loopEyebrow: string;
  loopTitle: string;
  loopSubtitle: string;
  loopPause: string;
  loopAuto: string;
  loopNext: string;
  loopRunning: string;
  loopSteps: {
    title: string;
    short: string;
    description: string;
    details: string[];
  }[];
  cost: string;
  tokens: string;

  // tool comparator
  cmpEyebrow: string;
  cmpTitle: string;
  cmpSubtitle: string;
  cmpRules: string;
  cmpToolsExposed: string;
  cmpHooks: string;
  cmpSpecial: string;
  cmpVendor: string;
  cmpRuleFiles: string;

  // hooks flow
  hkEyebrow: string;
  hkTitle: string;
  hkSubtitle: string;
  hkScenarios: { id: string; label: string }[];
  hkPressPlay: string;
  hkStages: { intent: string; pre: string; tool: string; post: string; log: string };
  hkDeny: string;
  hkOk: string;

  // footer
  footerBuilt: string;
};

const ES: Dict = {
  langToggle: { es: "ES", en: "EN" },
  cinemaBadge: "en vivo · escena guionada · loop cada 42s",
  cinemaTitle1: "Lo que un agente de IA",
  cinemaTitle2: "realmente hace",
  cinemaSubtitle: "detrás de un solo turno de chat",
  cinemaCaption:
    "Mirá cómo un mensaje del usuario se convierte en un loop completo de agente. Hacé scroll para ver el detalle de contexto, hooks y diferencias entre herramientas.",
  ready: "listo",
  thinking: "pensando…",
  iter: "iter",
  initBoot: "iniciando harness…",
  user: "usuario",
  assistant: "asistente",
  toolUse: "asistente · tool_use",
  toolResult: "tool_result · stdout",
  preHook: "PreToolUse hook",
  preHookCheck: "verificando política",
  allow: "permitir",
  postPrettier: "prettier · limpio",
  postTsc: "tsc · 0 errores",
  postAudit: "auditoría · registrado",
  userMsg: "Agregá un toggle de modo oscuro al header.",
  streamLines: [
    "Leyendo src/components/Header.tsx…",
    "Encontré el ThemeProvider existente.",
    "Insertando <ThemeToggle/> al lado del nav.",
    "Aplicado +18 −2",
  ],
  assistMsg:
    "Listo. El Header ahora importa ThemeToggle y lo renderiza al\nlado del nav. Las variantes `dark:` de Tailwind ya cubren el\nresto de la UI.",
  ctx: {
    system: {
      label: "system prompt",
      source: "vendor · fijo",
      body:
        "Sos un agente de código interactivo.\nUsá las herramientas disponibles.\nSé conciso. Nunca corras comandos\ndestructivos sin confirmación.",
    },
    claude: {
      label: "AGENTS.md",
      source: "siempre · raíz del repo",
      body:
        "# Convenciones\n- TypeScript estricto.\n- Tailwind utilitario.\n- vitest sin mocks de DB.",
    },
    pathrule: {
      label: ".rules/api/*.mdc",
      source: "applyTo: src/api/**",
      body:
        "# Solo cuando edita /api\n- Validar con zod.\n- Logs estructurados.\n- Sin try/catch tragones.",
    },
    skill: {
      label: "skill: refactor",
      source: "on-demand · invocada",
      body:
        '{ "name": "refactor",\n  "description": "Splits files,\n  renames symbols safely",\n  "steps": [...] }',
    },
    tools: {
      label: "tools.json",
      source: "harness · esquemas",
      body: '[\n  "Read", "Edit", "Write",\n  "Bash", "Grep", "Glob"\n]',
    },
    env: {
      label: "env",
      source: "runtime",
      body: "cwd: ~/Github/how-agents-work\nbranch: main · limpio\nnode 20.20",
    },
  },
  ruleKindLabels: {
    ALWAYS: "siempre",
    "PATH-SCOPED": "por ruta",
    "ON-DEMAND": "bajo demanda",
    RUNTIME: "en vivo",
  },
  injectsInto: "se inyecta",
  levelLabel: "nivel",
  levels: [
    { id: 1, name: "Básico", subtitle: "Solo el flujo esencial: prompt + reglas + respuesta." },
    { id: 2, name: "Intermedio", subtitle: "Agrega herramientas, skills y reglas por ruta." },
    { id: 3, name: "Real", subtitle: "El sistema completo: hooks, auditoría, todo el ciclo." },
  ],

  loopEyebrow: "01 · el ciclo",
  loopTitle: "Un agente es un loop, no una llamada",
  loopSubtitle:
    "Todos los agentes de código — Claude Code, Cursor, Copilot, Aider — corren el mismo ciclo de cinco pasos. Las diferencias interesantes están en los pasos 1, 2 y 4.",
  loopPause: "Pausar",
  loopAuto: "Auto-avanzar",
  loopNext: "Siguiente paso",
  loopRunning: "corriendo…",
  loopSteps: [
    {
      title: "1. Ensamblado de contexto",
      short: "Lee AGENTS.md, CLAUDE.md, archivos del proyecto, ediciones recientes.",
      description:
        "El harness reúne todo lo que el modelo necesita saber antes de ver tu prompt.",
      details: [
        "Carga el system prompt (definido por el vendor, fijo).",
        "Lee reglas del proyecto: AGENTS.md, CLAUDE.md, .cursorrules, copilot-instructions.md.",
        "Inyecta los esquemas de herramientas (Read, Edit, Bash, Grep, …) para que el modelo sepa qué puede llamar.",
        "Agrega contexto del entorno: cwd, git status, OS, diffs recientes.",
      ],
    },
    {
      title: "2. Intención + hook PreToolUse",
      short: "El modelo elige una herramienta. El hook intercepta antes de ejecutar.",
      description:
        "Un hook PreToolUse definido por vos puede inspeccionar, modificar o bloquear la llamada.",
      details: [
        "El modelo emite un bloque tool_use estructurado con argumentos.",
        "El hook PreToolUse recibe JSON por stdin; puede denegar (exit 2) o permitir.",
        "Políticas comunes: bloquear escrituras a /etc, requerir aprobación para git push, redactar secretos.",
        "Si se deniega, el mensaje vuelve al modelo para que repiense.",
      ],
    },
    {
      title: "3. Ejecución de la herramienta",
      short: "Efectos colaterales en sandbox: archivos, shell, red.",
      description:
        "El trabajo real — y donde los agentes se diferencian más.",
      details: [
        "La herramienta corre en el harness, no en el modelo. La salida se captura.",
        "stdout, stderr, exit code y rutas de artefactos se recolectan.",
        "Los errores vuelven como tool_result, no como excepciones — el modelo decide qué hacer.",
      ],
    },
    {
      title: "4. Hook PostToolUse + auditoría",
      short: "Lint, formato, log, reaccionar al resultado.",
      description:
        "Después de que la herramienta corre, los hooks observan y el modelo recibe el resultado.",
      details: [
        "PostToolUse puede correr un formateador, type-check, o bloquear si falla.",
        "La auditoría guarda: qué se llamó, quién, con qué args, qué cambió.",
        "El tool_result se agrega a la conversación como un mensaje nuevo.",
      ],
    },
    {
      title: "5. Re-prompt al modelo (loop)",
      short: "Volver al inicio con el nuevo estado, hasta terminar.",
      description:
        "Un agente no es una sola llamada — es un loop ajustado hasta una condición de stop.",
      details: [
        "El contexto actualizado (con el tool_result) vuelve al modelo.",
        "El loop termina cuando: el modelo emite respuesta final, llega al budget, o lo interrumpís.",
        "Sesiones largas disparan compaction: turnos viejos se resumen para liberar tokens.",
      ],
    },
  ],
  cost: "costo",
  tokens: "tokens",

  cmpEyebrow: "02 · la comparación",
  cmpTitle: "Mismo ciclo, distinto combustible",
  cmpSubtitle:
    "Cada agente lee reglas del proyecto, expone herramientas y (a veces) te deja interceptar el ciclo. Esto es exactamente lo que cambia entre las cuatro grandes.",
  cmpRules: "Archivos de reglas",
  cmpToolsExposed: "Herramientas expuestas",
  cmpHooks: "hooks / ciclo",
  cmpSpecial: "Lo que la hace especial",
  cmpVendor: "vendor",
  cmpRuleFiles: "archivos de reglas",

  hkEyebrow: "03 · los hooks",
  hkTitle: "Hooks: donde ponés las barreras",
  hkSubtitle:
    "Los hooks son comandos shell que el harness corre alrededor de cada llamada a herramienta. Pueden bloquear, mutar, formatear, loggear — puro stdin/stdout. Elegí un escenario:",
  hkScenarios: [
    { id: "git push to main", label: "git push a main" },
    { id: "edit a config file", label: "editar un archivo de config" },
  ],
  hkPressPlay: "esperá a que arranque, o tocá un escenario…",
  hkStages: {
    intent: "intención",
    pre: "pre-hook",
    tool: "herramienta",
    post: "post-hook",
    log: "auditoría",
  },
  hkDeny: "DENEGAR",
  hkOk: "OK",

  footerBuilt: "construido con Next 16 · React 19 · Framer Motion · Lenis",
};

const EN: Dict = {
  langToggle: { es: "ES", en: "EN" },
  cinemaBadge: "live · scripted scene · loops every 42s",
  cinemaTitle1: "What an AI coding agent",
  cinemaTitle2: "actually does",
  cinemaSubtitle: "behind a single chat turn",
  cinemaCaption:
    "Watch a single user message become a full agent loop. Scroll for the deep dive on context, hooks, and how each tool differs.",
  ready: "ready",
  thinking: "thinking…",
  iter: "iter",
  initBoot: "initializing harness…",
  user: "user",
  assistant: "assistant",
  toolUse: "assistant · tool_use",
  toolResult: "tool_result · stdout",
  preHook: "PreToolUse hook",
  preHookCheck: "checking policy",
  allow: "allow",
  postPrettier: "prettier · clean",
  postTsc: "tsc · 0 errors",
  postAudit: "audit · logged",
  userMsg: "Add a dark mode toggle to the header.",
  streamLines: [
    "Reading src/components/Header.tsx…",
    "Found existing theme provider.",
    "Inserting <ThemeToggle/> next to nav.",
    "Patched +18 −2",
  ],
  assistMsg:
    "Done. The Header now imports ThemeToggle and renders it next\nto the nav. Tailwind's `dark:` variants already cover the rest\nof the UI.",
  ctx: {
    system: {
      label: "system prompt",
      source: "vendor · fixed",
      body:
        "You are an interactive coding agent.\nUse the tools provided.\nBe concise. Never run destructive\ncommands without confirmation.",
    },
    claude: {
      label: "AGENTS.md",
      source: "always · repo root",
      body:
        "# Conventions\n- TypeScript strict.\n- Tailwind utilities.\n- vitest, no DB mocks.",
    },
    pathrule: {
      label: ".rules/api/*.mdc",
      source: "applyTo: src/api/**",
      body:
        "# Only when editing /api\n- Validate with zod.\n- Structured logs.\n- No swallowing try/catch.",
    },
    skill: {
      label: "skill: refactor",
      source: "on-demand · invoked",
      body:
        '{ "name": "refactor",\n  "description": "Splits files,\n  renames symbols safely",\n  "steps": [...] }',
    },
    tools: {
      label: "tools.json",
      source: "harness · schemas",
      body: '[\n  "Read", "Edit", "Write",\n  "Bash", "Grep", "Glob"\n]',
    },
    env: {
      label: "env",
      source: "runtime",
      body: "cwd: ~/Github/how-agents-work\nbranch: main · clean\nnode 20.20",
    },
  },
  ruleKindLabels: {
    ALWAYS: "always",
    "PATH-SCOPED": "path-scoped",
    "ON-DEMAND": "on-demand",
    RUNTIME: "runtime",
  },
  injectsInto: "injects",
  levelLabel: "level",
  levels: [
    { id: 1, name: "Basic", subtitle: "Just the essential flow: prompt + rules + reply." },
    { id: 2, name: "Intermediate", subtitle: "Adds tools, skills, and path-scoped rules." },
    { id: 3, name: "Real", subtitle: "The full system: hooks, audit, every beat." },
  ],

  loopEyebrow: "01 · the loop",
  loopTitle: "An agent is a loop, not a call",
  loopSubtitle:
    "Every coding agent — Claude Code, Cursor, Copilot, Aider — runs the same five-step cycle. The interesting differences live in steps 1, 2 and 4.",
  loopPause: "Pause",
  loopAuto: "Auto-advance",
  loopNext: "Next step",
  loopRunning: "running…",
  loopSteps: [
    {
      title: "1. Context Assembly",
      short: "Read AGENTS.md, CLAUDE.md, project files, recent edits.",
      description:
        "The harness gathers everything the model needs to know before it sees your prompt.",
      details: [
        "Loads system prompt (vendor-defined, fixed).",
        "Reads project rules: AGENTS.md, CLAUDE.md, .cursorrules, copilot-instructions.md.",
        "Inlines tool schemas (Read, Edit, Bash, Grep, …) so the model knows what it can call.",
        "Adds environment context: cwd, git status, OS, recent diffs.",
      ],
    },
    {
      title: "2. Intent + PreToolUse hook",
      short: "Model picks a tool. Hook intercepts before it runs.",
      description:
        "A user-defined PreToolUse hook can inspect, modify, or block the call.",
      details: [
        "Model emits a structured tool_use block with arguments.",
        "PreToolUse hook receives JSON on stdin; can deny (exit 2) or allow.",
        "Common policies: block writes to /etc, require approval for git push, redact secrets.",
        "If denied, the message goes back to the model so it can rethink.",
      ],
    },
    {
      title: "3. Tool execution",
      short: "Sandboxed side effects: files, shell, network.",
      description: "The actual work — and where things diverge across agents.",
      details: [
        "Tool runs in the harness, not the model. Output is captured.",
        "stdout, stderr, exit code, and any artifact paths are collected.",
        "Errors are returned as a tool_result, not raised — the model handles them.",
      ],
    },
    {
      title: "4. PostToolUse hook + audit",
      short: "Lint, format, log, react to outcome.",
      description:
        "After the tool runs, hooks observe and the model receives the result.",
      details: [
        "PostToolUse can run a formatter, type-check, or block-on-failure.",
        "Audit logs capture: what was called, by whom, with what args, what changed.",
        "Tool result is appended to the conversation as a new message.",
      ],
    },
    {
      title: "5. Re-prompt the model (loop)",
      short: "Back to the top with new state, until done.",
      description:
        "The agent isn't a single call — it's a tight loop until a stop condition.",
      details: [
        "Updated context (now with tool_result) is sent back to the model.",
        "Loop ends when: model emits a final answer, hits a budget, or is interrupted.",
        "Long sessions trigger compaction: older turns get summarized to free tokens.",
      ],
    },
  ],
  cost: "cost",
  tokens: "tokens",

  cmpEyebrow: "02 · the comparison",
  cmpTitle: "Same loop, different fuel",
  cmpSubtitle:
    "Every agent reads project rules, exposes tools, and (sometimes) lets you hook the lifecycle. Here's exactly what changes between the four big ones.",
  cmpRules: "Rule files",
  cmpToolsExposed: "Tools exposed",
  cmpHooks: "hooks / lifecycle",
  cmpSpecial: "What's special",
  cmpVendor: "vendor",
  cmpRuleFiles: "rule files",

  hkEyebrow: "03 · the hooks",
  hkTitle: "Hooks: where you put the guardrails",
  hkSubtitle:
    "Hooks are shell commands the harness runs around every tool call. They can block, mutate, format, log — pure stdin/stdout. Pick a scenario:",
  hkScenarios: [
    { id: "git push to main", label: "git push to main" },
    { id: "edit a config file", label: "edit a config file" },
  ],
  hkPressPlay: "wait for it to start, or tap a scenario…",
  hkStages: {
    intent: "intent",
    pre: "pre-hook",
    tool: "tool",
    post: "post-hook",
    log: "audit",
  },
  hkDeny: "DENY",
  hkOk: "OK",

  footerBuilt: "built with Next 16 · React 19 · Framer Motion · Lenis",
};

const DICTS: Record<Lang, Dict> = { es: ES, en: EN };

const LangCtx = createContext<{
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Dict;
}>({
  lang: "es",
  setLang: () => {},
  t: ES,
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("es");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("lang") as Lang | null;
      if (saved === "es" || saved === "en") setLang(saved);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("lang", lang);
    } catch {}
  }, [lang]);

  return (
    <LangCtx.Provider value={{ lang, setLang, t: DICTS[lang] }}>
      {children}
    </LangCtx.Provider>
  );
}

export function useLang() {
  return useContext(LangCtx);
}

export function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-1 glass rounded-full px-1 py-1 mono text-[11px]">
      {(["es", "en"] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className="relative px-3 py-1 rounded-full transition"
          style={{
            background: lang === l ? "rgba(255,255,255,0.12)" : "transparent",
            color: lang === l ? "#fff" : "rgba(255,255,255,0.55)",
          }}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
