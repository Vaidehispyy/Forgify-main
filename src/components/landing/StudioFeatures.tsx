"use client";

import { useState } from "react";

export function StudioFeatures() {
  const [elaSlider, setElaSlider] = useState(50);
  const [activeHexTab, setActiveHexTab] = useState<"exif" | "photoshop">("photoshop");

  return (
    <section className="relative border-b border-white/10 bg-[#05070B] py-24 sm:py-32">
      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        {/* Section Heading */}
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 border border-[#0099ff]/30 bg-[#0099ff]/10 px-3 py-1 rounded font-mono text-[11px] font-medium tracking-wider text-[#38bdf8] uppercase">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0099ff]" />
            <span>Forensic Laboratory Diagnostics</span>
          </div>

          <h2 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Studio-Grade Forensic Modules
          </h2>

          <p className="mt-4 text-[16px] leading-relaxed text-slate-400">
            Real forensic investigation doesn't rely on generic AI guesses. Forgify exposes the physical,
            mathematical, and typographic artifacts that make manipulation mathematically undeniable.
          </p>
        </div>

        {/* Bento Grid Layout */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6">
          {/* CARD 1: Container & EXIF Hex Offset Inspector (Span 7) */}
          <div className="lg:col-span-7 flex flex-col justify-between rounded-2xl border border-white/10 bg-[#080C14] p-6 sm:p-7 shadow-[0_15px_35px_rgba(0,0,0,0.5)]">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-[#38bdf8] tracking-wider uppercase">
                  MODULE 01 · CONTAINER FORENSICS
                </span>
                <span className="font-mono text-[10px] text-rose-400 bg-rose-950/80 border border-rose-500/40 px-2 py-0.5 rounded">
                  ANOMALY FOUND
                </span>
              </div>

              <h3 className="mt-2 text-xl font-bold text-white tracking-tight">
                Hex &amp; EXIF Byte-Offset Audit
              </h3>

              <p className="mt-1 text-sm text-slate-400">
                Audits raw JPEG Application Markers (APP1 Exif, APP2 ICC, APP13 Photoshop) to expose editing
                software metadata traces and timestamp paradoxes.
              </p>

              {/* Mini Hex Tab Bar */}
              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveHexTab("photoshop")}
                  className={`px-2.5 py-1 rounded font-mono text-[10px] transition-all ${
                    activeHexTab === "photoshop"
                      ? "bg-[#0099ff] text-white"
                      : "bg-[#0E1524] text-slate-400 hover:text-white"
                  }`}
                >
                  APP13 (Photoshop 3.0 IPTC)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveHexTab("exif")}
                  className={`px-2.5 py-1 rounded font-mono text-[10px] transition-all ${
                    activeHexTab === "exif"
                      ? "bg-[#0099ff] text-white"
                      : "bg-[#0E1524] text-slate-400 hover:text-white"
                  }`}
                >
                  APP1 (TIFF/IFD0 Date Paradox)
                </button>
              </div>

              {/* Hex Dump Window */}
              <div className="mt-3 rounded-lg border border-white/10 bg-[#030508] p-4 font-mono text-[11px] leading-relaxed text-slate-300 overflow-x-auto">
                {activeHexTab === "photoshop" ? (
                  <div>
                    <div className="text-slate-500 pb-1 border-b border-white/5 flex justify-between">
                      <span>OFFSET 0x00000120 - 0x00000150</span>
                      <span className="text-rose-400">SIGNATURE: ADOBE EDIT DETECTED</span>
                    </div>
                    <div className="pt-2 text-slate-400">
                      <span className="text-slate-600">00000120:</span> 46 69 72 65 66 6c 79 20 <span className="text-rose-400 font-bold bg-rose-950/60 px-1">41 64 6f 62 65 20 50 68</span> | <span className="text-white">Firefly.</span><span className="text-rose-300 font-bold">Adobe Ph</span>
                    </div>
                    <div className="text-slate-400">
                      <span className="text-slate-600">00000130:</span> <span className="text-rose-400 font-bold bg-rose-950/60 px-1">6f 74 6f 73 68 6f 70 20</span> 32 34 2e 31 20 28 4d 61 | <span className="text-rose-300 font-bold">otoshop </span><span className="text-white">24.1 (Ma</span>
                    </div>
                    <div className="text-slate-400">
                      <span className="text-slate-600">00000140:</span> 63 69 6e 74 6f 73 68 29 00 00 04 04 00 00 00 00 | <span className="text-white">cintosh)........</span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-slate-500 pb-1 border-b border-white/5 flex justify-between">
                      <span>OFFSET 0x00000080 - 0x000000A0</span>
                      <span className="text-amber-400">TAG 0x9003 PARADOX</span>
                    </div>
                    <div className="pt-2 text-slate-400">
                      <span className="text-slate-600">00000080:</span> 44 61 74 65 54 69 6d 65 4f 72 69 67 69 6e 61 6c | <span className="text-white">DateTimeOriginal</span>
                    </div>
                    <div className="text-slate-400">
                      <span className="text-slate-600">00000090:</span> 32 30 32 36 3a 30 33 3a 31 35 20 31 34 3a 32 30 | <span className="text-emerald-300">2026:03:15 14:20</span>
                    </div>
                    <div className="text-slate-400">
                      <span className="text-slate-600">000000A0:</span> 4d 6f 64 69 66 79 44 61 74 65 3a 20 32 30 32 35 | <span className="text-rose-300 font-bold">ModifyDate: 2025</span> (Paradox!)
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/5 font-mono text-[10px] text-slate-500 flex justify-between">
              <span>ALGORITHM: DQT/APP-PARSER</span>
              <span className="text-slate-400">CONFIDENCE: 98.2%</span>
            </div>
          </div>

          {/* CARD 2: Pixel-Level ELA & Resampling Heatmap (Span 5) */}
          <div className="lg:col-span-5 flex flex-col justify-between rounded-2xl border border-white/10 bg-[#080C14] p-6 sm:p-7 shadow-[0_15px_35px_rgba(0,0,0,0.5)]">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-[#38bdf8] tracking-wider uppercase">
                  MODULE 02 · SIGNAL INTEGRITY
                </span>
                <span className="font-mono text-[10px] text-[#38bdf8] bg-[#0099ff]/15 border border-[#0099ff]/30 px-2 py-0.5 rounded">
                  ELA MULTI-SCALE
                </span>
              </div>

              <h3 className="mt-2 text-xl font-bold text-white tracking-tight">
                Error Level Analysis (ELA)
              </h3>

              <p className="mt-1 text-sm text-slate-400">
                Spliced elements recompressed at different quality factors produce distinct error variance
                gradients compared to the uniform camera background.
              </p>

              {/* Interactive ELA Split Viewer */}
              <div className="mt-4 relative h-40 rounded-lg overflow-hidden border border-white/10 bg-[#04060A] select-none">
                {/* Background "Clean" Texture */}
                <div className="absolute inset-0 bg-gradient-to-r from-slate-900 to-slate-800 flex items-center justify-center font-mono text-xs text-slate-500">
                  <div className="p-4 text-center">
                    <div className="text-slate-300 font-bold">ORIGINAL COMPRESSION (Q95)</div>
                    <div className="text-[10px] text-slate-500 mt-1">Uniform camera sensor thermal noise</div>
                  </div>
                </div>

                {/* Overlaid ELA Heatmap revealed by slider */}
                <div
                  className="absolute inset-y-0 right-0 overflow-hidden bg-gradient-to-br from-indigo-950 via-purple-900 to-rose-950 border-l-2 border-[#0099ff] shadow-[-10px_0_20px_rgba(0,153,255,0.4)]"
                  style={{ width: `${100 - elaSlider}%` }}
                >
                  <div className="absolute inset-0 flex items-center justify-center font-mono text-xs text-rose-300">
                    <div className="p-4 text-center">
                      <div className="text-rose-400 font-bold">SPLICED REGION RESIDUALS</div>
                      <div className="text-[10px] text-rose-300/80 mt-1">High error delta: Δ &gt; 42.6%</div>
                    </div>
                  </div>
                </div>

                {/* Center Divider Pill */}
                <div
                  className="absolute top-2 bottom-2 w-0.5 bg-[#0099ff] pointer-events-none flex items-center justify-center"
                  style={{ left: `${elaSlider}%` }}
                >
                  <div className="w-5 h-5 rounded-full bg-[#0099ff] border-2 border-white shadow-[0_0_10px_#0099ff] flex items-center justify-center text-[8px] font-bold text-white font-mono">
                    ↔
                  </div>
                </div>
              </div>

              {/* Slider Controller */}
              <div className="mt-3 flex items-center justify-between text-xs font-mono text-slate-400">
                <span>ORIGINAL (Q95)</span>
                <input
                  type="range"
                  min="5"
                  max="95"
                  value={elaSlider}
                  onChange={(e) => setElaSlider(Number(e.target.value))}
                  className="w-40 accent-[#0099ff] cursor-pointer"
                />
                <span className="text-[#38bdf8]">ELA HEATMAP</span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/5 font-mono text-[10px] text-slate-500 flex justify-between">
              <span>METRIC: RMSE MULTI-SCALE (85/90/95)</span>
              <span className="text-slate-400">PEAK DELTA: 42.6%</span>
            </div>
          </div>

          {/* CARD 3: 4-Pillar Generative-AI Detection Engine (Span 6) */}
          <div className="lg:col-span-6 flex flex-col justify-between rounded-2xl border border-white/10 bg-[#080C14] p-6 sm:p-7 shadow-[0_15px_35px_rgba(0,0,0,0.5)]">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-[#38bdf8] tracking-wider uppercase">
                  MODULE 03 · SYNTHETIC AI DETECTION
                </span>
                <span className="font-mono text-[10px] text-rose-400 bg-rose-950/80 border border-rose-500/40 px-2 py-0.5 rounded">
                  94.6% PROBABILITY
                </span>
              </div>

              <h3 className="mt-2 text-xl font-bold text-white tracking-tight">
                Generative-AI Latent Signal Engine
              </h3>

              <p className="mt-1 text-sm text-slate-400">
                Detects synthetic images from Google Gemini, Imagen, Midjourney, DALL-E, and Stable Diffusion
                through physical frequency rolloff and color tensor covariance.
              </p>

              {/* 4 Pillars Breakdown Grid */}
              <div className="mt-4 grid grid-cols-2 gap-2.5 font-mono text-[11px]">
                <div className="p-3 rounded-lg border border-white/5 bg-[#04060A]">
                  <div className="text-[#38bdf8] font-bold">1. 2D FFT SPECTRUM</div>
                  <div className="mt-1 text-[10px] text-slate-400 leading-tight">
                    Transposed convolution upsampler leaves periodic frequency grid spikes.
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-white/5 bg-[#04060A]">
                  <div className="text-[#38bdf8] font-bold">2. DIFFUSION SMOOTH</div>
                  <div className="mt-1 text-[10px] text-slate-400 leading-tight">
                    Iterative denoising creates unnaturally sterile flat surfaces (PX-SMOOTH).
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-white/5 bg-[#04060A]">
                  <div className="text-[#38bdf8] font-bold">3. CHROMATIC Δ(R-B)</div>
                  <div className="mt-1 text-[10px] text-slate-400 leading-tight">
                    Decoupled latent RGB channels exceed real optical Bayer filter physics.
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-white/5 bg-[#04060A]">
                  <div className="text-[#38bdf8] font-bold">4. REED-SOLOMON QR</div>
                  <div className="mt-1 text-[10px] text-slate-400 leading-tight">
                    Synthetic diffusion models draw fake visual QRs with non-decodable bits.
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/5 font-mono text-[10px] text-slate-500 flex justify-between">
              <span>CLASSIFIER: CALIBRATED RANDOM FOREST</span>
              <span className="text-emerald-400">100% EXPLAINABLE</span>
            </div>
          </div>

          {/* CARD 4: Typography & Glyph Alignment Matrix (Span 6) */}
          <div className="lg:col-span-6 flex flex-col justify-between rounded-2xl border border-white/10 bg-[#080C14] p-6 sm:p-7 shadow-[0_15px_35px_rgba(0,0,0,0.5)]">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-[#38bdf8] tracking-wider uppercase">
                  MODULE 04 · CONTENT &amp; TYPOGRAPHY
                </span>
                <span className="font-mono text-[10px] text-amber-400 bg-amber-950/80 border border-amber-500/40 px-2 py-0.5 rounded">
                  DRIFT DETECTED
                </span>
              </div>

              <h3 className="mt-2 text-xl font-bold text-white tracking-tight">
                Glyph Baseline &amp; Font Kerning Matrix
              </h3>

              <p className="mt-1 text-sm text-slate-400">
                When fraudsters replace individual numbers or names on identity cards and bank statements,
                sub-pixel baseline shifts and kerning variances reveal the exact altered characters.
              </p>

              {/* Typography Alignment Visualizer */}
              <div className="mt-4 rounded-lg border border-white/10 bg-[#04060A] p-4 font-mono">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">
                  SUB-PIXEL BASELINE RESIDUALS (AADHAAR NUMBER)
                </div>

                {/* Character Matrix */}
                <div className="flex items-center justify-center gap-2 text-xl font-bold py-3 bg-[#0B0F17] rounded border border-white/5">
                  <span className="text-slate-300">9</span>
                  <span className="text-slate-300">2</span>
                  <span className="text-slate-300">4</span>
                  <span className="text-slate-300">1</span>
                  <span className="text-slate-600">-</span>
                  <span className="text-slate-300">8</span>
                  <span className="text-slate-300">3</span>
                  <span className="text-slate-300">9</span>
                  <span className="text-slate-300">2</span>
                  <span className="text-slate-600">-</span>
                  {/* Tampered digits highlighted */}
                  <span className="text-rose-400 underline decoration-rose-500 decoration-2 underline-offset-4 relative">
                    4
                    <span className="absolute -top-4 left-0 text-[8px] text-rose-400 font-mono">+3.8px</span>
                  </span>
                  <span className="text-rose-400 underline decoration-rose-500 decoration-2 underline-offset-4 relative">
                    0
                    <span className="absolute -top-4 left-0 text-[8px] text-rose-400 font-mono">+4.1px</span>
                  </span>
                  <span className="text-rose-400 underline decoration-rose-500 decoration-2 underline-offset-4 relative">
                    1
                    <span className="absolute -top-4 left-0 text-[8px] text-rose-400 font-mono">+3.2px</span>
                  </span>
                  <span className="text-rose-400 underline decoration-rose-500 decoration-2 underline-offset-4 relative">
                    9
                    <span className="absolute -top-4 left-0 text-[8px] text-rose-400 font-mono">+3.9px</span>
                  </span>
                </div>

                <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                  <span className="text-slate-500">DIGITS 0-7: 0.2px TIKHONOV BASELINE</span>
                  <span className="text-rose-400 font-bold">DIGITS 8-11: 3.8px RESIDUAL ANOMALY</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/5 font-mono text-[10px] text-slate-500 flex justify-between">
              <span>SCANNER: TESSERACT OCR + OPENCV CONTOURS</span>
              <span className="text-slate-400">CONFIDENCE: 94.8%</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
