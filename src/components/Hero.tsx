"use client";

import { motion } from "framer-motion";
import { Sparkles, ArrowDown } from "lucide-react";

const orbits = [
  { label: "AGENTS.md", color: "#a78bfa", r: 180, dur: 22, delay: 0 },
  { label: "CLAUDE.md", color: "#22d3ee", r: 180, dur: 22, delay: -7 },
  { label: ".cursorrules", color: "#f472b6", r: 180, dur: 22, delay: -14 },
  { label: "system prompt", color: "#fbbf24", r: 260, dur: 30, delay: 0 },
  { label: "tools.json", color: "#34d399", r: 260, dur: 30, delay: -10 },
  { label: "hooks", color: "#f87171", r: 260, dur: 30, delay: -20 },
  { label: "tool_result", color: "#60a5fa", r: 340, dur: 38, delay: 0 },
  { label: "user msg", color: "#c084fc", r: 340, dur: 38, delay: -19 },
];

export default function Hero() {
  return (
    <section className="relative min-h-screen w-full flex flex-col items-center justify-center px-6 overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative h-[720px] w-[720px]">
          <motion.div
            className="absolute inset-0 m-auto h-28 w-28 rounded-3xl glass flex items-center justify-center"
            animate={{ scale: [1, 1.06, 1], rotate: [0, 4, -4, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            style={{ boxShadow: "0 0 80px rgba(167,139,250,0.4)" }}
          >
            <div className="absolute inset-0 rounded-3xl shimmer" />
            <Sparkles className="text-white relative z-10" size={36} />
          </motion.div>

          {[180, 260, 340].map((r) => (
            <div
              key={r}
              className="absolute inset-0 m-auto rounded-full border border-white/5"
              style={{ width: r * 2, height: r * 2 }}
            />
          ))}

          {orbits.map((o, i) => (
            <div
              key={i}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{
                width: 0,
                height: 0,
                animation: `orbit ${o.dur}s linear ${o.delay}s infinite`,
                ["--r" as string]: `${o.r}px`,
              }}
            >
              <div
                className="token-pill whitespace-nowrap"
                style={{
                  background: `${o.color}1a`,
                  borderColor: `${o.color}55`,
                  color: o.color,
                  boxShadow: `0 0 20px ${o.color}33`,
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: o.color }}
                />
                {o.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="relative z-10 max-w-5xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full glass text-xs mono text-white/70"
        >
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          interactive · animated · 2026
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.1 }}
          className="text-5xl md:text-7xl lg:text-8xl font-semibold tracking-tight leading-[0.95]"
        >
          How <span className="gradient-text">AI coding agents</span>
          <br /> actually work
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.3 }}
          className="mt-6 text-lg md:text-xl text-white/60 max-w-2xl mx-auto"
        >
          A live, animated tour of how Claude Code, Cursor, Copilot and friends
          assemble their context, call tools, and iterate behind every keystroke.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.5 }}
          className="mt-10 flex flex-col items-center gap-3"
        >
          <a
            href="#loop"
            className="group inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-black font-medium hover:bg-white/90 transition"
          >
            Start the tour
            <ArrowDown
              size={18}
              className="group-hover:translate-y-0.5 transition-transform"
            />
          </a>
          <span className="text-xs text-white/40 mono">
            scroll · or click to dive in
          </span>
        </motion.div>
      </div>
    </section>
  );
}
