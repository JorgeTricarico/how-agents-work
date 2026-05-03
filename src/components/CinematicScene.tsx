"use client";

import {
  motion,
  AnimatePresence,
  useTransform,
  useMotionValue,
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

// Anchor positions are tuned to land at the *peak* of each effect:
//   ctx-* anchors land in the middle of the slot's "fully settled, arrows
//   drawn, card visible" window (between settle 0.025 and converge 0.05
//   after enter). That way pressing → (or play) lands you on the moment
//   the lines are complete, not at the start of the entry animation.
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
    at: 0.13,
    label: { es: "2. Mensaje recibido", en: "2. Message received" },
    description: {
      es: "El mensaje queda como turno user pendiente. El harness arranca a leer todo lo que tiene que adjuntar.",
      en: "The message becomes a pending user turn. The harness starts reading everything it must attach.",
    },
  },
  {
    id: "ctx-always",
    at: 0.20,
    label: { es: "3. Reglas siempre activas", en: "3. Always-on rules" },
    description: {
      es: "El system prompt (fijo del vendor) y las reglas que siempre se cargan — AGENTS.md / CLAUDE.md — entran al orbe primero. Definen el comportamiento base del agente para cualquier prompt.",
      en: "The system prompt (vendor-fixed) and the rules that always load — AGENTS.md / CLAUDE.md — enter the orb first. They define base behavior for any prompt.",
    },
  },
  {
    id: "ctx-path",
    at: 0.26,
    label: { es: "4. Reglas por path + skills", en: "4. Path rules + skills" },
    description: {
      es: "Después se evalúan las reglas con globs (.cursor/rules/*.mdc, .github/instructions/*.instructions.md, .claude/rules/*) que matcheen los archivos a tocar, y los skills/prompts on-demand que el modelo decidió invocar.",
      en: "Next, glob-scoped rules (.cursor/rules/*.mdc, .github/instructions/*, .claude/rules/*) that match the files being edited, plus any skills/prompts the model invoked on demand.",
    },
  },
  {
    id: "ctx-tools",
    at: 0.32,
    label: { es: "5. Tools + entorno", en: "5. Tools + env" },
    description: {
      es: "Los esquemas JSON de cada tool disponible y el contexto de runtime (cwd, branch, OS) se anexan al final. Sin esto el modelo no sabe qué puede llamar.",
      en: "The JSON schemas for every available tool plus runtime context (cwd, branch, OS) are appended last. Without this the model wouldn't know what it can call.",
    },
  },
  {
    id: "ctx-merged",
    at: 0.39,
    label: { es: "6. Prompt final", en: "6. Final prompt" },
    description: {
      es: "Todo lo anterior se concatena en un solo payload de mensajes. Ese payload — y nada más — es lo que recibe la API del LLM.",
      en: "Everything above is concatenated into a single messages payload. That payload — and nothing else — is what the LLM API receives.",
    },
  },
  {
    id: "inference",
    at: 0.44,
    label: { es: "7. Inferencia", en: "7. Inference" },
    description: {
      es: "El modelo decodifica tokens. Si decide que necesita una herramienta, emite un bloque structured tool_use en vez de texto libre.",
      en: "The model decodes tokens. If it decides it needs a tool, it emits a structured tool_use block instead of free text.",
    },
  },
  {
    id: "tool-intent",
    at: 0.48,
    label: { es: "8. Intención de tool_use", en: "8. tool_use intent" },
    description: {
      es: "El modelo todavía no ejecuta nada — sólo dice 'quiero llamar Edit con estos argumentos'. El harness es quien ejecuta.",
      en: "The model didn't run anything yet — it just said 'I want to call Edit with these args'. The harness is what executes.",
    },
  },
  {
    id: "pre-hook",
    at: 0.49,
    label: { es: "9. PreToolUse hook", en: "9. PreToolUse hook" },
    description: {
      es: "Antes de ejecutar, el harness corre tus hooks de PreToolUse. Reciben el JSON de la llamada por stdin y pueden permitir, mutar o denegar (exit 2). Acá es donde bloqueás cosas peligrosas como rm -rf o git push --force.",
      en: "Before executing, the harness runs your PreToolUse hooks. They receive the call JSON on stdin and can allow, mutate, or deny (exit 2). This is where you block dangerous things like rm -rf or git push --force.",
    },
  },
  {
    id: "tool-exec",
    at: 0.62,
    label: { es: "10. Ejecución de la tool", en: "10. Tool execution" },
    description: {
      es: "El harness ejecuta la herramienta en sandbox: aplica el Edit, corre el comando, hace el fetch. Captura stdout, stderr y exit code. Los errores no son excepciones — vuelven como tool_result.",
      en: "The harness runs the tool in a sandbox: applies the Edit, runs the command, makes the fetch. It captures stdout, stderr and exit code. Errors are not exceptions — they come back as tool_result.",
    },
  },
  {
    id: "post-hook",
    at: 0.69,
    label: { es: "11. PostToolUse hook", en: "11. PostToolUse hook" },
    description: {
      es: "Tras la ejecución corren tus hooks de PostToolUse: lint, format, typecheck, audit. Si fallan pueden devolver feedback al modelo, que lo ve como mensaje y reacciona — esta es la parte que hace que el agente 'aprenda' de sus propios errores.",
      en: "After execution, your PostToolUse hooks run: lint, format, typecheck, audit. If they fail they can return feedback to the model, which sees it as a message and reacts — this is what makes the agent 'learn' from its own mistakes.",
    },
  },
  {
    id: "result-back",
    at: 0.74,
    label: { es: "12. Tool result al modelo", en: "12. Tool result fed back" },
    description: {
      es: "El resultado se agrega como un nuevo mensaje del rol tool. El loop arranca de nuevo desde el paso 5 con este turno extra de contexto.",
      en: "The result is appended as a new tool-role message. The loop restarts from step 5 with this extra context turn.",
    },
  },
  {
    id: "answer",
    at: 0.86,
    label: { es: "13. Respuesta final", en: "13. Final answer" },
    description: {
      es: "Cuando el modelo no necesita más herramientas, emite texto. El harness lo streamea token a token al chat y termina el turno.",
      en: "When the model needs no more tools, it emits text. The harness streams it token-by-token to the chat and ends the turn.",
    },
  },
];

