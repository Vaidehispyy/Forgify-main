"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";

interface DocumentMeta {
  id: "aadhaar" | "pan";
  title: "Indian Aadhaar Card" | "Indian PAN Card";
  authority: "Unique Identification Authority of India" | "Income Tax Department of India";
  image: string;
  tamperField: string;
  tamperRegion: { top: string; left: string; width: string; height: string };
  riskScore: number;
  verdict: string;
  detectedLayer: string;
  signals: { name: string; status: "alert" | "warn" | "pass"; detail: string }[];
}

const DOCUMENTS: DocumentMeta[] = [
  {
    id: "aadhaar",
    title: "Indian Aadhaar Card",
    authority: "Unique Identification Authority of India",
    image: "/documents/adharcardtemplate.png",
    tamperField: "DOB & Aadhaar 12-Digit Sequence",
    tamperRegion: { top: "54%", left: "38%", width: "48%", height: "26%" },
    riskScore: 92,
    verdict: "FORGED",
    detectedLayer: "Pixel ELA & Generative-AI",
    signals: [
      { name: "Pixel ELA", status: "alert", detail: "Compression delta > 42% on date field" },
      { name: "QR Bitstream", status: "alert", detail: "Synthetic QR: Reed-Solomon parity failure" },
      { name: "AIGC Latent", status: "alert", detail: "Diffusion noise variance & chromatic drift" },
      { name: "Glyph Grid", status: "warn", detail: "Devanagari baseline alignment drift 3.4px" },
    ],
  },
  {
    id: "pan",
    title: "Indian PAN Card",
    authority: "Income Tax Department of India",
    image: "/documents/pancardimage.png",
    tamperField: "Permanent Account Number & Father's Name",
    tamperRegion: { top: "42%", left: "32%", width: "52%", height: "24%" },
    riskScore: 88,
    verdict: "FORGED",
    detectedLayer: "Typography & Splicing",
    signals: [
      { name: "Font Glyphs", status: "alert", detail: "Alphanumeric font substitution detected" },
      { name: "SIFT Residuals", status: "alert", detail: "Block copy-move boundary clustering" },
      { name: "DQT Grid", status: "warn", detail: "Double quantization artifact in 8x8 blocks" },
      { name: "Metadata EXIF", status: "pass", detail: "Stripped camera container header" },
    ],
  },
];

