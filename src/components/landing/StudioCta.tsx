"use client";

import { useState } from "react";
import Link from "next/link";
import { TypographicWall } from "@/components/ui/typographic-wall";

export function StudioCta() {
  const [copied, setCopied] = useState(false);
  const curlCommand = `curl -X POST http://localhost:8000/analyze -F "file=@exhibit.jpg"`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(curlCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="relative overflow-hidden bg-[#030508] py-24 sm:py-32 border-t border-white/10">
      {/* Background Typographic Wall Scramble Matrix */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
        <TypographicWall rows={10} />
      </div>

      {/* Radial Center Glow */}
      <div className="absolute inset-0 bg-radial from-[#0099ff]/10 via-transparent to-transparent pointer-events-none" />

      <div className="relative mx-auto max-w-5xl px-5 sm:px-8 text-center">
        {/* Monospace Indicator Tag */}
        <div className="inline-flex items-center gap-2 border border-[#0099ff]/40 bg-[#0099ff]/10 px-3 py-1 rounded font-mono text-[11px] font-medium tracking-wider text-[#38bdf8] uppercase">
          <span className="h-1.5 w-1.5 rounded-full bg-[#0099ff] animate-ping" />
          <span>Interactive Evidence Workbench</span>
        </div>

        <h2 className="mt-5 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
          Examine Your First Exhibit Now
        </h2>

        <p className="mt-4 mx-auto max-w-2xl text-[16px] leading-relaxed text-slate-400">
          Upload any identity document, financial invoice, certificate, or photograph. Inspect 11 forensic
          layers in parallel with full pixel-level explainability.
        </p>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/analyze"
            className="group inline-flex items-center gap-2.5 rounded-lg bg-[#0099ff] px-7 py-4 text-[15px] font-medium text-white shadow-[0_0_30px_rgba(0,153,255,0.45)] transition-all duration-300 hover:bg-[#0088ee] hover:shadow-[0_0_40px_rgba(0,153,255,0.65)]"
          >
            <span>Launch Analysis Workbench</span>
            <svg
              viewBox="0 0 16 16"
              className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M3 8h10M9 4l4 4-4 4" />
            </svg>
          </Link>

          <Link
            href="/cases"
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#0B0F17] px-6 py-4 text-[15px] font-medium text-slate-300 transition-all duration-300 hover:border-white/25 hover:text-white hover:bg-[#111622]"
          >
            <span>Browse Case Register</span>
          </Link>
        </div>

        {/* cURL API Direct Execution Box */}
        <div className="mt-12 mx-auto max-w-xl rounded-xl border border-white/10 bg-[#060911]/90 p-4 font-mono text-left shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between pb-2 border-b border-white/5 text-[10px] text-slate-500">
            <span>TERMINAL API INTAKE</span>
            <button
              type="button"
              onClick={copyToClipboard}
              className="text-[#38bdf8] hover:text-white transition-colors"
            >
              {copied ? "COPIED TO CLIPBOARD ✓" : "COPY CURL COMMAND"}
            </button>
          </div>
          <div className="mt-2 text-[12px] text-slate-300 select-all overflow-x-auto whitespace-nowrap">
            <span className="text-emerald-400">$ </span>
            {curlCommand}
          </div>
        </div>

        {/* Monospace Footer Telemetry */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-6 font-mono text-[11px] text-slate-500">
          <span>SHA-256 AUDIT LOG</span>
          <span>·</span>
          <span>DETERMINISTIC INFERENCE</span>
          <span>·</span>
          <span>JSON / PDF DOSSIER</span>
        </div>
      </div>
    </section>
  );
}
