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
} from "lucide-react";
import { useLang } from "@/lib/i18n";

/* ──────────────────────────────────────────────────────────
   Scroll-driven cinematic.
   The section is 500vh tall. Inside, a sticky stage stays
   pinned to the viewport. Scroll progress 0..1 drives every
   beat (typing, card flights, hooks, streams, response).
   Camera also tilts subtly with progress for a 3D feel.
   ────────────────────────────────────────────────────────── */

type CtxCard = {
  id: "system" | "claude" | "tools" | "env";
  side: "left" | "right";
  depth: number;
  enter: number;
  settle: number;
  converge: number;
  yFactor: number; // multiplied by viewport-based unit
};

const CARDS: CtxCard[] = [
  { id: "system", side: "left",  depth: 0, enter: 0.18, settle: 0.26, converge: 0.34, yFactor: -1.4 },
  { id: "claude", side: "right", depth: 0, enter: 0.20, settle: 0.28, converge: 0.34, yFactor: -1.4 },
  { id: "tools",  side: "left",  depth: 1, enter: 0.22, settle: 0.30, converge: 0.34, yFactor:  0.4 },
  { id: "env",    side: "right", depth: 1, enter: 0.24, settle: 0.32, converge: 0.34, yFactor:  0.4 },
];

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
  const { t } = useLang();
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const [vw, setVw] = useState(1024);
  useEffect(() => {
    const update = () => setVw(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  const isMobile = vw < 720;
  const cardWidth = isMobile ? 180 : 240;
  // Half of useful horizontal travel — cards fly from this distance to the side
  const lateralUnit = Math.min(440, Math.max(140, vw * 0.36));
  const verticalUnit = isMobile ? 90 : 110;

  // Manual scroll-progress: 0 when section top hits viewport top,
  // 1 when section bottom hits viewport bottom. Avoids framer-motion
  // useScroll quirks with non-static ancestors / Lenis.
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
    const duration = Math.max(8000, ((toY - fromY) / rect.height) * 50000);
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

  const showPreHook  = within(progress, W.preHookFlash, W.preHookFlash + 0.06);
  const showPostHook = within(progress, W.postHook, W.postHook + 0.06);
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

        {/* Top headline */}
        <div className="absolute top-0 inset-x-0 z-30 px-6 pt-16 text-center pointer-events-none">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass mono text-[11px] text-white/70"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            {t.cinemaBadge}
          </motion.div>
          <h1 className="mt-5 text-3xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
            {t.cinemaTitle1} <span className="gradient-text">{t.cinemaTitle2}</span>
            <br />
            <span className="text-white/60 text-xl md:text-2xl font-normal">
              {t.cinemaSubtitle}
            </span>
          </h1>
        </div>

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
            {CARDS.map((card) => (
              <Card3D
                key={card.id}
                card={card}
                progress={progress}
                converging={ctxConverging}
                lateralUnit={lateralUnit}
                verticalUnit={verticalUnit}
                cardWidth={cardWidth}
                isMobile={isMobile}
              />
            ))}

            {/* Convergence beam */}
            <AnimatePresence>
              {ctxConverging && <ConvergenceBeam />}
            </AnimatePresence>

            {/* Chat panel — center stage */}
            <motion.div
              className="relative z-30 mx-auto glass rounded-2xl overflow-hidden"
              style={{
                transformStyle: "preserve-3d",
                boxShadow:
                  "0 80px 160px -30px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.06) inset, 0 0 60px rgba(167,139,250,0.08)",
              }}
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
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
  "path": "src/components/Header.tsx",
  "old_string": "<nav>",
  "new_string": "<nav><ThemeToggle/>"
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
                          <div className="rounded-lg border border-cyan-400/30 bg-black/60 overflow-hidden">
                            <div className="px-3 py-1.5 border-b border-cyan-400/20 flex items-center gap-1.5 text-cyan-300 mono text-[10px] uppercase tracking-wide">
                              <Terminal size={11} /> {t.toolResult}
                            </div>
                            <div className="px-3 py-2 mono text-[12px] space-y-0.5">
                              {streamLines.map((l, i) => (
                                <motion.div
                                  key={i}
                                  initial={{ opacity: 0, x: -6 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  className="text-emerald-300/90"
                                >
                                  <span className="text-white/30">$</span> {l}
                                </motion.div>
                              ))}
                            </div>
                          </div>
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
        <div className="absolute bottom-6 inset-x-0 z-50 flex justify-center pointer-events-none">
          <div className="glass rounded-full px-2 py-1.5 flex items-center gap-1 pointer-events-auto">
            <button
              onClick={() => (playing ? stopPlay() : startPlay())}
              className="h-9 w-9 rounded-full bg-white text-black flex items-center justify-center hover:bg-white/90 transition"
              aria-label={playing ? "pause" : "play"}
            >
              {playing ? <Pause size={14} /> : <Play size={14} />}
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
  const { t } = useLang();
  const data = t.ctx[card.id];

  // Position along entry → settle → converge
  const entryT = (progress - card.enter) / (card.settle - card.enter);
  const ease = Math.min(1, Math.max(0, entryT));

  const sign = card.side === "left" ? -1 : 1;
  const xBase = sign * lateralUnit;
  const xOffset = sign * card.depth * (isMobile ? 14 : 36);
  const yOffset = card.yFactor * verticalUnit;
  const z = -120 - card.depth * 80;
  const rotY = sign * (isMobile ? 14 : 22);

  // animated values
  let opacity = 0;
  let x = card.side === "left" ? xBase * 1.6 : xBase * 1.6;
  let y = yOffset + 80;
  let zVal = z - 200;
  let rY = rotY * 1.6;
  let scale = 0.85;
  let blur = 0;

  if (progress < card.enter) {
    opacity = 0;
  } else if (progress < card.settle) {
    opacity = ease;
    x = (card.side === "left" ? xBase * 1.6 : xBase * 1.6) * (1 - ease) + (xBase + xOffset) * ease;
    y = (yOffset + 80) * (1 - ease) + yOffset * ease;
    zVal = (z - 200) * (1 - ease) + z * ease;
    rY = rotY * 1.6 * (1 - ease) + rotY * ease;
    scale = 0.85 + 0.15 * ease;
  } else if (progress < card.converge) {
    // gentle drift while settled
    const drift = Math.sin((progress - card.settle) * 30) * 6;
    opacity = 1;
    x = xBase + xOffset;
    y = yOffset + drift;
    zVal = z;
    rY = rotY;
    scale = 1;
  } else {
    // converging
    const cT = Math.min(1, (progress - card.converge) / 0.06);
    opacity = 1 - cT;
    x = (xBase + xOffset) * (1 - cT);
    y = yOffset * (1 - cT);
    zVal = z * (1 - cT) + 0 * cT;
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
        zIndex: 10 - card.depth,
      }}
      animate={{ opacity, x, y, z: zVal, rotateY: rY, scale, filter: blur ? `blur(${blur}px)` : "blur(0px)" }}
      transition={{ duration: 0.15, ease: "linear" }}
    >
      <div
        className="rounded-xl glass overflow-hidden"
        style={{
          boxShadow: `0 30px 60px -10px ${colorOf(card.id)}33, 0 0 0 1px ${colorOf(card.id)}33 inset`,
        }}
      >
        <div
          className="px-3 py-1.5 mono text-[10px] uppercase tracking-wide flex items-center justify-between border-b"
          style={{
            borderColor: `${colorOf(card.id)}33`,
            background: `${colorOf(card.id)}14`,
            color: colorOf(card.id),
          }}
        >
          <span className="flex items-center gap-1.5">
            <FileText size={10} /> {data.label}
          </span>
        </div>
        <pre className="px-3 py-2 mono text-[11px] text-white/75 whitespace-pre-wrap leading-relaxed">
          {data.body}
        </pre>
        <div className="px-3 py-1 mono text-[9px] text-white/35 border-t border-white/5">
          {data.source}
        </div>
      </div>
    </motion.div>
  );
}

function colorOf(id: CtxCard["id"]) {
  return id === "system"
    ? "#a78bfa"
    : id === "claude"
      ? "#22d3ee"
      : id === "tools"
        ? "#34d399"
        : "#fbbf24";
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
            <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
          </radialGradient>
        </defs>
        <motion.circle
          cx="550"
          cy="300"
          r="180"
          fill="url(#beam)"
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: [0.4, 1.5, 0.7], opacity: [0, 1, 0] }}
          transition={{ duration: 1.6, ease: "easeOut" }}
          style={{ transformOrigin: "550px 300px" }}
        />
      </svg>
    </motion.div>
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
