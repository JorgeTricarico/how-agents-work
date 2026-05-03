"use client";

import { motion } from "framer-motion";

export default function Background() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 grid-bg radial-fade opacity-60" />
      <motion.div
        className="absolute -top-40 left-1/2 h-[700px] w-[1100px] -translate-x-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(closest-side, rgba(167,139,250,0.35), rgba(34,211,238,0.12) 50%, transparent 75%)",
          filter: "blur(40px)",
        }}
        animate={{ x: ["-50%", "-48%", "-52%", "-50%"], y: [0, 18, -10, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-[-20%] right-[-10%] h-[600px] w-[800px] rounded-full"
        style={{
          background:
            "radial-gradient(closest-side, rgba(244,114,182,0.18), transparent 70%)",
          filter: "blur(50px)",
        }}
        animate={{ y: [0, -30, 20, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}
