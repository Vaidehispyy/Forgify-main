"use client";

import { useEffect, useState, useMemo } from "react";

const FORENSIC_WORDS = [
  "DCT QUANTIZATION",
  "RESNET-50 EMBEDDINGS",
  "ELA ERROR LEVEL",
  "EXIF METADATA",
  "PRNU NOISE",
  "TAMPER MASK",
  "FOURIER SPECTRUM",
  "CHROMATIC COVARIANCE",
  "REED-SOLOMON PARITY",
  "SIFT KEYPOINTS",
  "RANSAC AFFINE",
  "DQT ARCHAEOLOGY",
];

const GLYPH_SET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789%#@*&+=<>?/|~";

export function TypographicWall({
  className = "",
  rows = 8,
  cols = 32,
}: {
  className?: string;
  rows?: number;
  cols?: number;
}) {
  const [scrambleTick, setScrambleTick] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const interval = setInterval(() => {
      setScrambleTick((t) => (t + 1) % 1000);
    }, 180);
    return () => clearInterval(interval);
  }, []);

  // Generate scrambled lines with highlighted forensic terms embedded
  const lines = useMemo(() => {
    if (!mounted) return [];
    const result: { text: string; highlighted: string; isDecoded: boolean }[] = [];

    for (let r = 0; r < rows; r++) {
      const targetWord = FORENSIC_WORDS[r % FORENSIC_WORDS.length];
      const isDecoded = (scrambleTick + r) % 3 !== 0;

      // Scrambled prefixes and suffixes
      let prefix = "";
      for (let i = 0; i < 4; i++) {
        prefix += GLYPH_SET[Math.floor(Math.random() * GLYPH_SET.length)];
      }

      let suffix = "";
      for (let i = 0; i < 6; i++) {
        suffix += GLYPH_SET[Math.floor(Math.random() * GLYPH_SET.length)];
      }

      result.push({
        text: prefix,
        highlighted: isDecoded
          ? targetWord
          : targetWord
              .split("")
              .map((c) => (c === " " ? " " : GLYPH_SET[Math.floor(Math.random() * GLYPH_SET.length)]))
              .join(""),
        isDecoded,
      });
    }
    return result;
  }, [mounted, rows, scrambleTick]);

  if (!mounted) {
    return <div className={`relative overflow-hidden select-none font-mono ${className}`} />;
  }

  return (
    <div
      aria-hidden="true"
      className={`relative overflow-hidden select-none font-mono text-[11px] sm:text-[13px] leading-loose opacity-35 transition-opacity duration-500 pointer-events-none ${className}`}
    >
      <div className="flex flex-col items-center justify-center">
        {lines.map((line, idx) => (
          <div key={idx} className="flex items-center gap-3 tracking-widest whitespace-nowrap">
            <span className="text-slate-700">{line.text}</span>
            <span
              className={`transition-colors duration-300 ${
                line.isDecoded
                  ? "text-[#0099ff] font-semibold drop-shadow-[0_0_8px_rgba(0,153,255,0.7)]"
                  : "text-slate-600"
              }`}
            >
              [ {line.highlighted} ]
            </span>
            <span className="text-slate-800">
              {GLYPH_SET[(idx * 7 + scrambleTick) % GLYPH_SET.length]}
              {GLYPH_SET[(idx * 3 + scrambleTick) % GLYPH_SET.length]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