function within(p: number, a: number, b: number) {
  return p >= a && p <= b;
}

// Cards inject sequentially by slot so no two slots are ever crowded onscreen
// at the same time. Each slot has a 0.04-progress window:
//   slot 0 (top):    0.16 → 0.22
//   slot 1 (middle): 0.22 → 0.28
//   slot 2 (bottom): 0.28 → 0.34
// All 'merged' content stays accumulated in the orb (which keeps growing).
function getCardTiming(slot: number) {
  const base = 0.16 + slot * 0.06;
  return {
    enter: base,
    settle: base + 0.025,
    converge: base + 0.05,
  };
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
  const [focusedCard, setFocusedCard] = useState<string | null>(null);
  const [stagePanelOpen, setStagePanelOpen] = useState(false);
  const outputPanelRef = useRef<HTMLDivElement>(null);
  const outputContentRef = useRef<HTMLDivElement>(null);
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
  // Cards now cluster vertically around the orb (which sits between input
  // and output panels) instead of spreading across the whole chat height.
  const verticalUnit = isMobile ? 70 : 80;
  const orbGap = isMobile ? 110 : 160; // space between input and output panels (orb lives here)

  // Manual scroll-progress tracker. More robust than framer-motion's
  // useScroll on Lenis + sticky setups (which logs the
  // 'non-static position' warning and sometimes never updates in
  // production builds with React 19).
  const scrollYProgress = useMotionValue(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const compute = () => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      if (total <= 0) {
        scrollYProgress.set(0);
        setProgress(0);
        return;
      }
      const p = Math.max(0, Math.min(1, -rect.top / total));
      scrollYProgress.set(p);
      setProgress(p);
    };
    compute();
    window.addEventListener("scroll", compute, { passive: true });
    window.addEventListener("resize", compute);
    return () => {
      window.removeEventListener("scroll", compute);
      window.removeEventListener("resize", compute);
    };
  }, [scrollYProgress]);

  useMotionValueEvent(scrollYProgress, "change", (v) => setProgress(v));

  // Auto-scroll the OutputPanel content to its bottom whenever new beats
  // arrive (tool_use, pre-hook, diff, post-hook, assistant) so the latest
  // line is always visible without the playback controls covering it.
  useEffect(() => {
    const el = outputContentRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [
    progress > W.toolCallShow,
    progress > W.preHookFlash,
    progress > W.toolStreamStart,
    progress > W.toolStreamEnd,
    progress > W.postHook,
    progress > W.assistantStart,
  ]);

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

  // Animates the scroll from current position to a specific target
  // progress (0..1 within the cinematic), then auto-stops. Used by
  // step nav and the play button — every action is "play to next
  // beat", not "play to end".
  const playToProgress = (targetProgress: number) => {
    if (!containerRef.current) return;
    stopPlay();
    const rect = containerRef.current.getBoundingClientRect();
    const sectionTop = window.scrollY + rect.top;
    const total = rect.height - window.innerHeight;
    if (total <= 0) return;
    const toY = sectionTop + targetProgress * total;
    const fromY = window.scrollY;
    const distance = Math.abs(toY - fromY);
    if (distance < 2) return;
    // Pixels-per-second-ish pace: 1 step (~6% of section height) lands
    // in ~2.4s. Clamp to a comfortable range.
    const duration = Math.max(900, Math.min(4000, (distance / total) * 30000));
    setPlaying(true);
    playStartRef.current = { ts: performance.now(), fromY, toY };

    const tick = (now: number) => {
      const s = playStartRef.current;
      if (!s) return;
      const k = Math.min(1, (now - s.ts) / duration);
      // easeInOutCubic
      const eased = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      window.scrollTo(0, s.fromY + (s.toY - s.fromY) * eased);
      if (k >= 1) {
        stopPlay();
        return;
      }
      playRafRef.current = requestAnimationFrame(tick);
    };
    playRafRef.current = requestAnimationFrame(tick);
  };

  // Play button now means: play forward to the NEXT anchor only.
  const startPlay = () => {
    const next = STAGES.find((a) => a.at > progress + 0.005);
    if (next) {
      playToProgress(next.at);
    } else {
      // Already past the last anchor — play to the very end of the section
      playToProgress(1.0);
    }
  };

  const resetToTop = () => {
    playToProgress(0);
  };

  const stepNext = () => {
    const next = STAGES.find((a) => a.at > progress + 0.005);
    if (next) playToProgress(next.at);
  };
  const stepPrev = () => {
    const prev = [...STAGES].reverse().find((a) => a.at < progress - 0.005);
    if (prev) playToProgress(prev.at);
    else playToProgress(0);
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

  // Keyboard navigation: ←/→ to step prev/next, Space to play/pause
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Only handle when the cinematic section is at least partially in viewport
      const el = containerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const inView = r.bottom > 0 && r.top < window.innerHeight;
      if (!inView) return;
      // Ignore when typing in any input
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === "ArrowRight") {
        e.preventDefault();
        stepNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        stepPrev();
      } else if (e.key === " ") {
        e.preventDefault();
        playing ? stopPlay() : startPlay();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, playing]);

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
      style={{ height: "380vh" }}
    >
      {/* Sticky stage */}
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        {/* Parallax background layers */}
        <Stars yShift={bgShift} />
        <ParallaxOrb x={drift1} color="#a78bfa" top="6%" left="-4%" size={620} blur={70} opacity={0.55} />
        <ParallaxOrb x={drift2} color="#22d3ee" top="58%" left="72%" size={520} blur={70} opacity={0.5} />
        <ParallaxOrb x={drift3} color="#f472b6" top="38%" left="42%" size={380} blur={55} opacity={0.4} />
        <FloatingTokens />

        {/* Agent selector — top-center, always visible. Headline removed
            entirely — caused recurring overlap complaints and the AGENT
            selector + StagePanel already convey 'what is this'. */}
        <div
          className="absolute top-3 left-1/2 -translate-x-1/2 z-50 pointer-events-auto"
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

        {/* Stage info — top-left, COLLAPSED by default (just a pill) so it
            never covers the floating context cards on the left. Click the
            pill to read the full description. */}
        <StagePanel
          stage={currentStage}
          stageIndex={STAGES.findIndex((s) => s.id === currentStage.id)}
          total={STAGES.length}
          agent={agent}
          lang={i18nLang}
          open={stagePanelOpen}
          setOpen={setStagePanelOpen}
        />

        {/* Playback controls — bottom-left, separate from the stage info */}
        <PlaybackBar
          progress={progress}
          playing={playing}
          onPlay={() => (playing ? stopPlay() : startPlay())}
          onPrev={stepPrev}
          onNext={stepNext}
          onReset={resetToTop}
        />

        {/* 3D camera-tilted stage. Top-aligned (with padding for the
            agent-selector header) so the otherwise-empty space ABOVE the
            orb is now used by the InputPanel — less wasted real estate,
            less scrolling needed to traverse the section. */}
        <motion.div
          className="absolute inset-0 flex items-start justify-center pt-16 md:pt-20"
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
            {/* Convergence orb in the gap between input & output panels */}
            <ConvergenceOrb
              progress={progress}
              cards={visibleCards}
              orbGap={orbGap}
            />

            {/* Floating context cards — clustered around the orb's vertical zone */}
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
                focused={focusedCard === card.key}
                onFocus={() =>
                  setFocusedCard((prev) => (prev === card.key ? null : card.key))
                }
              />
            ))}
            {/* Injection arrows from cards to the convergence orb */}
            {!isMobile && <InjectionArrows
              cards={visibleCards}
              progress={progress}
              converging={ctxConverging}
              lateralUnit={lateralUnit}
              verticalUnit={verticalUnit}
              orbGap={orbGap}
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

            {/* Stack: TitleBar → InputPanel → ORB GAP → OutputPanel.
                The orb lives in the gap, in CLEAR space, so its
                connections (arrows in / beam out) are fully visible. */}
            <div
              className="relative z-30 mx-auto flex flex-col items-stretch"
              style={{ width: chatWidth }}
            >
              {/* INPUT PANEL — user message only */}
              <motion.div
                className="rounded-2xl overflow-hidden"
                style={{
                  background: "rgba(15,15,22,0.65)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  boxShadow: "0 30px 60px -20px rgba(0,0,0,0.6)",
                }}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7 }}
              >
                <div className="px-4 py-2 border-b border-white/5 mono text-[10px] uppercase tracking-wider text-white/45 flex items-center justify-between">
                  <span>input · turno user</span>
                  <span className="text-white/30">→ va al modelo</span>
                </div>
                <div className="px-5 py-4 min-h-[64px] flex items-start gap-3">
                  {progress < W.bootEnd ? (
                    <span className="mono text-xs text-white/40 animate-pulse">
                      {t.initBoot}
                    </span>
                  ) : progress > W.userTypeStart ? (
                    <>
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
                    </>
                  ) : (
                    <span className="mono text-[11px] text-white/30">
                      esperando input…
                    </span>
                  )}
                </div>
              </motion.div>

              {/* ORB GAP — clear space where the convergence orb lives.
                  Cards float around it, arrows funnel in, beam shoots
                  down to the OutputPanel below. */}
              <div style={{ height: orbGap }} />

              {/* OUTPUT PANEL — tool_use, diff, hooks, assistant message.
                  The crystallize beam from the orb terminates at the top
                  edge of this panel (its containing block), giving the
                  beam a specific endpoint. */}
              <motion.div
                ref={outputPanelRef}
                className="rounded-2xl overflow-hidden relative"
                style={{
                  background: "rgba(15,15,22,0.7)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  boxShadow: "0 40px 80px -25px rgba(0,0,0,0.7)",
                  minHeight: 220,
                  maxHeight: isMobile ? 240 : 300,
                  display: "flex",
                  flexDirection: "column",
                }}
                initial={{ opacity: 0, y: 30 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  boxShadow: ctxConverging
                    ? [
                        "0 40px 80px -25px rgba(0,0,0,0.7), 0 0 0 1px rgba(167,139,250,0.5) inset",
                        "0 40px 80px -25px rgba(0,0,0,0.7), 0 0 0 2px rgba(34,211,238,0.6) inset",
                        "0 40px 80px -25px rgba(0,0,0,0.7), 0 0 0 1px rgba(244,114,182,0.5) inset",
                      ]
                    : "0 40px 80px -25px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06) inset",
                }}
                transition={
                  ctxConverging
                    ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" }
                    : { duration: 0.9, delay: 0.15 }
                }
              >
                <div className="px-4 py-2 border-b border-white/5 mono text-[10px] uppercase tracking-wider text-white/45 flex items-center justify-between shrink-0">
                  <span>output · respuesta del agente</span>
                  <span className="text-white/30">← del modelo</span>
                </div>
                <div
                  ref={outputContentRef}
                  className="px-5 py-4 flex flex-col gap-4 overflow-y-auto flex-1"
                  data-lenis-prevent
                >
                  {!showToolCall && progress < W.assistantStart && (
                    <div className="mono text-[11px] text-white/30 py-3">
                      {progress < W.toolCallShow
                        ? "esperando que el modelo responda…"
                        : ""}
                    </div>
                  )}

                  <AnimatePresence>
                    {showToolCall && (
                      <motion.div
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="flex gap-3 items-start"
                      >
                        <Bubble color="#a78bfa" icon={<Sparkles size={14} />} />
                        <div className="flex-1 space-y-2 min-w-0">
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
  "new_string": "## [2.4.0] - …"
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
            </div>
          </motion.div>
        </motion.div>

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
  focused,
  onFocus,
}: {
  card: CtxCard;
  progress: number;
  converging: boolean;
  lateralUnit: number;
  verticalUnit: number;
  cardWidth: number;
  isMobile: boolean;
  focused: boolean;
  onFocus: () => void;
}) {
  const { t, lang } = useLang();
  const data = {
    label: pickLang(card.label, lang),
    source: pickLang(card.source, lang),
    body: pickLang(card.body, lang),
  };

  const timing = getCardTiming(card.slot);
  const entryT = (progress - timing.enter) / (timing.settle - timing.enter);
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

  if (progress < timing.enter) {
    opacity = 0;
  } else if (progress < timing.settle) {
    opacity = ease;
    x = (sign * (lateralUnit + 220)) * (1 - ease) + xFinal * ease;
    y = (yFinal + 50) * (1 - ease) + yFinal * ease;
    zVal = (z - 240) * (1 - ease) + z * ease;
    rY = rotY * 1.6 * (1 - ease) + rotY * ease;
    scale = 0.85 + 0.15 * ease;
  } else if (progress < timing.converge) {
    const drift = Math.sin((progress - timing.settle) * 24) * 5;
    opacity = 1;
    x = xFinal;
    y = yFinal + drift;
    zVal = z;
    rY = rotY;
    scale = 1;
  } else {
    const cT = Math.min(1, (progress - timing.converge) / 0.03);
    opacity = 1 - cT;
    x = xFinal * (1 - cT);
    y = yFinal * (1 - cT);
    zVal = z * (1 - cT);
    rY = rotY * (1 - cT);
    scale = 1 - 0.4 * cT;
    blur = cT * 6;
  }

  // When focused (clicked/tapped) the card is pinned to the front, big,
  // unrotated and unblurred so it can be read fully on touch devices.
  const finalAnimate = focused
    ? {
        opacity: 1,
        x: 0,
        y: 0,
        z: 120,
        rotateY: 0,
        scale: 1.25,
        filter: "blur(0px)",
      }
    : { opacity, x, y, z: zVal, rotateY: rY, scale, filter: blur ? `blur(${blur}px)` : "blur(0px)" };

  return (
    <motion.div
      className="absolute top-1/2 left-1/2 pointer-events-auto cursor-pointer"
      style={{
        width: cardWidth,
        marginLeft: -cardWidth / 2,
        marginTop: -80,
        transformStyle: "preserve-3d",
        zIndex: focused ? 70 : 10 - card.slot,
      }}
      onClick={onFocus}
      animate={finalAnimate}
      transition={{ duration: focused ? 0.35 : 0.15, ease: focused ? "easeOut" : "linear" }}
      whileHover={
        focused
          ? undefined
          : {
              scale: scale * 1.08,
              z: 80,
              rotateY: 0,
              zIndex: 60,
              filter: "blur(0px)",
              transition: { duration: 0.25 },
            }
      }
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
  open,
  setOpen,
}: {
  stage: Stage;
  stageIndex: number;
  total: number;
  agent: { name: string; modelLabel: string; supportsHooks: boolean; hooksNote: { es: string; en: string } };
  lang: string;
  open: boolean;
  setOpen: (b: boolean) => void;
}) {
  const isHookStage = stage.id === "pre-hook" || stage.id === "post-hook";
  const noHooksNote =
    isHookStage && !agent.supportsHooks
      ? agent.hooksNote[(lang as "es" | "en") || "es"]
      : null;
  // Fixed-width panel; the body just shows or hides — no animated width or
  // height that would make the description text 'shrink' as scroll
  // changes the active stage.
  return (
    <div
      className="absolute top-20 left-4 md:left-6 z-50 pointer-events-auto"
      style={{ width: open ? 320 : "auto" }}
    >
      <div className="glass rounded-2xl overflow-hidden">
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 transition cursor-pointer"
        >
          <div className="shrink-0 flex flex-col items-center justify-center w-10 h-10 rounded-lg bg-white/5 border border-white/10">
            <span className="mono text-[8px] uppercase tracking-wider text-white/45 leading-none">
              stage
            </span>
            <span className="text-sm font-semibold text-white leading-none mt-0.5">
              {stageIndex + 1}
            </span>
          </div>
          {open ? (
            <>
              <div className="flex-1 min-w-0 text-left">
                <div className="text-[13px] font-semibold text-white truncate">
                  {stage.label[(lang as "es" | "en") || "es"]}
                </div>
                <div className="mono text-[10px] text-white/45 truncate">
                  {stageIndex + 1}/{total} · {agent.name}
                </div>
              </div>
              <span className="mono text-[12px] text-white/40 shrink-0 px-1">×</span>
            </>
          ) : (
            <span className="mono text-[12px] text-white/40 shrink-0 pr-1">›</span>
          )}
        </button>

        {open && (
          <div className="px-3 pb-2 pt-1 border-t border-white/5">
            <p className="text-[12px] text-white/70 leading-relaxed min-h-[60px]">
              {stage.description[(lang as "es" | "en") || "es"]}
            </p>
            {noHooksNote && (
              <div className="mt-2 px-2.5 py-1.5 rounded-md border border-amber-400/30 bg-amber-500/10 text-amber-200 mono text-[10.5px] leading-snug">
                ⚠ {noHooksNote}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

function PlaybackBar({
  progress,
  playing,
  onPlay,
  onPrev,
  onNext,
  onReset,
}: {
  progress: number;
  playing: boolean;
  onPlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onReset: () => void;
}) {
  return (
    <div className="absolute bottom-4 left-4 z-50 pointer-events-auto">
      <div className="glass rounded-full px-2 py-1.5 flex items-center gap-1.5">
        <button
          onClick={onPrev}
          className="h-9 w-9 rounded-full hover:bg-white/10 text-white/80 flex items-center justify-center transition"
          aria-label="previous step"
          title="anterior (←)"
        >
          <ChevronLeft size={15} />
        </button>
        <button
          onClick={onPlay}
          className="h-9 w-9 rounded-full bg-white text-black flex items-center justify-center hover:bg-white/90 transition"
          aria-label={playing ? "pause" : "play next"}
          title={playing ? "pausar (espacio)" : "siguiente (espacio)"}
        >
          {playing ? <Pause size={13} /> : <Play size={13} />}
        </button>
        <button
          onClick={onNext}
          className="h-9 w-9 rounded-full hover:bg-white/10 text-white/80 flex items-center justify-center transition"
          aria-label="next step"
          title="siguiente (→)"
        >
          <ChevronRight size={15} />
        </button>
        <button
          onClick={onReset}
          className="h-9 w-9 rounded-full hover:bg-white/10 text-white/70 flex items-center justify-center transition"
          aria-label="reset"
          title="reiniciar"
        >
          <RotateCcw size={13} />
        </button>
        <div className="w-24 mx-1 h-1 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full"
            style={{
              width: `${progress * 100}%`,
              background: "linear-gradient(90deg,#a78bfa,#22d3ee,#f472b6)",
            }}
          />
        </div>
        <span className="mono text-[10px] text-white/55 shrink-0 px-1">
          {Math.round(progress * 100)}%
        </span>
      </div>
    </div>
  );
}

function ConvergenceOrb({
  progress,
  cards,
  orbGap,
}: {
  progress: number;
  cards: CtxCard[];
  orbGap: number;
}) {
  // Orb fills with energy as cards settle; pulses extra during the
  // converge moment; shoots a vertical beam into the chat once
  // inference begins. The beam continues every time tool_result
  // is fed back, hinting that "everything funnels through here."

  // Buildup grows monotonically as each card finishes its slot's converge
  // (i.e. has been merged into the orb).
  const reached = cards.filter((c) => {
    const t = getCardTiming(c.slot);
    return progress >= t.converge;
  }).length;
  const totalCards = cards.length || 1;
  const buildup = Math.min(1, reached / totalCards);

  const isConverging = progress > 0.34 && progress < 0.42;
  const isInference = progress > 0.42 && progress < 0.46;
  const isPostMerge = progress > 0.36;
  const isAnswerStream = progress > 0.74 && progress < 0.94;

  // Color stops mix from cards' rule colors as buildup grows
  const colors = cards.slice(0, 4).map((c) => c.ruleColor);
  while (colors.length < 4) colors.push("#a78bfa");

  const baseSize = 26;
  const size =
    baseSize + buildup * 30 + (isConverging ? 20 : 0) + (isInference ? 10 : 0);

  // Orb sits in the visual MIDDLE of the orbGap (between InputPanel and
  // OutputPanel) — using the actual gap, not the stack center, otherwise
  // when OutputPanel is taller than InputPanel the orb drifts downward
  // and leaves wasted space between InputPanel and orb.
  const inputPanelHeight = 100; // header + padding + bubble
  const orbY = inputPanelHeight + orbGap / 2;
  return (
    <div
      className="absolute left-1/2 z-45 pointer-events-none"
      style={{
        top: orbY,
        transform: "translate(-50%, -50%)",
      }}
    >
      {/* Outer glow halo (clipped to keep it from leaking into panels) */}
      <motion.div
        className="absolute rounded-full"
        style={{
          left: -size * 1.1,
          top: -size * 1.1,
          width: size * 2.2,
          height: size * 2.2,
          background: `radial-gradient(circle, ${colors[0]}55, ${colors[1]}33 40%, transparent 70%)`,
          filter: "blur(10px)",
        }}
        animate={{
          opacity: isPostMerge ? 0.95 : 0.45 + buildup * 0.4,
          scale: isConverging ? [1, 1.4, 1.1] : 1,
        }}
        transition={
          isConverging
            ? { duration: 1.4, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0.5 }
        }
      />

      {/* Core orb */}
      <motion.div
        className="absolute rounded-full"
        style={{
          left: -size / 2,
          top: -size / 2,
          width: size,
          height: size,
          background: `conic-gradient(from 0deg, ${colors[0]}, ${colors[1]}, ${colors[2]}, ${colors[3]}, ${colors[0]})`,
          boxShadow: `0 0 ${size}px ${colors[0]}aa, 0 0 ${size * 0.5}px ${colors[1]}88`,
        }}
        animate={{
          rotate: 360,
          scale: isConverging ? [1, 1.2, 1] : 1,
        }}
        transition={{
          rotate: { duration: 8, repeat: Infinity, ease: "linear" },
          scale: isConverging
            ? { duration: 0.9, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0.4 },
        }}
      />

      {/* Inner glassy core */}
      <motion.div
        className="absolute rounded-full"
        style={{
          left: -size * 0.32,
          top: -size * 0.32,
          width: size * 0.64,
          height: size * 0.64,
          background:
            "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.95), rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.05) 80%)",
        }}
        animate={{ opacity: isPostMerge ? [0.8, 1, 0.8] : 0.6 }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Stage label tag below the orb */}
      <motion.div
        className="absolute mono text-[10px] uppercase tracking-wider whitespace-nowrap"
        style={{
          left: -90,
          top: size + 14,
          width: 180,
          textAlign: "center",
          color: isPostMerge ? "#fff" : "rgba(255,255,255,0.5)",
        }}
        animate={{ opacity: buildup > 0.3 ? 1 : 0.5 }}
      >
        prompt al modelo
      </motion.div>

      {/* Crystallize beam — orb shoots DOWN to the OutputPanel top edge.
          Specific endpoint = a subtle landing flare so it's clear where
          the beam terminates. */}
      <AnimatePresence>
        {(isInference || isAnswerStream) && (
          <>
            <motion.div
              initial={{ opacity: 0, scaleY: 0 }}
              animate={{ opacity: 1, scaleY: 1 }}
              exit={{ opacity: 0 }}
              className="absolute"
              style={{
                left: -3,
                top: 0,
                height: orbGap / 2,
                width: 6,
                background:
                  "linear-gradient(to bottom, rgba(255,255,255,0.95), rgba(167,139,250,0.7) 30%, rgba(34,211,238,0.45) 60%, rgba(34,211,238,0))",
                transformOrigin: "top",
                filter: "blur(0.4px)",
                borderRadius: 3,
              }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
            {/* Landing flare at the OutputPanel top edge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: [0, 1, 0.85], scale: [0.4, 1.3, 1] }}
              exit={{ opacity: 0 }}
              className="absolute rounded-full"
              style={{
                left: -16,
                top: orbGap / 2 - 16,
                width: 32,
                height: 32,
                background:
                  "radial-gradient(circle, rgba(255,255,255,0.95), rgba(167,139,250,0.5) 40%, transparent 70%)",
                filter: "blur(2px)",
              }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </>
        )}
      </AnimatePresence>

      {/* Reverse pulse: tool_result coming back into the orb */}
      <AnimatePresence>
        {progress > 0.72 && progress < 0.78 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: [0, 0.9, 0], scale: [0.4, 2.4, 3.5] }}
            exit={{ opacity: 0 }}
            className="absolute rounded-full border-2"
            style={{
              left: -size,
              top: -size,
              width: size * 2,
              height: size * 2,
              borderColor: "#34d399",
            }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function InjectionArrows({
  cards,
  progress,
  converging,
  lateralUnit,
  verticalUnit,
  orbGap,
}: {
  cards: CtxCard[];
  progress: number;
  converging: boolean;
  lateralUnit: number;
  verticalUnit: number;
  orbGap: number;
}) {
  // SVG canvas centered over stage. Arrows converge into the orb at its
  // actual position (middle of the orbGap), not at the stage's geometric
  // center.
  const W = 1300;
  const H = 800;
  const cx = W / 2;
  const cy = H / 2;
  const orbX = cx;
  const inputPanelHeight = 100;
  // Stage SVG is centered over the stage; we compute orb offset from
  // stage top (which equals stage center - stackHalf). Approximate
  // by using cy minus half of (output panel height - input panel
  // height) shift, but simpler: fixed offset corresponding to the
  // orb's same equation.
  const stackHalfApprox = (inputPanelHeight + orbGap + 260) / 2;
  const orbY = cy - stackHalfApprox + inputPanelHeight + orbGap / 2;
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
        const ct = getCardTiming(c.slot);
        const visible = progress > ct.settle && progress < ct.converge;
        if (!visible) return null;
        const { x, y, sign } = cardSlotPosition(c, lateralUnit, verticalUnit);
        // Card edge facing center (from where the line leaves the card)
        const cardEdgeX = cx + x - sign * 100;
        const cardY = cy + y + 30; // bottom-ish of the card body
        // Quadratic control point pulls the curve toward orb but with vertical
        // arc, so multiple lines from different slots feel like they're flowing
        // into one funnel rather than going straight.
        const ctrlX = (cardEdgeX + orbX) / 2 + sign * -40;
        const ctrlY = orbY - 100;
        const path = `M ${cardEdgeX} ${cardY} Q ${ctrlX} ${ctrlY}, ${orbX} ${orbY}`;
        const op = 1;
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
  // Restrict to the lower half of the viewport so they don't crowd the
  // top area where StagePanel / AgentSelector / lang toggle live.
  const items = useMemo(
    () =>
      TOKEN_LABELS.map((label, i) => {
        const top = 38 + ((i * 71) % 55);     // 38..93
        const left = ((i * 137) % 92) + 3;     // 3..95
        const dur = 14 + (i % 6) * 3;
        const delay = (i % 7) * 1.4;
        const drift = 12 + (i % 5) * 5;
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
