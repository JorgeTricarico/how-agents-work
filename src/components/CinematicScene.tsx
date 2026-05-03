"use client";

import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
  useMotionValueEvent,
  MotionValue,
} from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  FileText,
  Wrench,
  Shield,
  CheckCircle2,
  User as UserIcon,
  Sparkles,
  Terminal,
  MousePointer2,
  Play,
  Pause,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useLang } from "@/lib/i18n";
import {
  AGENTS,
  AGENT_ORDER,
  AgentId,
  CardData,
  pickLang,
} from "@/lib/agents";

/* ──────────────────────────────────────────────────────────
   Scroll-driven cinematic.
   The section is 500vh tall. Inside, a sticky stage stays
   pinned to the viewport. Scroll progress 0..1 drives every
   beat (typing, card flights, hooks, streams, response).
   Camera also tilts subtly with progress for a 3D feel.
   ────────────────────────────────────────────────────────── */

type CtxCard = CardData;

// Beat windows in scroll progress (0..1)
const W = {
  bootEnd:        0.04,
  userTypeStart:  0.06,
  userTypeEnd:    0.14,
  ctxBegin:       0.18,
  ctxConverge:    0.34,
  thinking1End:   0.40,
  toolCallShow:   0.42,
  preHookFlash:   0.46,
  preHookPass:    0.50,
  toolStreamStart:0.52,
  toolStreamEnd:  0.66,
  postHook:       0.68,
  resultBack:     0.72,
  assistantStart: 0.74,
  assistantEnd:   0.92,
  iterPulse:      0.95,
};

// Each stage is an explicit phase of the agent loop. Every stage has a
// short conceptual description ("what's in this stage / what gets injected
// here") that is shown alongside the cinematic so the user builds a mental
// model, not just sees pretty animations.
type Stage = {
  id: string;
  at: number;
  label: { es: string; en: string };
  description: { es: string; en: string };
};

const STAGES: Stage[] = [
  {
    id: "input",
    at: 0.005,
    label: { es: "1. Input", en: "1. Input" },
    description: {
      es: "El usuario escribe un mensaje. El harness lo captura y todavía no se lo pasa al modelo: primero arma el contexto.",
      en: "The user types a message. The harness captures it but does not call the model yet — first it assembles the context.",
    },
  },
  {
    id: "user-typed",
    at: 0.10,
    label: { es: "2. Mensaje recibido", en: "2. Message received" },
    description: {
      es: "El mensaje queda como turno user pendiente. El harness arranca a leer todo lo que tiene que adjuntar.",
      en: "The message becomes a pending user turn. The harness starts reading everything it must attach.",
    },
  },
  {
    id: "ctx-assembly",
    at: 0.28,
    label: { es: "3. Ensamblado de contexto", en: "3. Context assembly" },
    description: {
      es: "Se inyectan en este orden: system prompt (fijo del vendor), reglas siempre activas (AGENTS.md / CLAUDE.md), reglas por path que matcheen lo que se va a editar, skills invocados, esquemas de herramientas y env (cwd, git status).",
      en: "Injected in this order: system prompt (vendor-fixed), always-on rules (AGENTS.md / CLAUDE.md), path rules whose globs match the files about to be edited, invoked skills, tool schemas, and env (cwd, git status).",
    },
  },
  {
    id: "ctx-merged",
    at: 0.36,
    label: { es: "4. Prompt final", en: "4. Final prompt" },
    description: {
      es: "Todo lo anterior se concatena en un solo payload de mensajes. Ese payload — y nada más — es lo que recibe la API del LLM.",
      en: "Everything above is concatenated into a single messages payload. That payload — and nothing else — is what the LLM API receives.",
    },
  },
  {
    id: "inference",
    at: 0.42,
    label: { es: "5. Inferencia", en: "5. Inference" },
    description: {
      es: "El modelo decodifica tokens. Si decide que necesita una herramienta, emite un bloque structured tool_use en vez de texto libre.",
      en: "The model decodes tokens. If it decides it needs a tool, it emits a structured tool_use block instead of free text.",
    },
  },
  {
    id: "tool-intent",
    at: 0.46,
    label: { es: "6. Intención de tool_use", en: "6. tool_use intent" },
    description: {
      es: "El modelo todavía no ejecuta nada — sólo dice 'quiero llamar Edit con estos argumentos'. El harness es quien ejecuta.",
      en: "The model didn't run anything yet — it just said 'I want to call Edit with these args'. The harness is what executes.",
    },
  },
  {
    id: "pre-hook",
    at: 0.50,
    label: { es: "7. PreToolUse hook", en: "7. PreToolUse hook" },
    description: {
      es: "Antes de ejecutar, el harness corre tus hooks de PreToolUse. Reciben el JSON de la llamada por stdin y pueden permitir, mutar o denegar (exit 2). Acá es donde bloqueás cosas peligrosas como rm -rf o git push --force.",
      en: "Before executing, the harness runs your PreToolUse hooks. They receive the call JSON on stdin and can allow, mutate, or deny (exit 2). This is where you block dangerous things like rm -rf or git push --force.",
    },
  },
  {
    id: "tool-exec",
    at: 0.58,
    label: { es: "8. Ejecución de la tool", en: "8. Tool execution" },
    description: {
      es: "El harness ejecuta la herramienta en sandbox: aplica el Edit, corre el comando, hace el fetch. Captura stdout, stderr y exit code. Los errores no son excepciones — vuelven como tool_result.",
      en: "The harness runs the tool in a sandbox: applies the Edit, runs the command, makes the fetch. It captures stdout, stderr and exit code. Errors are not exceptions — they come back as tool_result.",
    },
  },
  {
    id: "post-hook",
    at: 0.68,
    label: { es: "9. PostToolUse hook", en: "9. PostToolUse hook" },
    description: {
      es: "Tras la ejecución corren tus hooks de PostToolUse: lint, format, typecheck, audit. Si fallan pueden devolver feedback al modelo, que lo ve como mensaje y reacciona — esta es la parte que hace que el agente 'aprenda' de sus propios errores.",
      en: "After execution, your PostToolUse hooks run: lint, format, typecheck, audit. If they fail they can return feedback to the model, which sees it as a message and reacts — this is what makes the agent 'learn' from its own mistakes.",
    },
  },
  {
    id: "result-back",
    at: 0.74,
    label: { es: "10. Tool result al modelo", en: "10. Tool result fed back" },
    description: {
      es: "El resultado se agrega como un nuevo mensaje del rol tool. El loop arranca de nuevo desde el paso 5 con este turno extra de contexto.",
      en: "The result is appended as a new tool-role message. The loop restarts from step 5 with this extra context turn.",
    },
  },
  {
    id: "answer",
    at: 0.82,
    label: { es: "11. Respuesta final", en: "11. Final answer" },
    description: {
      es: "Cuando el modelo no necesita más herramientas, emite texto. El harness lo streamea token a token al chat y termina el turno.",
      en: "When the model needs no more tools, it emits text. The harness streams it token-by-token to the chat and ends the turn.",
    },
  },
];

