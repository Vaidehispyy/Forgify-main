"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const NAV = [
  { href: "/#pipeline-flow", label: "Pipeline" },
  { href: "/#layers", label: "11 Layers" },
  { href: "/#fusion", label: "Evidence Fusion" },
  { href: "/#research", label: "Methodology" },
];

export function SiteHeader({ theme = "light" }: { theme?: "dark" | "light" }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isDark = theme === "dark";

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-all duration-300 ${
        isDark
          ? scrolled
            ? "border-white/10 bg-[#05070B]/95 backdrop-blur-md"
            : "border-transparent bg-[#05070B]"
          : scrolled
          ? "border-hairline bg-white/95 backdrop-blur-md"
          : "border-transparent bg-white"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className="group flex items-center gap-3">
          <span
            className={`relative flex h-9 w-9 items-center justify-center rounded-lg ${
              isDark ? "bg-[#0E1524] border border-white/10" : "bg-navy-950"
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="#0099ff" strokeWidth="1.8">
              <path d="M12 2.5 4.5 5.5v6c0 4.6 3.1 8.4 7.5 10 4.4-1.6 7.5-5.4 7.5-10v-6L12 2.5Z" />
              <path d="M12 8v8M8.5 12h7" stroke="#38bdf8" />
            </svg>
          </span>
          <span className="leading-none">
            <span
              className={`block text-[15px] font-semibold tracking-[-0.01em] ${
                isDark ? "text-white" : "text-navy-950"
              }`}
            >
              Forgify
            </span>
            <span
              className={`mt-1 block font-mono text-[9.5px] tracking-[0.2em] uppercase ${
                isDark ? "text-slate-400" : "text-graphite-500"
              }`}
            >
              Digital Forensics Engine
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-7 lg:flex">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`relative text-[13.5px] font-medium transition-colors after:absolute after:-bottom-1.5 after:left-0 after:h-px after:w-0 after:bg-[#0099ff] after:transition-all after:duration-300 hover:after:w-full ${
                isDark ? "text-slate-300 hover:text-white" : "text-graphite-700 hover:text-navy-950"
              }`}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2.5">
          <Link
            href="/cases"
            className={`hidden rounded-lg px-3.5 py-2 text-[13px] font-medium transition-colors sm:block ${
              isDark
                ? "border border-white/10 bg-[#0B0F17] text-slate-300 hover:border-white/25 hover:text-white"
                : "border border-hairline text-graphite-700 hover:border-navy-300 hover:text-navy-950"
            }`}
          >
            Case register
          </Link>
          <Link
            href="/analyze"
            className="group inline-flex items-center gap-2 rounded-lg bg-[#0099ff] px-4 py-2 text-[13px] font-medium text-white shadow-[0_0_15px_rgba(0,153,255,0.35)] transition-all hover:bg-[#0088ee]"
          >
            <span>Analyze Exhibit</span>
            <svg
              viewBox="0 0 16 16"
              className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M3 8h10M9 4l4 4-4 4" />
            </svg>
          </Link>
          <button
            type="button"
            aria-label="Toggle navigation"
            onClick={() => setOpen((v) => !v)}
            className={`flex h-9 w-9 items-center justify-center rounded-lg border lg:hidden ${
              isDark ? "border-white/10 text-white" : "border-hairline text-navy-900"
            }`}
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
              {open ? <path d="M5 5l10 10M15 5L5 15" /> : <path d="M3 6h14M3 10h14M3 14h14" />}
            </svg>
          </button>
        </div>
      </div>

      {open ? (
        <div
          className={`border-t px-5 pb-4 lg:hidden ${
            isDark ? "border-white/10 bg-[#05070B]" : "border-hairline bg-white"
          }`}
        >
          <nav className="grid gap-1 pt-3">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`rounded-lg px-3 py-2.5 text-sm ${
                  isDark ? "text-slate-300 hover:bg-white/5" : "text-graphite-700 hover:bg-navy-50"
                }`}
              >
                {item.label}
              </a>
            ))}
            <Link
              href="/cases"
              className={`rounded-lg px-3 py-2.5 text-sm ${
                isDark ? "text-slate-300 hover:bg-white/5" : "text-graphite-700 hover:bg-navy-50"
              }`}
            >
              Case register
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}

export function SiteFooter({ theme = "light" }: { theme?: "dark" | "light" }) {
  const isDark = theme === "dark";
  const layers = [
    "Pixel integrity (ELA & Noise)",
    "Compression history (DQT)",
    "Metadata forensics (EXIF)",
    "Provenance & C2PA manifest",
    "OCR & glyph typography",
    "Layout geometry grid",
    "Copy-move & splicing (SIFT)",
    "QR / barcode verification",
    "Semantic consistency",
    "Generative-AI detection",
    "Multi-scale residual (SRM)",
  ];

  return (
    <footer
      className={`border-t ${
        isDark
          ? "border-white/10 bg-[#030508] text-slate-300"
          : "border-hairline bg-navy-950 text-navy-200"
      }`}
    >
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-3">
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                  isDark ? "bg-[#0E1524] border border-white/10" : "bg-navy-900"
                }`}
              >
                <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="#0099ff" strokeWidth="1.8">
                  <path d="M12 2.5 4.5 5.5v6c0 4.6 3.1 8.4 7.5 10 4.4-1.6 7.5-5.4 7.5-10v-6L12 2.5Z" />
                  <path d="M12 8v8M8.5 12h7" stroke="#38bdf8" />
                </svg>
              </span>
              <span className="text-[15px] font-semibold tracking-[-0.01em] text-white">Forgify</span>
            </div>
            <p className="mt-5 max-w-sm text-[13.5px] leading-relaxed text-slate-400">
              Multi-signal digital forensics and generative-AI detection system. Explains tampering through
              physical, mathematical, optical, and typographic evidence.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <span className="rounded-md border border-white/10 bg-[#0B0F17] px-2.5 py-1 font-mono text-[10px] tracking-[0.12em] text-[#38bdf8] uppercase">
                11 Detector Layers
              </span>
              <span className="rounded-md border border-white/10 bg-[#0B0F17] px-2.5 py-1 font-mono text-[10px] tracking-[0.12em] text-slate-400 uppercase">
                8 Pipeline Stages
              </span>
              <span className="rounded-md border border-white/10 bg-[#0B0F17] px-2.5 py-1 font-mono text-[10px] tracking-[0.12em] text-slate-400 uppercase">
                Open REST API
              </span>
            </div>
          </div>

          <div>
            <h3 className="font-mono text-[10.5px] tracking-[0.18em] text-[#38bdf8] uppercase">Forensic Stack</h3>
            <ul className="mt-4 grid gap-2 text-[13px] text-slate-400">
              {layers.map((l) => (
                <li key={l} className="flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-[#0099ff]" />
                  <span>{l}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-mono text-[10.5px] tracking-[0.18em] text-[#38bdf8] uppercase">Platform</h3>
            <ul className="mt-4 grid gap-2.5 text-[13px]">
              <li>
                <Link className="text-slate-400 transition-colors hover:text-white" href="/analyze">
                  Analysis workbench
                </Link>
              </li>
              <li>
                <Link className="text-slate-400 transition-colors hover:text-white" href="/cases">
                  Case register
                </Link>
              </li>
              <li>
                <a className="text-slate-400 transition-colors hover:text-white" href="/api/layers">
                  Engine contract (JSON)
                </a>
              </li>
              <li>
                <a className="text-slate-400 transition-colors hover:text-white" href="/#pipeline-flow">
                  Inspection pipeline
                </a>
              </li>
            </ul>
            <h3 className="mt-8 font-mono text-[10.5px] tracking-[0.18em] text-[#38bdf8] uppercase">Runtime</h3>
            <p className="mt-3 text-[13px] leading-relaxed text-slate-400">
              FastAPI Python Worker (OpenCV &amp; scikit-learn) + Next.js Web Workbench. Multi-signal evidence fusion.
            </p>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-white/10 pt-6 text-[12px] text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Forgify · Digital Forensics Platform.</p>
          <p className="font-mono tracking-[0.1em] text-slate-400 uppercase">
            Investigate Every Layer · Detect Every Forgery
          </p>
        </div>
      </div>
    </footer>
  );
}
