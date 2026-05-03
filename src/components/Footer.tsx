"use client";

import { ExternalLink } from "lucide-react";
import { useLang } from "@/lib/i18n";

export default function Footer() {
  const { t } = useLang();
  return (
    <footer className="border-t border-white/5 mt-12">
      <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-white/50">
        <div>{t.footerBuilt}</div>
        <div className="flex items-center gap-4">
          <a
            href="https://github.com/JorgeTricarico/how-agents-work"
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