function within(p: number, a: number, b: number) {
  return p >= a && p <= b;
}
function typed(s: string, p: number, start: number, end: number) {
  if (p <= start) return "";
  if (p >= end) return s;
  const t = (p - start) / (end - start);
  return s.slice(0, Math.floor(s.length * t));
}

export default function CinematicScene() {
  const { t, lang: i18nLang } = useLang();
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const [agentId, setAgentId] = useState<AgentId>("claude-code");
  const agent = AGENTS[agentId];
  const [vw, setVw] = useState(1024);
  useEffect(() => {
    const update = () => setVw(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  const isMobile = vw < 720;
  const cardWidth = isMobile ? 200 : 230;
  // Chat panel is narrowed so cards land OUTSIDE its silhouette
  const chatWidth = isMobile ? Math.min(360, vw * 0.86) : 560;
  const lateralUnit = chatWidth / 2 + cardWidth / 2 + (isMobile ? 14 : 38);
  const verticalUnit = isMobile ? 110 : 150;

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });
  const [progress, setProgress] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (v) => setProgress(v));

  // Auto-play: animates window scroll from section top → bottom over ~50s
  const [playing, setPlaying] = useState(false);
  const playRafRef = useRef<number | null>(null);
  const playStartRef = useRef<{ ts: number; fromY: number; toY: number } | null>(null);

  const stopPlay = () => {
    if (playRafRef.current) cancelAnimationFrame(playRafRef.current);
    playRafRef.current = null;
    playStartRef.current = null;
    setPlaying(false);
  };

  const startPlay = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const sectionTop = window.scrollY + rect.top;
    const sectionBottom = sectionTop + rect.height - window.innerHeight;
    const fromY = Math.max(window.scrollY, sectionTop);
    const toY = sectionBottom;
    if (toY <= fromY) return;
    setPlaying(true);
    // Slower auto-play so each beat has time to land. ~95s for the
    // full scene; proportionally less if user already scrolled in.
    const duration = Math.max(12000, ((toY - fromY) / rect.height) * 95000);
    playStartRef.current = { ts: performance.now(), fromY, toY };

    const tick = (now: number) => {
      const s = playStartRef.current;
      if (!s) return;
      const k = Math.min(1, (now - s.ts) / duration);
      const eased = 1 - Math.pow(1 - k, 2);
      window.scrollTo(0, s.fromY + (s.toY - s.fromY) * eased);
      if (k >= 1) {
        stopPlay();
        return;
      }
      playRafRef.current = requestAnimationFrame(tick);
    };
    playRafRef.current = requestAnimationFrame(tick);
  };

  const resetToTop = () => {
    stopPlay();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const sectionTop = window.scrollY + rect.top;
    window.scrollTo({ top: sectionTop, behavior: "smooth" });
  };

  // Jump to a specific beat anchor (0..1 progress) by computing target scroll.
  const seekToProgress = (p: number) => {
    stopPlay();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const sectionTop = window.scrollY + rect.top;
    const total = rect.height - window.innerHeight;
    if (total <= 0) return;
    const target = sectionTop + p * total;
    window.scrollTo({ top: target, behavior: "smooth" });
  };

  const stepNext = () => {
    const next = STAGES.find((a) => a.at > progress + 0.005);
    if (next) seekToProgress(next.at);
  };
  const stepPrev = () => {
    const prev = [...STAGES].reverse().find((a) => a.at < progress - 0.005);
    if (prev) seekToProgress(prev.at);
    else seekToProgress(0);
  };
  const currentStage = (() => {
    let cur = STAGES[0];
    for (const a of STAGES) if (progress >= a.at - 0.005) cur = a;
    return cur;
  })();

  // If user scrolls manually while playing, stop auto-play
  useEffect(() => {
    const onWheel = () => {
      if (playing) stopPlay();
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchmove", onWheel, { passive: true });
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchmove", onWheel);
    };
  }, [playing]);

  useEffect(() => () => stopPlay(), []);

  // Camera tilt + parallax driven by scroll
  const camRotX = useTransform(scrollYProgress, [0, 1], [10, -6]);
  const camRotY = useTransform(scrollYProgress, [0, 0.5, 1], [-4, 2, -3]);
  const camScale = useTransform(scrollYProgress, [0, 0.5, 1], [0.96, 1, 0.97]);
  const bgShift = useTransform(scrollYProgress, [0, 1], ["-2%", "8%"]);
  const drift1 = useTransform(scrollYProgress, [0, 1], [0, -120]);
  const drift2 = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const drift3 = useTransform(scrollYProgress, [0, 1], [0, -60]);

  const userText = typed(t.userMsg, progress, W.userTypeStart, W.userTypeEnd);
  const assistText = typed(t.assistMsg, progress, W.assistantStart, W.assistantEnd);

  const streamLines = useMemo(() => {
    if (progress < W.toolStreamStart) return [];
    const span = W.toolStreamEnd - W.toolStreamStart;
    const each = span / t.streamLines.length;
    const i = Math.min(
      t.streamLines.length,
      Math.floor((progress - W.toolStreamStart) / each) + 1,
    );
    return t.streamLines.slice(0, i);
  }, [progress, t.streamLines]);

  const visibleCards = agent.cards;
  const allowHooks = agent.supportsHooks;

  const showPreHook  = allowHooks && within(progress, W.preHookFlash, W.preHookFlash + 0.06);
  const showPostHook = allowHooks && within(progress, W.postHook, W.postHook + 0.06);
  const showToolCall = progress > W.toolCallShow && progress < W.assistantStart;
  const ctxConverging = progress > W.ctxConverge && progress < W.thinking1End + 0.02;
  const thinking =
    (progress > W.thinking1End && progress < W.toolCallShow) ||
    (progress > W.resultBack && progress < W.assistantStart);

  return (
    <section
      ref={containerRef}
      className="relative w-full"
      style={{ height: "500vh" }}
    >
      {/* Sticky stage */}
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        {/* Parallax background layers */}
        <Stars yShift={bgShift} />
        <ParallaxOrb x={drift1} color="#a78bfa" top="6%" left="-4%" size={620} blur={70} opacity={0.55} />
        <ParallaxOrb x={drift2} color="#22d3ee" top="58%" left="72%" size={520} blur={70} opacity={0.5} />
        <ParallaxOrb x={drift3} color="#f472b6" top="38%" left="42%" size={380} blur={55} opacity={0.4} />
        <FloatingTokens />

        {/* Top headline — fades out as scroll progresses so it never covers the stage */}
        <motion.div
          className="absolute top-0 inset-x-0 z-40 px-6 pt-10 md:pt-14 text-center pointer-events-none"
          style={{ opacity: Math.max(0, 1 - progress * 14) }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass mono text-[11px] text-white/70">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            {t.cinemaBadge}
          </div>
          <h1 className="mt-4 text-2xl md:text-4xl font-semibold tracking-tight leading-[1.05]">
            {t.cinemaTitle1} <span className="gradient-text">{t.cinemaTitle2}</span>
          </h1>
        </motion.div>

        {/* Tiny header that appears AFTER the headline fades — non-overlapping */}
        <motion.div
          className="absolute top-4 inset-x-0 z-40 flex justify-center pointer-events-none"
          style={{ opacity: Math.max(0, Math.min(1, (progress - 0.06) * 14)) }}
        >
          <div className="glass rounded-full px-3 py-1 mono text-[10px] text-white/55">
            {t.cinemaTitle1} {t.cinemaTitle2}
          </div>
        </motion.div>

        {/* Agent selector — top-center, always visible */}
        <div
          className="absolute top-2 left-1/2 -translate-x-1/2 z-50 pointer-events-auto"
          style={{
            marginTop: progress < 0.06 ? 130 : 36,
            transition: "margin 0.5s ease",
          }}
        >
          <AgentSelector
            agentId={agentId}
            setAgent={setAgentId}
            reset={() => {
              const el = containerRef.current;
              if (!el) return;
              window.scrollTo({
                top: window.scrollY + el.getBoundingClientRect().top,
                behavior: "smooth",
              });
            }}
          />
        </div>

        {/* Stage explanation — sticky panel right side, hidden on mobile */}
        {!isMobile && (
          <StagePanel
            stage={currentStage}
            stageIndex={STAGES.findIndex((s) => s.id === currentStage.id)}
            total={STAGES.length}
            agent={agent}
            lang={i18nLang}
          />
        )}

        {/* 3D camera-tilted stage */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            perspective: 2000,
          }}
        >
          <motion.div
            className="relative"
            style={{
              width: "min(1080px, 92vw)",
              transformStyle: "preserve-3d",
              rotateX: camRotX,
              rotateY: camRotY,
              scale: camScale,
            }}
          >
            {/* Floating context cards */}
            {visibleCards.map((card) => (
              <Card3D
                key={card.key}
                card={card}
                progress={progress}
                converging={ctxConverging}
                lateralUnit={lateralUnit}
                verticalUnit={verticalUnit}
                cardWidth={cardWidth}
                isMobile={isMobile}
              />
            ))}
            {/* Injection arrows from cards to chat */}
            {!isMobile && <InjectionArrows
              cards={visibleCards}
              progress={progress}
              converging={ctxConverging}
              lateralUnit={lateralUnit}
              verticalUnit={verticalUnit}
            />}

            {/* Convergence beam + merge burst */}
            <AnimatePresence>
              {ctxConverging && (
                <>
                  <ConvergenceBeam />
                  <MergeBurst cards={visibleCards} />
                </>
              )}
            </AnimatePresence>

            {/* Chat panel — center stage */}
            <motion.div
              className="relative z-30 mx-auto glass rounded-2xl overflow-hidden"
              style={{
                width: chatWidth,
                transformStyle: "preserve-3d",
              }}
              initial={{ opacity: 0, y: 60 }}
              animate={{
                opacity: 1,
                y: 0,
                boxShadow: ctxConverging
                  ? [
                      "0 80px 160px -30px rgba(0,0,0,0.8), 0 0 0 1px rgba(167,139,250,0.5) inset, 0 0 80px rgba(167,139,250,0.45)",
                      "0 80px 160px -30px rgba(0,0,0,0.8), 0 0 0 2px rgba(34,211,238,0.6) inset, 0 0 120px rgba(34,211,238,0.55)",
                      "0 80px 160px -30px rgba(0,0,0,0.8), 0 0 0 1px rgba(244,114,182,0.5) inset, 0 0 80px rgba(244,114,182,0.45)",
                    ]
                  : "0 80px 160px -30px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.06) inset, 0 0 60px rgba(167,139,250,0.08)",
              }}
              transition={
                ctxConverging
                  ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" }
                  : { duration: 1, ease: [0.22, 1, 0.36, 1] }
              }
            >
              {/* Title bar */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 bg-black/40">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-red-500/80" />
                    <span className="h-3 w-3 rounded-full bg-yellow-500/80" />
                    <span className="h-3 w-3 rounded-full bg-green-500/80" />
                  </div>
                  <span className="ml-3 mono text-[11px] text-white/45">
                    agent · claude-opus-4-7 · 1M context
                  </span>
                </div>
                <div className="mono text-[10px] text-white/40 flex items-center gap-2">
                  <motion.span
                    animate={{ opacity: thinking ? [0.4, 1, 0.4] : 1 }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: thinking ? "#fbbf24" : "#10b981" }}
                  />
                  {thinking ? t.thinking : t.ready}
                  <span className="text-white/25">·</span>
                  <span>{t.iter} 1</span>
                </div>
              </div>

              {/* Body */}
              <div
                className="p-6 md:p-8 flex flex-col gap-5 bg-[radial-gradient(ellipse_at_top,#0c0c14,#07070a)]"
                style={{ minHeight: 480 }}
              >
                {progress < W.bootEnd && (
                  <div className="flex-1 flex items-center justify-center mono text-xs text-white/40">
                    <span className="animate-pulse">{t.initBoot}</span>
                  </div>
                )}

                {progress > W.userTypeStart && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-3 items-start"
                  >
                    <Bubble color="#60a5fa" icon={<UserIcon size={14} />} />
                    <div className="flex-1">
                      <div className="mono text-[10px] uppercase tracking-wide text-white/40 mb-1">
                        {t.user}
                      </div>
                      <div className="text-[15px] text-white/90">
                        {userText}
                        {progress < W.userTypeEnd && <Caret />}
                      </div>
                    </div>
                  </motion.div>
                )}

                <AnimatePresence>
                  {showToolCall && (
                    <motion.div
                      initial={{ opacity: 0, y: 14, rotateX: -6 }}
                      animate={{ opacity: 1, y: 0, rotateX: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="flex gap-3 items-start"
                    >
                      <Bubble color="#a78bfa" icon={<Sparkles size={14} />} />
                      <div className="flex-1 space-y-2">
                        <div className="mono text-[10px] uppercase tracking-wide text-white/40">
                          {t.toolUse}
                        </div>
                        <div className="rounded-lg border border-violet-400/30 bg-violet-500/5 mono text-[12px] overflow-hidden">
                          <div className="px-3 py-1.5 border-b border-violet-400/20 flex items-center justify-between text-violet-300 text-[10px] uppercase tracking-wide">
                            <span className="flex items-center gap-1.5">
                              <Wrench size={11} /> Edit
                            </span>
                            <span className="text-white/40">id: tu_01k7…</span>
                          </div>
                          <pre className="px-3 py-2 text-white/80 leading-relaxed whitespace-pre-wrap">{`{
  "path": "CHANGELOG.md",
  "old_string": "## [2.3.1] - 2026-04-12",
  "new_string": "## [2.4.0] - …\\n …\\n\\n## [2.3.1] - 2026-04-12"
}`}</pre>
                        </div>

                        <AnimatePresence>
                          {showPreHook && (
                            <motion.div
                              initial={{ opacity: 0, y: -6 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0 }}
                              className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 flex items-center justify-between"
                            >
                              <div className="flex items-center gap-2 text-amber-300 mono text-[12px]">
                                <Shield size={13} />
                                <span>{t.preHook} · {t.preHookCheck}</span>
                              </div>
                              <motion.span
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.4 }}
                                className="mono text-[11px] text-emerald-300 flex items-center gap-1"
                              >
                                <CheckCircle2 size={12} /> {t.allow}
                              </motion.span>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {streamLines.length > 0 && (
                          <DiffView
                            file="CHANGELOG.md"
                            plus={6}
                            minus={0}
                            visibleLines={streamLines.length}
                          />
                        )}

                        <AnimatePresence>
                          {showPostHook && (
                            <motion.div
                              initial={{ opacity: 0, y: -6 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0 }}
                              className="flex flex-wrap items-center gap-2 text-[11px] mono"
                            >
                              <Badge color="emerald">{t.postPrettier}</Badge>
                              <Badge color="emerald">{t.postTsc}</Badge>
                              <Badge color="pink">{t.postAudit}</Badge>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {progress > W.assistantStart && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-3 items-start"
                  >
                    <Bubble color="#a78bfa" icon={<Sparkles size={14} />} />
                    <div className="flex-1">
                      <div className="mono text-[10px] uppercase tracking-wide text-white/40 mb-1">
                        {t.assistant}
                      </div>
                      <div className="text-[15px] text-white/90 whitespace-pre-line leading-relaxed">
                        {assistText}
                        {progress < W.assistantEnd && <Caret />}
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Playback controls */}
        <div className="absolute bottom-5 inset-x-0 z-50 flex flex-col items-center gap-2 pointer-events-none">
          {/* Stage label */}
          <div
            key={currentStage.id}
            className="pointer-events-auto glass rounded-full px-3 py-1 mono text-[11px] text-white/85"
          >
            <span className="text-white/45 mr-2">
              {STAGES.findIndex((s) => s.id === currentStage.id) + 1}/{STAGES.length}
            </span>
            {currentStage.label[i18nLang as "es" | "en"] || currentStage.label.es}
          </div>

          <div className="glass rounded-full px-1.5 py-1.5 flex items-center gap-1 pointer-events-auto">
            <button
              onClick={stepPrev}
              className="h-9 w-9 rounded-full hover:bg-white/10 text-white/80 flex items-center justify-center transition"
              aria-label="previous step"
              title="paso anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => (playing ? stopPlay() : startPlay())}
              className="h-9 w-9 rounded-full bg-white text-black flex items-center justify-center hover:bg-white/90 transition"
              aria-label={playing ? "pause" : "play"}
            >
              {playing ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <button
              onClick={stepNext}
              className="h-9 w-9 rounded-full hover:bg-white/10 text-white/80 flex items-center justify-center transition"
              aria-label="next step"
              title="siguiente paso"
            >
              <ChevronRight size={16} />
            </button>
            <button
              onClick={resetToTop}
              className="h-9 w-9 rounded-full hover:bg-white/10 text-white/70 flex items-center justify-center transition"
              aria-label="reset"
            >
              <RotateCcw size={13} />
            </button>
            <span className="px-3 mono text-[10px] text-white/55">
              {Math.round(progress * 100)}%
            </span>
          </div>
        </div>

        {/* Bottom: scroll progress + hint */}
        <ScrollProgress progress={scrollYProgress} hintVisible={progress < 0.05 && !playing} />
      </div>
    </section>
  );
}

/* ────────────── components ────────────── */

function cardSlotPosition(
  card: CtxCard,
  lateralUnit: number,
  verticalUnit: number,
) {
  const sign = card.side === "left" ? -1 : 1;
  const x = sign * lateralUnit;
  // slot 0 → top, 1 → middle, 2 → bottom
  const y = (card.slot - 1) * verticalUnit;
  return { x, y, sign };
}

function Card3D({
  card,
  progress,
  converging,
  lateralUnit,
  verticalUnit,
  cardWidth,
  isMobile,
}: {
  card: CtxCard;
  progress: number;
  converging: boolean;
  lateralUnit: number;
  verticalUnit: number;
  cardWidth: number;
  isMobile: boolean;
}) {
  const { t, lang } = useLang();
  const data = {
    label: pickLang(card.label, lang),
    source: pickLang(card.source, lang),
    body: pickLang(card.body, lang),
  };

  const entryT = (progress - card.enter) / (card.settle - card.enter);
  const ease = Math.min(1, Math.max(0, entryT));

  const { x: xFinal, y: yFinal, sign } = cardSlotPosition(card, lateralUnit, verticalUnit);
  const z = -40 - card.slot * 20;
  const rotY = sign * (isMobile ? 12 : 16);

  // animated values
  let opacity = 0;
  let x = sign * (lateralUnit + 220);
  let y = yFinal + 50;
  let zVal = z - 240;
  let rY = rotY * 1.6;
  let scale = 0.85;
  let blur = 0;

  if (progress < card.enter) {
    opacity = 0;
  } else if (progress < card.settle) {
    opacity = ease;
    x = (sign * (lateralUnit + 220)) * (1 - ease) + xFinal * ease;
    y = (yFinal + 50) * (1 - ease) + yFinal * ease;
    zVal = (z - 240) * (1 - ease) + z * ease;
    rY = rotY * 1.6 * (1 - ease) + rotY * ease;
    scale = 0.85 + 0.15 * ease;
  } else if (progress < card.converge) {
    const drift = Math.sin((progress - card.settle) * 24) * 5;
    opacity = 1;
    x = xFinal;
    y = yFinal + drift;
    zVal = z;
    rY = rotY;
    scale = 1;
  } else {
    const cT = Math.min(1, (progress - card.converge) / 0.06);
    opacity = 1 - cT;
    x = xFinal * (1 - cT);
    y = yFinal * (1 - cT);
    zVal = z * (1 - cT);
    rY = rotY * (1 - cT);
    scale = 1 - 0.4 * cT;
    blur = cT * 6;
  }

  return (
    <motion.div
      className="absolute top-1/2 left-1/2 pointer-events-none"
      style={{
        width: cardWidth,
        marginLeft: -cardWidth / 2,
        marginTop: -80,
        transformStyle: "preserve-3d",
        zIndex: 10 - card.slot,
      }}
      animate={{ opacity, x, y, z: zVal, rotateY: rY, scale, filter: blur ? `blur(${blur}px)` : "blur(0px)" }}
      transition={{ duration: 0.15, ease: "linear" }}
    >
      <div
        className="rounded-xl glass overflow-hidden"
        style={{
          boxShadow: `0 30px 60px -10px ${card.ruleColor}55, 0 0 0 1px ${card.ruleColor}55 inset`,
        }}
      >
        {/* Big rule kind badge */}
        <div
          className="px-3 py-2 mono text-[10px] uppercase tracking-[0.14em] flex items-center justify-between border-b"
          style={{
            borderColor: `${card.ruleColor}44`,
            background: `${card.ruleColor}1a`,
            color: card.ruleColor,
          }}
        >
          <span className="font-semibold">{card.ruleKind}</span>
          <span className="opacity-70">{t.injectsInto} →</span>
        </div>
        <div
          className="px-3 py-2 flex items-center gap-2 border-b"
          style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}
        >
          <FileText size={12} style={{ color: card.ruleColor }} />
          <span className="text-[13px] font-semibold text-white">{data.label}</span>
        </div>
        <pre className="px-3 py-2 mono text-[11px] text-white/80 whitespace-pre-wrap leading-relaxed">
          {data.body}
        </pre>
        <div className="px-3 py-1.5 mono text-[10px] text-white/45 border-t border-white/5">
          {data.source}
        </div>
      </div>
    </motion.div>
  );
}

type DiffLine =
  | { kind: "hunk"; text: string }
  | { kind: "context"; text: string }
  | { kind: "minus"; text: string }
  | { kind: "plus"; text: string };

const DIFF_LINES: DiffLine[] = [
  { kind: "hunk",    text: "@@ -1,4 +1,10 @@" },
  { kind: "context", text: "# Changelog" },
  { kind: "context", text: "" },
  { kind: "plus",    text: "## [2.4.0] - 2026-05-03" },
  { kind: "plus",    text: "### Added" },
  { kind: "plus",    text: "- Retry logic for failed API calls" },
  { kind: "plus",    text: "### Fixed" },
  { kind: "plus",    text: "- Memory leak in session handler" },
  { kind: "plus",    text: "" },
  { kind: "context", text: "## [2.3.1] - 2026-04-12" },
];

function DiffView({
  file,
  plus,
  minus,
  visibleLines,
}: {
  file: string;
  plus: number;
  minus: number;
  visibleLines: number;
}) {
  // visibleLines (1..N) maps stream progress to how many diff lines to reveal.
  const max = DIFF_LINES.length;
  const reveal = Math.min(max, Math.max(0, Math.round((visibleLines / 4) * max)));
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-cyan-400/30 bg-black/65 overflow-hidden"
    >
      {/* tab-like file header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-cyan-400/20 bg-black/40">
        <div className="flex items-center gap-2 mono text-[11px]">
          <FileText size={11} className="text-cyan-300" />
          <span className="text-white/85">{file}</span>
        </div>
        <div className="flex items-center gap-2 mono text-[10px]">
          <span className="text-emerald-300">+{plus}</span>
          <span className="text-rose-300">−{minus}</span>
        </div>
      </div>
      {/* diff body with line numbers */}
      <div className="mono text-[11.5px] leading-[1.55]">
        {DIFF_LINES.slice(0, reveal).map((l, i) => {
          const bg =
            l.kind === "plus"
              ? "rgba(16,185,129,0.10)"
              : l.kind === "minus"
                ? "rgba(244,63,94,0.10)"
                : l.kind === "hunk"
                  ? "rgba(167,139,250,0.08)"
                  : "transparent";
          const fg =
            l.kind === "plus"
              ? "#86efac"
              : l.kind === "minus"
                ? "#fca5a5"
                : l.kind === "hunk"
                  ? "#a78bfa"
                  : "rgba(255,255,255,0.6)";
          const sigil =
            l.kind === "plus" ? "+" : l.kind === "minus" ? "−" : l.kind === "hunk" ? "@" : " ";
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-[28px_18px_1fr] items-center"
              style={{ background: bg, color: fg }}
            >
              <span className="text-right pr-2 text-white/30 select-none mono text-[10px]">
                {l.kind === "hunk" ? "" : i}
              </span>
              <span className="text-center select-none">{sigil}</span>
              <span className="pr-3 whitespace-pre-wrap break-all">
                {l.text || " "}
              </span>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

function AgentSelector({
  agentId,
  setAgent,
  reset,
}: {
  agentId: AgentId;
  setAgent: (id: AgentId) => void;
  reset: () => void;
}) {
  return (
    <div className="glass rounded-full p-1 flex items-center gap-1 flex-wrap justify-center">
      <span className="mono text-[10px] uppercase tracking-wider text-white/45 px-2.5">
        agent
      </span>
      {AGENT_ORDER.map((id) => {
        const a = AGENTS[id];
        const active = id === agentId;
        return (
          <button
            key={id}
            onClick={() => {
              setAgent(id);
              reset();
            }}
            className="relative px-3 py-1.5 rounded-full transition text-[11px] mono"
            style={{
              background: active ? `${a.accent}28` : "transparent",
              color: active ? "#fff" : "rgba(255,255,255,0.55)",
              boxShadow: active ? `0 0 0 1px ${a.accent}66 inset` : "none",
            }}
          >
            <span
              className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle"
              style={{ background: a.accent }}
            />
            {a.name}
          </button>
        );
      })}
    </div>
  );
}

function StagePanel({
  stage,
  stageIndex,
  total,
  agent,
  lang,
}: {
  stage: Stage;
  stageIndex: number;
  total: number;
  agent: { name: string; modelLabel: string; supportsHooks: boolean; hooksNote: { es: string; en: string } };
  lang: string;
}) {
  const isHookStage = stage.id === "pre-hook" || stage.id === "post-hook";
  const noHooksNote =
    isHookStage && !agent.supportsHooks
      ? agent.hooksNote[(lang as "es" | "en") || "es"]
      : null;
  return (
    <div className="absolute top-1/2 right-6 -translate-y-1/2 z-40 hidden lg:block w-[300px] pointer-events-none">
      <motion.div
        key={stage.id}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
        className="glass rounded-2xl p-4 pointer-events-auto"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="mono text-[10px] uppercase tracking-wider text-white/45">
            {stageIndex + 1} / {total}
          </span>
          <span className="mono text-[10px] text-white/50">{agent.name}</span>
        </div>
        <h3 className="text-[15px] font-semibold text-white mb-2">
          {stage.label[(lang as "es" | "en") || "es"]}
        </h3>
        <p className="text-[12.5px] text-white/70 leading-relaxed">
          {stage.description[(lang as "es" | "en") || "es"]}
        </p>
        {noHooksNote && (
          <div className="mt-3 px-3 py-2 rounded-md border border-amber-400/30 bg-amber-500/10 text-amber-200 mono text-[11px] leading-relaxed">
            ⚠ {noHooksNote}
          </div>
        )}
      </motion.div>
    </div>
  );
}

function InjectionArrows({
  cards,
  progress,
  converging,
  lateralUnit,
  verticalUnit,
}: {
  cards: CtxCard[];
  progress: number;
  converging: boolean;
  lateralUnit: number;
  verticalUnit: number;
}) {
  // SVG canvas centered over stage; arrows go from each settled card → chat panel
  const W = 1300;
  const H = 600;
  const cx = W / 2;
  const cy = H / 2;
  return (
    <svg
      className="pointer-events-none absolute left-1/2 top-1/2 z-20"
      style={{
        width: W,
        height: H,
        marginLeft: -W / 2,
        marginTop: -H / 2,
        transform: "translateZ(0)",
      }}
      viewBox={`0 0 ${W} ${H}`}
    >
      <defs>
        {cards.map((c) => (
          <marker
            key={c.key}
            id={`arrow-${c.key}`}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={c.ruleColor} />
          </marker>
        ))}
      </defs>
      {cards.map((c) => {
        const visible = progress > c.settle && progress < c.converge;
        if (!visible && !converging) return null;
        const { x, y, sign } = cardSlotPosition(c, lateralUnit, verticalUnit);
        // Card edge facing center
        const cardEdgeX = cx + x - sign * 110;
        const cardY = cy + y;
        // Chat panel edge (closest x)
        const chatEdgeX = cx + sign * 280 * -1; // toward chat panel side
        const chatY = cy + (c.slot - 1) * 24;
        // Quadratic curve control point
        const ctrlX = (cardEdgeX + chatEdgeX) / 2;
        const ctrlY = (cardY + chatY) / 2 + sign * -8;
        const path = `M ${cardEdgeX} ${cardY} Q ${ctrlX} ${ctrlY}, ${chatEdgeX} ${chatY}`;
        const op = converging ? Math.max(0, 1 - (progress - c.converge) * 30) : 1;
        return (
          <g key={c.key} opacity={op}>
            <motion.path
              d={path}
              fill="none"
              stroke={c.ruleColor}
              strokeWidth={2}
              strokeDasharray="6 6"
              strokeOpacity="0.85"
              markerEnd={`url(#arrow-${c.key})`}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
            <motion.circle
              r={3}
              fill={c.ruleColor}
              animate={{
                offsetDistance: ["0%", "100%"],
              }}
              transition={{
                duration: 1.4,
                repeat: Infinity,
                ease: "linear",
              }}
              style={{
                offsetPath: `path("${path}")`,
                filter: `drop-shadow(0 0 4px ${c.ruleColor})`,
              }}
            />
          </g>
        );
      })}
    </svg>
  );
}


function ConvergenceBeam() {
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-20"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1100 600" preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id="beam" cx="50%" cy="50%">
            <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.85" />
            <stop offset="50%" stopColor="#22d3ee" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
          </radialGradient>
        </defs>
        <motion.circle
          cx="550" cy="300" r="220"
          fill="url(#beam)"
          initial={{ scale: 0.3, opacity: 0 }}
          animate={{ scale: [0.3, 1.7, 0.6], opacity: [0, 1, 0] }}
          transition={{ duration: 2.4, ease: "easeOut" }}
          style={{ transformOrigin: "550px 300px" }}
        />
        {/* Shockwave ring */}
        <motion.circle
          cx="550" cy="300" r="60"
          fill="none" stroke="#a78bfa" strokeWidth="2"
          initial={{ scale: 0.2, opacity: 0 }}
          animate={{ scale: [0.2, 4, 5], opacity: [0, 0.6, 0] }}
          transition={{ duration: 2.4, ease: "easeOut" }}
          style={{ transformOrigin: "550px 300px" }}
        />
      </svg>
    </motion.div>
  );
}

function MergeBurst({ cards }: { cards: CtxCard[] }) {
  // Each visible card emits ~8 particles that fly toward the chat panel center
  // with each particle tinted by the card's ruleColor — visually expresses
  // the rules "mixing" into the model's input.
  return (
    <div
      className="pointer-events-none absolute left-1/2 top-1/2 z-25"
      style={{ width: 0, height: 0 }}
    >
      {cards.flatMap((c) =>
        Array.from({ length: 10 }).map((_, i) => {
          const sign = c.side === "left" ? -1 : 1;
          const startX = sign * 240;
          const startY = (c.slot - 1) * 110;
          const endX = 0;
          const endY = (c.slot - 1) * 12;
          const delay = i * 0.06 + c.slot * 0.05;
          const dur = 0.8 + (i % 3) * 0.2;
          const size = 3 + (i % 3);
          return (
            <motion.span
              key={`${c.key}-${i}`}
              className="absolute rounded-full"
              style={{
                width: size,
                height: size,
                background: c.ruleColor,
                left: 0,
                top: 0,
                marginLeft: -size / 2,
                marginTop: -size / 2,
                boxShadow: `0 0 ${size * 4}px ${c.ruleColor}`,
              }}
              initial={{ x: startX, y: startY, opacity: 0, scale: 0.6 }}
              animate={{
                x: [startX, (startX + endX) / 2, endX],
                y: [startY, (startY + endY) / 2 - 30, endY],
                opacity: [0, 1, 0],
                scale: [0.6, 1.2, 0.4],
              }}
              transition={{ duration: dur, delay, ease: "easeOut" }}
            />
          );
        }),
      )}
    </div>
  );
}

function Bubble({ color, icon }: { color: string; icon: React.ReactNode }) {
  return (
    <div
      className="h-7 w-7 shrink-0 rounded-full flex items-center justify-center mt-0.5"
      style={{
        background: `${color}22`,
        color,
        boxShadow: `0 0 18px ${color}33, 0 0 0 1px ${color}55 inset`,
      }}
    >
      {icon}
    </div>
  );
}

function Caret() {
  return (
    <span
      className="inline-block w-[8px] h-[1.05em] align-middle ml-0.5 bg-white/80 animate-pulse"
      style={{ verticalAlign: "-0.15em" }}
    />
  );
}

function Badge({
  color,
  children,
}: {
  color: "emerald" | "pink";
  children: React.ReactNode;
}) {
  const map = {
    emerald: ["#10b981", "rgba(16,185,129,0.1)", "rgba(16,185,129,0.3)"],
    pink: ["#f472b6", "rgba(244,114,182,0.1)", "rgba(244,114,182,0.3)"],
  } as const;
  const [c, bg, border] = map[color];
  return (
    <span
      className="px-2 py-1 rounded-md flex items-center gap-1.5"
      style={{ background: bg, border: `1px solid ${border}`, color: c }}
    >
      <CheckCircle2 size={11} /> {children}
    </span>
  );
}

function Stars({ yShift }: { yShift: MotionValue<string> }) {
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ y: yShift }}
    >
      <div
        className="absolute inset-0 opacity-50"
        style={{
          background:
            "radial-gradient(1px 1px at 12% 22%, rgba(255,255,255,0.7), transparent 50%)," +
            "radial-gradient(1px 1px at 28% 78%, rgba(255,255,255,0.5), transparent 50%)," +
            "radial-gradient(1.5px 1.5px at 62% 18%, rgba(167,139,250,0.7), transparent 50%)," +
            "radial-gradient(1px 1px at 84% 64%, rgba(34,211,238,0.6), transparent 50%)," +
            "radial-gradient(1.5px 1.5px at 48% 52%, rgba(244,114,182,0.6), transparent 50%)," +
            "radial-gradient(1px 1px at 92% 30%, rgba(255,255,255,0.45), transparent 50%)",
        }}
      />
    </motion.div>
  );
}

function ParallaxOrb({
  x,
  color,
  top,
  left,
  size,
  blur,
  opacity = 0.4,
}: {
  x: MotionValue<number>;
  color: string;
  top: string;
  left: string;
  size: number;
  blur: number;
  opacity?: number;
}) {
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute rounded-full"
      style={{
        top,
        left,
        width: size,
        height: size,
        x,
        opacity,
        background: `radial-gradient(closest-side, ${color}, ${color}33 45%, transparent 70%)`,
        filter: `blur(${blur}px)`,
        mixBlendMode: "screen",
      }}
    />
  );
}

const TOKEN_LABELS = [
  "system_prompt",
  "AGENTS.md",
  "CLAUDE.md",
  "tools.json",
  "PreToolUse",
  "PostToolUse",
  "Edit",
  "Bash",
  "tool_result",
  "compaction",
  "iter++",
  "stdin",
  "stdout",
  "exit 0",
  "git status",
];

function FloatingTokens() {
  // Stable randoms per token, generated once with deterministic seed-ish mod
  const items = useMemo(
    () =>
      TOKEN_LABELS.map((label, i) => {
        const top = ((i * 71) % 90) + 4;       // 4..94
        const left = ((i * 137) % 92) + 3;     // 3..95
        const dur = 14 + (i % 6) * 3;          // 14..29s
        const delay = (i % 7) * 1.4;
        const drift = 14 + (i % 5) * 6;
        const colors = ["#a78bfa", "#22d3ee", "#f472b6", "#fbbf24", "#34d399"];
        const color = colors[i % colors.length];
        return { label, top, left, dur, delay, drift, color };
      }),
    [],
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {items.map((it, idx) => (
        <motion.span
          key={idx}
          className="absolute mono text-[10px] whitespace-nowrap"
          style={{
            top: `${it.top}%`,
            left: `${it.left}%`,
            color: `${it.color}aa`,
            textShadow: `0 0 12px ${it.color}66`,
            opacity: 0.45,
          }}
          animate={{
            y: [0, -it.drift, 0, it.drift, 0],
            x: [0, it.drift / 2, 0, -it.drift / 2, 0],
            opacity: [0.25, 0.55, 0.35, 0.5, 0.25],
          }}
          transition={{
            duration: it.dur,
            repeat: Infinity,
            ease: "easeInOut",
            delay: it.delay,
          }}
        >
          {it.label}
        </motion.span>
      ))}
    </div>
  );
}

function ScrollProgress({
  progress,
  hintVisible,
}: {
  progress: MotionValue<number>;
  hintVisible: boolean;
}) {
  const width = useTransform(progress, [0, 1], ["0%", "100%"]);
  return (
    <>
      <div className="absolute bottom-0 inset-x-0 z-40 h-1 bg-white/5">
        <motion.div
          className="h-full"
          style={{
            width,
            background: "linear-gradient(90deg,#a78bfa,#22d3ee,#f472b6)",
          }}
        />
      </div>
      <AnimatePresence>
        {hintVisible && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute bottom-12 inset-x-0 z-40 flex flex-col items-center gap-2 pointer-events-none"
          >
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              className="flex items-center gap-2 mono text-[11px] text-white/55 glass px-3 py-2 rounded-full"
            >
              <MousePointer2 size={12} />
              hacé scroll para reproducir la escena
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
