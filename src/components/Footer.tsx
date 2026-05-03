"use client";

import { ExternalLink } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-white/5 mt-12">
      <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-white/50">
        <div>
          built with Next 16 · React 19 · Framer Motion · Lenis
        </div>
        <div className="flex items-center gap-4">
          <a
            href="https://github.com"
            className="inline-flex items-center gap-2 hover:text-white transition"
          >
            <ExternalLink size={16} /> source
          </a>
          <span className="mono text-xs">© how-agents-work</span>
        </div>
      </div>
    </footer>
  );
}
