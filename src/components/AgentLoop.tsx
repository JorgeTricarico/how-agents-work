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
import { useLang } from "@/lib/i18n";

const STEP_META = [
  { id: "ctx", icon: <FileText size={22} />, color: "#a78bfa" },
  { id: "intent", icon: <ShieldAlert size={22} />, color: "#fbbf24" },
  { id: "exec", icon: <Wrench size={22} />, color: "#22d3ee" },
  { id: "post", icon: <CheckCircle size={22} />, color: "#34d399" },
  { id: "loop", icon: <Repeat size={22} />, color: "#f472b6" },
];

export default function AgentLoop() {
  const { t } = useLang();
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(true);

  const steps = t.loopSteps.map((s, i) => ({ ...s, ...STEP_META[i] }));

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setActive((p) => (p + 1) % steps.length), 6500);
    return () => clearInterval(id);
  }, [playing, steps.length]);

  const step = steps[active];

  return (
    <section
      id="loop"
      className="relative min-h-screen w-full px-6 py-24 flex flex-col items-center"
    >
      <div className="max-w-6xl w-full">
        <Header
          eyebrow={t.loopEyebrow}
          title={t.loopTitle}
          subtitle={t.loopSubtitle}
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
                            {t.loopRunning}
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
                {playing ? t.loopPause : t.loopAuto}
              </button>
              <button
                onClick={() => setActive((p) => (p + 1) % steps.length)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-sm hover:bg-white/10 transition"
              >
                {t.loopNext}
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
                    <Stat label={t.cost} value={fakeCost(active)} />
                    <Stat label={t.tokens} value={fakeTokens(active)} />
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
