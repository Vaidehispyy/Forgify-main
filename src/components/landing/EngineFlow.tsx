"use client";

import { useState } from "react";

interface PipelineNode {
  id: string;
  step: string;
  title: string;
  category: "Signal" | "Container" | "Content" | "Manipulation" | "Intelligence";
  shortDesc: string;
  checks: string[];
  inputs: string;
  outputs: string;
  diagnostic: string;
  highlightColor: string;
}

const PIPELINE_STAGES: PipelineNode[] = [
  {
    id: "ingest",
    step: "01",
    title: "Ingest & Integrity",
    category: "Container",
    shortDesc: "SHA-256 byte registration, magic byte identification, ICC profile extraction.",
    checks: [
      "SHA-256 cryptographic hash computation for chain-of-custody",
      "File header magic byte validation (JPEG, PNG, WebP, PDF)",
      "Dimension, color space, bit-depth, and raster allocation audit",
    ],
    inputs: "Raw binary exhibit upload (up to 20 MB)",
    outputs: "Deterministic Asset SHA-256 ID + Memory Raster Array",
    diagnostic: "SHA-256: 4e8f9b2c... | Mime: image/jpeg | 2400x1600 px",
    highlightColor: "#0099ff",
  },
  {
    id: "container",
    step: "02",
    title: "Container & Provenance",
    category: "Container",
    shortDesc: "EXIF/XMP byte audit, timestamp paradox detection, C2PA JUMBF audit.",
    checks: [
      "Created vs. Modified timestamp inconsistency checks",
      "Hardware camera model tag audit vs. declared optical sensor parameters",
      "Software tag trace discovery (Adobe Photoshop, GIMP, Canva)",
      "C2PA manifest extraction and cryptographic certificate trust-chain",
    ],
    inputs: "App1/App2 metadata chunks, XMP packets, Exif tags",
    outputs: "Metadata anomaly score + Container integrity flag",
    diagnostic: "SoftwareTag: 'Adobe Photoshop 24.1' | Paradox: Δt = -340 days",
    highlightColor: "#38bdf8",
  },
  {
    id: "pixel",
    step: "03",
    title: "Pixel-Level Integrity",
    category: "Signal",
    shortDesc: "Multi-scale Error Level Analysis (ELA) at 85/90/95 quality, local noise sigma.",
    checks: [
      "Error-Level Analysis: Re-saving at calibrated quality factors to measure reconstruction error",
      "Local Noise Variance: Poisson thermal sensor noise consistency across 16x16 blocks",
      "PX-SMOOTH: Hyper-smooth flat-surface diffusion anomaly detection",
    ],
    inputs: "Decoded RGB pixel matrices, color channel residual maps",
    outputs: "Spatial tamper heatmap + localized error clusters",
    diagnostic: "ELA Delta: 44.2% peak | Local noise variance: σ² = 34.2",
    highlightColor: "#0099ff",
  },
  {
    id: "compression",
    step: "04",
    title: "Compression History",
    category: "Signal",
    shortDesc: "Recovers Discrete Quantization Tables (DQT), audits double-compression grid.",
    checks: [
      "Luminance and chrominance quantization matrix extraction from DQT markers",
      "IJG baseline quality factor estimation and secondary compression discovery",
      "Periodic rounding artifact detection across 8x8 DCT block boundaries",
    ],
    inputs: "JPEG DQT segments, DCT transform coefficients",
    outputs: "Estimated historical JPEG quality + Double-compression grid mask",
    diagnostic: "Primary Q: 92% | Secondary Q: 75% | Grid misaligned: True",
    highlightColor: "#0099ff",
  },
  {
    id: "aigc",
    step: "05",
    title: "Generative-AI & ResNet",
    category: "Intelligence",
    shortDesc: "2D FFT frequency spikes, chromatic covariance Δ(R-B), Random Forest model.",
    checks: [
      "2D Fast Fourier Transform magnitude spectrum: Periodic transposed convolution spikes",
      "Chromatic residual covariance: Unnatural latent tensor color channel decoupling",
      "Synthetic QR integrity: Missing Reed-Solomon mathematical error-correction blocks",
      "Calibrated Random Forest model trained on 27 diffusion & camera exhibits",
    ],
    inputs: "2D Fourier magnitude spectrum + 10D feature vector",
    outputs: "AIGC Synthetic Probability Score + Severity Finding",
    diagnostic: "AIGC Score: 94.6% (ALERT) | Chromatic Δ(R-B): 46.8 dB",
    highlightColor: "#0099ff",
  },
  {
    id: "typography",
    step: "06",
    title: "OCR & Glyph Analysis",
    category: "Content",
    shortDesc: "Baseline alignment drift, character confidence, font-family substitution.",
    checks: [
      "Tesseract/Vision OCR bounding box extraction and character confidence scoring",
      "Sub-pixel baseline drift detection across adjacent alphanumeric glyphs",
      "Font kerning, stroke-width thickness variance, and aspect ratio stretch",
    ],
    inputs: "Binarized glyph masks, word baseline coordinate arrays",
    outputs: "Typographic anomaly mask + Font substitution clusters",
    diagnostic: "Drift: 3.8px on date line | Kerning anomaly: 14% variance",
    highlightColor: "#38bdf8",
  },
  {
    id: "copymove",
    step: "07",
    title: "Copy-Move & Splicing",
    category: "Manipulation",
    shortDesc: "SIFT keypoint extraction, KD-tree nearest neighbors, RANSAC affine clustering.",
    checks: [
      "Scale-Invariant Feature Transform (SIFT) 128-dimensional keypoint descriptors",
      "Fast Approximate Nearest Neighbor KD-tree matching with distance ratio test",
      "RANSAC geometric affine transformation model fitting to isolate duplicated patches",
    ],
    inputs: "High-contrast luminance keypoints, feature descriptors",
    outputs: "Paired vector match clusters + Cloned region polygons",
    diagnostic: "Matching Keypoints: 24 pairs | Inlier Consensus: 92.4%",
    highlightColor: "#0099ff",
  },
  {
    id: "fusion",
    step: "08",
    title: "Evidence Fusion & Verdict",
    category: "Intelligence",
    shortDesc: "Dependency-aware linear opinion pool, calibrated logistic risk scale, report.",
    checks: [
      "Category weight aggregation across Signal, Container, Content, and Manipulation families",
      "Generative-AI integrity floor: Guarantees high-risk verdict when synthesis is detected",
      "Calibrated 5-tier risk verdict: FORGED (86-100%) down to AUTHENTIC (0-23%)",
      "Auditable structured JSON payload and downloadable PDF evidence dossier",
    ],
    inputs: "All 11 layer scores, confidence weights, localized bounding boxes",
    outputs: "Calibrated Risk Score (0-100) + Final Admissibility Report",
    diagnostic: "Final Risk: 92/100 | Verdict: FORGED | Confidence: 89.4%",
    highlightColor: "#0099ff",
  },
];