export function Document3D() {
  const [selectedDoc, setSelectedDoc] = useState<"aadhaar" | "pan">("aadhaar");
  const [exploded, setExploded] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const doc = DOCUMENTS.find((d) => d.id === selectedDoc) || DOCUMENTS[0];

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setMousePos({ x, y });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    setMousePos({ x: 0, y: 0 });
  }, []);

  // Compute 3D rotation transforms
  const rotX = isHovered ? -mousePos.y * 22 : -4;
  const rotY = isHovered ? mousePos.x * 24 : 10;
  const rotZ = isHovered ? -mousePos.x * 4 : -1;

  return (
    <div className="relative flex flex-col items-center select-none">
      {/* Top Controls Bar */}
      <div className="flex w-full items-center justify-between gap-2 mb-4 px-2">
        {/* Document Selector Buttons */}
        <div className="inline-flex rounded-lg border border-white/10 bg-[#0B0F17] p-1 text-xs">
          {DOCUMENTS.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setSelectedDoc(d.id)}
              className={`px-3 py-1.5 rounded-md font-mono text-[11px] uppercase tracking-wider transition-all duration-200 ${
                selectedDoc === d.id
                  ? "bg-[#0099ff] text-white shadow-[0_0_15px_rgba(0,153,255,0.4)]"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {d.id === "aadhaar" ? "Aadhaar Card" : "PAN Card"}
            </button>
          ))}
        </div>

        {/* View Mode Controls */}
        <div className="inline-flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExploded((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-mono tracking-wider transition-all ${
              exploded
                ? "border-[#0099ff] bg-[#0099ff]/15 text-[#38bdf8] shadow-[0_0_12px_rgba(0,153,255,0.3)]"
                : "border-white/10 bg-[#0B0F17] text-slate-400 hover:text-slate-200"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#0099ff]" />
            {exploded ? "COLLAPSE" : "EXPLODE LAYERS"}
          </button>

          <button
            type="button"
            onClick={() => setShowHeatmap((v) => !v)}
            className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-mono tracking-wider transition-all ${
              showHeatmap
                ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                : "border-white/10 bg-[#0B0F17] text-slate-400 hover:text-slate-200"
            }`}
          >
            HEATMAP: {showHeatmap ? "ON" : "OFF"}
          </button>
        </div>
      </div>

      {/* 3D Canvas Stage */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={handleMouseLeave}
        className="relative w-full max-w-[540px] aspect-[1.58/1] rounded-2xl p-4 flex items-center justify-center cursor-grab active:cursor-grabbing"
        style={{ perspective: "1200px" }}
      >
        {/* Subtle Ambient Backing Glow */}
        <div
          className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-[#0099ff]/10 via-transparent to-cyan-500/5 pointer-events-none blur-xl transition-opacity duration-500"
          style={{ opacity: isHovered ? 1 : 0.6 }}
        />

        {/* Main 3D Card Stack Container */}
        <div
          className="relative w-full h-full transition-transform duration-300 ease-out"
          style={{
            transformStyle: "preserve-3d",
            transform: `rotateX(${rotX}deg) rotateY(${rotY}deg) rotateZ(${rotZ}deg)`,
          }}
        >
          {/* LAYER 1: BASE OPTICAL TEXTURE (True sRGB, Unwashed) */}
          <div
            className="absolute inset-0 rounded-xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_1px_rgba(255,255,255,0.2)] border border-white/15 bg-[#0e1422] transition-transform duration-500"
            style={{
              transform: exploded ? "translateZ(-40px) translateY(20px)" : "translateZ(0px)",
              transformStyle: "preserve-3d",
            }}
          >
            {/* Real Unwashed High-Fidelity Image */}
            <div className="relative w-full h-full">
              <Image
                src={doc.image}
                alt={doc.title}
                fill
                sizes="(max-width: 768px) 100vw, 540px"
                className="object-cover"
                priority
              />
            </div>

            {/* Specular Glare Effect following mouse */}
            <div
              className="absolute inset-0 pointer-events-none transition-opacity duration-200"
              style={{
                background: `radial-gradient(circle at ${(mousePos.x + 0.5) * 100}% ${(mousePos.y + 0.5) * 100}%, rgba(255,255,255,0.18) 0%, transparent 60%)`,
                opacity: isHovered ? 1 : 0.3,
              }}
            />

            {/* Exploded Label Badge */}
            {exploded && (
              <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/80 border border-white/20 font-mono text-[9px] text-slate-300 uppercase tracking-widest">
                Layer 01 · Base Optical Capture
              </div>
            )}
          </div>

          {/* LAYER 2: TAMPER DETECTION & SPLICING BOUNDARY (Exploded) */}
          <div
            className="absolute inset-0 rounded-xl pointer-events-none transition-all duration-500"
            style={{
              transform: exploded ? "translateZ(30px) translateY(-10px)" : "translateZ(4px)",
              transformStyle: "preserve-3d",
            }}
          >
            {/* Tamper Bounding Polygon */}
            <div
              className="absolute border-2 border-dashed border-rose-500 rounded-md bg-rose-500/15 backdrop-blur-[0.5px] transition-all duration-300"
              style={{
                top: doc.tamperRegion.top,
                left: doc.tamperRegion.left,
                width: doc.tamperRegion.width,
                height: doc.tamperRegion.height,
                boxShadow: "0 0 20px rgba(244, 63, 94, 0.45), inset 0 0 15px rgba(244, 63, 94, 0.3)",
              }}
            >
              {/* Corner brackets */}
              <div className="absolute -top-1 -left-1 w-2 h-2 border-t-2 border-l-2 border-rose-400" />
              <div className="absolute -top-1 -right-1 w-2 h-2 border-t-2 border-r-2 border-rose-400" />
              <div className="absolute -bottom-1 -left-1 w-2 h-2 border-b-2 border-l-2 border-rose-400" />
              <div className="absolute -bottom-1 -right-1 w-2 h-2 border-b-2 border-r-2 border-rose-400" />

              {/* Anomaly Badge */}
              <div className="absolute -top-6 left-0 px-1.5 py-0.5 rounded bg-rose-950/95 border border-rose-500/60 font-mono text-[9px] font-semibold text-rose-300 uppercase tracking-wider flex items-center gap-1 shadow-md">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
                TAMPER: {doc.tamperField.split("&")[0].trim()}
              </div>
            </div>

            {exploded && (
              <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-rose-950/80 border border-rose-500/30 font-mono text-[9px] text-rose-300 uppercase tracking-widest">
                Layer 02 · Splicing Boundary Mask
              </div>
            )}
          </div>

          {/* LAYER 3: ELA & FREQUENCY NOISE HEATMAP */}
          {showHeatmap && (
            <div
              className="absolute inset-0 rounded-xl pointer-events-none mix-blend-screen transition-all duration-500"
              style={{
                transform: exploded ? "translateZ(80px) translateY(-30px)" : "translateZ(8px)",
                transformStyle: "preserve-3d",
                opacity: exploded ? 0.95 : 0.65,
              }}
            >
              {/* Localized ELA gradient over the tamper zone */}
              <div
                className="absolute rounded-lg"
                style={{
                  top: doc.tamperRegion.top,
                  left: doc.tamperRegion.left,
                  width: doc.tamperRegion.width,
                  height: doc.tamperRegion.height,
                  background:
                    "radial-gradient(ellipse at center, rgba(0, 240, 255, 0.65) 0%, rgba(0, 153, 255, 0.4) 40%, rgba(244, 63, 94, 0.45) 80%, transparent 100%)",
                  filter: "blur(2px)",
                }}
              />

              {/* Pulsating Scanline traversing the card */}
              <div className="absolute inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[#00f0ff] to-transparent shadow-[0_0_15px_#00f0ff] animate-scan pointer-events-none" />

              {exploded && (
                <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/30 font-mono text-[9px] text-cyan-300 uppercase tracking-widest">
                  Layer 03 · ELA Compression Noise Residuals
                </div>
              )}
            </div>
          )}

          {/* LAYER 4: DIAGNOSTIC HUD OVERLAY */}
          <div
            className="absolute inset-0 rounded-xl pointer-events-none p-3 flex flex-col justify-between font-mono text-[10px] text-white/90 transition-all duration-500"
            style={{
              transform: exploded ? "translateZ(120px) translateY(-50px)" : "translateZ(14px)",
              transformStyle: "preserve-3d",
            }}
          >
            {/* Header HUD */}
            <div className="flex items-start justify-between">
              <div className="px-2 py-1 rounded bg-black/75 border border-white/10 backdrop-blur-md flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-slate-300 tracking-wider">FORENSIC HUD · LIVE SCAN</span>
              </div>

              <div className="px-2.5 py-1 rounded bg-rose-950/85 border border-rose-500/50 backdrop-blur-md text-rose-300 font-semibold tracking-wider flex items-center gap-1.5 shadow-[0_0_10px_rgba(244,63,94,0.3)]">
                <span>RISK: {doc.riskScore}/100</span>
                <span className="text-white/40">|</span>
                <span>{doc.verdict}</span>
              </div>
            </div>

            {/* Bottom HUD */}
            <div className="flex items-end justify-between">
              <div className="px-2 py-1 rounded bg-black/75 border border-white/10 backdrop-blur-md text-slate-400 text-[9px] max-w-[240px] leading-tight">
                <div className="text-white font-medium">{doc.title}</div>
                <div className="text-slate-500 truncate">{doc.authority}</div>
              </div>

              <div className="px-2 py-1 rounded bg-black/75 border border-cyan-500/30 backdrop-blur-md text-cyan-300 text-[9px]">
                PRIMARY: {doc.detectedLayer}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Forensic Telemetry Strip Below Card */}
      <div className="w-full max-w-[540px] mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {doc.signals.map((sig) => (
          <div
            key={sig.name}
            className="p-2 rounded-lg border border-white/10 bg-[#0B0F17]/90 backdrop-blur flex flex-col justify-between"
          >
            <div className="flex items-center justify-between font-mono text-[10px]">
              <span className="text-slate-400 truncate">{sig.name}</span>
              <span
                className={`font-semibold uppercase tracking-wider ${
                  sig.status === "alert"
                    ? "text-rose-400"
                    : sig.status === "warn"
                    ? "text-amber-400"
                    : "text-emerald-400"
                }`}
              >
                {sig.status}
              </span>
            </div>
            <div className="mt-1 font-mono text-[9px] text-slate-500 truncate leading-snug">
              {sig.detail}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
