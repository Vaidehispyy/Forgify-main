"use client";

import Link from "next/link";
import { GhostType } from "@/components/ui/ghost-type";
import { HeroCanvas } from "./HeroCanvas";

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-white/10 bg-[#05070B] pt-12 pb-20 sm:pt-16 sm:pb-24">
      {/* Background Matrix Grid Pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.035]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)`,
          backgroundSize: "28px 28px",
        }}
      />

      {/* Subtle Cyan Glow Blob */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[360px] bg-[#0099ff]/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-14">
          {/* Left Column: Terminal-Dark Content */}
          <div className="flex flex-col items-start">
            {/* Monospace Indicator Tag (No Pill Structure) */}
            <div className="flex items-center gap-2 border border-[#0099ff]/30 bg-[#0099ff]/10 px-3 py-1 rounded font-mono text-[11px] font-medium tracking-wider text-[#38bdf8] uppercase">
              <span className="h-1.5 w-1.5 rounded-full bg-[#0099ff] animate-ping" />
              <span>Multi-Signal Forensic Intelligence</span>
            </div>

            {/* Main Headline with Ghost Type Animation */}
            <h1 className="mt-6 text-[2.5rem] leading-[1.08] font-bold tracking-tight text-white sm:text-[3.2rem] lg:text-[3.6rem]">
              <GhostType
                phrases={[
                  "Forensic analysis that proves manipulation.",
                  "Multi-signal evidence you can defend.",
                  "Detect every synthetic artifact and forged layer.",
                ]}
              />
            </h1>

            {/* Technical Subheading (Decluttered, Concise) */}
            <p className="mt-6 max-w-xl text-[16px] leading-relaxed text-slate-400">
              Forgify extracts explainable physical, mathematical, optical, and typographic evidence from
              digital documents, identity credentials, and photography. Cross-corroborates 11 distinct
              signal layers into a mathematically calibrated forensic risk verdict.
            </p>

            {/* Action Buttons */}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/analyze"
                className="group inline-flex items-center gap-2.5 rounded-lg bg-[#0099ff] px-6 py-3.5 text-[14px] font-medium text-white shadow-[0_0_25px_rgba(0,153,255,0.4)] transition-all duration-300 hover:bg-[#0088ee] hover:shadow-[0_0_35px_rgba(0,153,255,0.6)]"
              >
                <span>Analyze an Exhibit</span>
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

              <a
                href="#pipeline-flow"
                className="group inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#0B0F17] px-5 py-3.5 text-[14px] font-medium text-slate-300 transition-all duration-300 hover:border-white/25 hover:text-white hover:bg-[#111622]"
              >
                <span>Inspect Pipeline</span>
                <svg
                  viewBox="0 0 16 16"
                  className="h-4 w-4 text-slate-500 transition-transform duration-300 group-hover:translate-y-0.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="M8 3v10M4 9l4 4 4-4" />
                </svg>
              </a>
            </div>

            {/* Telemetry Stats Grid */}
            <dl className="mt-12 grid w-full max-w-lg grid-cols-2 gap-4 sm:grid-cols-4 border-t border-white/10 pt-6">
              {[
                { value: "11", label: "FORENSIC LAYERS" },
                { value: "08", label: "PIPELINE STAGES" },
                { value: "SHA-256", label: "CHAIN AUDIT" },
                { value: "100%", label: "EXPLAINABLE" },
              ].map((stat) => (
                <div key={stat.label} className="flex flex-col">
                  <dt className="font-mono text-[20px] font-bold text-white tracking-tight">
                    {stat.value}
                  </dt>
                  <dd className="mt-1 font-mono text-[10px] tracking-wider text-slate-500 uppercase">
                    {stat.label}
                  </dd>
                </div>
              ))}
            </dl>

            {/* Monospace API Route Strip */}
            <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10.5px] text-slate-500">
              <span className="text-[#38bdf8]">POST /api/analyze</span>
              <span>·</span>
              <span>MULTIPART INGESTION</span>
              <span>·</span>
              <span>NO HEURISTIC BLACK-BOX</span>
            </div>
          </div>

          {/* Right Column: 3D Document Carousel Canvas */}
          <div className="relative w-full flex items-center justify-center">
            <HeroCanvas />
          </div>
        </div>
      </div>
    </section>
  );
}