export function EngineFlow() {
  const [activeStageId, setActiveStageId] = useState<string>("aigc");

  const currentStage =
    PIPELINE_STAGES.find((s) => s.id === activeStageId) || PIPELINE_STAGES[4];

  return (
    <section id="pipeline-flow" className="relative border-b border-white/10 bg-[#05070B] py-24 sm:py-32">
      {/* Background Matrix & Lighting */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        {/* Section Heading */}
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 border border-[#0099ff]/30 bg-[#0099ff]/10 px-3 py-1 rounded font-mono text-[11px] font-medium tracking-wider text-[#38bdf8] uppercase">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0099ff]" />
            <span>End-to-End Forensic Architecture</span>
          </div>

          <h2 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            The 8-Stage Inspection Pipeline
          </h2>

          <p className="mt-4 text-[16px] leading-relaxed text-slate-400">
            Every submission traverses eight sequential, deterministic verification stages. Findings from each
            layer are cross-validated to isolate physical, mathematical, and generative anomalies.
          </p>
        </div>

        {/* Pinned Flowchart Container (Horizontally Centered) */}
        <div className="mt-16 mx-auto max-w-5xl rounded-2xl border border-white/10 bg-[#080C14]/90 p-6 sm:p-8 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
          {/* Horizontal Node Navigation Bar */}
          <div className="relative flex items-center justify-between gap-2 overflow-x-auto pb-4 pt-2 no-scrollbar">
            {/* SVG Connecting Orthogonal Line */}
            <div className="absolute top-6 left-6 right-6 h-[2px] bg-white/10 -z-0">
              <div
                className="h-full bg-gradient-to-r from-[#0099ff] via-[#38bdf8] to-[#0099ff] shadow-[0_0_12px_#0099ff] transition-all duration-500"
                style={{
                  width: `${((PIPELINE_STAGES.findIndex((s) => s.id === activeStageId) + 1) / PIPELINE_STAGES.length) * 100}%`,
                }}
              />
            </div>

            {PIPELINE_STAGES.map((stage, idx) => {
              const isActive = stage.id === activeStageId;
              return (
                <button
                  key={stage.id}
                  type="button"
                  onClick={() => setActiveStageId(stage.id)}
                  className={`group relative z-10 flex flex-col items-center min-w-[70px] sm:min-w-[90px] transition-all duration-200 focus:outline-none`}
                >
                  {/* Step Circle */}
                  <div
                    className={`flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-xl font-mono text-[13px] font-bold transition-all duration-300 ${
                      isActive
                        ? "bg-[#0099ff] text-white shadow-[0_0_20px_rgba(0,153,255,0.6)] scale-110 border-2 border-white/30"
                        : "bg-[#0E1524] text-slate-400 border border-white/15 hover:border-white/30 hover:text-white"
                    }`}
                  >
                    {stage.step}
                  </div>

                  {/* Node Label Below */}
                  <span
                    className={`mt-2 font-mono text-[10px] sm:text-[11px] font-medium tracking-tight text-center leading-tight transition-colors ${
                      isActive ? "text-[#38bdf8]" : "text-slate-500 group-hover:text-slate-300"
                    }`}
                  >
                    {stage.title.split("&")[0].trim()}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Detailed Stage Inspection Panel */}
          <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_1fr] border-t border-white/10 pt-8">
            {/* Left: Stage Overview & Forensic Checks */}
            <div className="flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <span className="px-2.5 py-1 rounded bg-[#0099ff]/15 border border-[#0099ff]/30 font-mono text-[11px] font-bold text-[#38bdf8] uppercase">
                    STAGE {currentStage.step} · {currentStage.category}
                  </span>
                  <span className="font-mono text-xs text-slate-500">PIPELINE VERIFICATION</span>
                </div>

                <h3 className="mt-3 text-2xl font-bold text-white tracking-tight">
                  {currentStage.title}
                </h3>

                <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                  {currentStage.shortDesc}
                </p>

                {/* Checks List */}
                <div className="mt-6">
                  <h4 className="font-mono text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                    Diagnostic Verifications Executed:
                  </h4>
                  <ul className="mt-3 space-y-2.5">
                    {currentStage.checks.map((check, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-xs text-slate-300">
                        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#0099ff]/20 text-[#38bdf8] font-mono text-[9px] font-bold">
                          ✓
                        </span>
                        <span>{check}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Navigation Arrows for Stages */}
              <div className="mt-8 flex items-center gap-3 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => {
                    const idx = PIPELINE_STAGES.findIndex((s) => s.id === activeStageId);
                    if (idx > 0) setActiveStageId(PIPELINE_STAGES[idx - 1].id);
                  }}
                  disabled={activeStageId === PIPELINE_STAGES[0].id}
                  className="px-3 py-1.5 rounded-lg border border-white/10 bg-[#0B0F17] font-mono text-xs text-slate-300 hover:bg-[#111622] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ← PREVIOUS STAGE
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const idx = PIPELINE_STAGES.findIndex((s) => s.id === activeStageId);
                    if (idx < PIPELINE_STAGES.length - 1) setActiveStageId(PIPELINE_STAGES[idx + 1].id);
                  }}
                  disabled={activeStageId === PIPELINE_STAGES[PIPELINE_STAGES.length - 1].id}
                  className="px-3 py-1.5 rounded-lg border border-[#0099ff]/40 bg-[#0099ff]/15 font-mono text-xs text-[#38bdf8] hover:bg-[#0099ff]/25 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  NEXT STAGE →
                </button>
              </div>
            </div>

            {/* Right: Technical I/O & Diagnostic Telemetry Box */}
            <div className="flex flex-col justify-between rounded-xl border border-white/10 bg-[#05070B] p-5 font-mono">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    STAGE TELEMETRY
                  </span>
                  <span className="flex items-center gap-1.5 text-[10px] text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    DETERMINISTIC
                  </span>
                </div>

                {/* Input Stream */}
                <div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider">INPUT ARTIFACT</div>
                  <div className="mt-1 text-xs text-slate-200 bg-[#0B0F17] p-2.5 rounded border border-white/5">
                    {currentStage.inputs}
                  </div>
                </div>

                {/* Output Stream */}
                <div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider">OUTPUT SIGNAL</div>
                  <div className="mt-1 text-xs text-[#38bdf8] bg-[#0099ff]/10 p-2.5 rounded border border-[#0099ff]/20">
                    {currentStage.outputs}
                  </div>
                </div>

                {/* Live Diagnostic Telemetry */}
                <div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider">SAMPLE DIAGNOSTIC LOG</div>
                  <div className="mt-1 text-[11px] text-emerald-400 bg-black/60 p-2.5 rounded border border-emerald-500/20 truncate">
                    {currentStage.diagnostic}
                  </div>
                </div>
              </div>

              {/* Footnote */}
              <div className="mt-6 pt-3 border-t border-white/5 text-[10px] text-slate-500 flex items-center justify-between">
                <span>STAGE ID: {currentStage.id.toUpperCase()}</span>
                <span>EXECUTION: SYNCHRONOUS</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
