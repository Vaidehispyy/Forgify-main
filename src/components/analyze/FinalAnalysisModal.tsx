"use client";

import { useEffect, useMemo, useRef } from "react";
import type { AnalysisReport, Finding } from "@/lib/forensics/types";
import { fmtBytes, SEVERITY_STYLE } from "@/lib/format";

export type FinalVerdictCategory =
  | "potentially_forged"
  | "no_tampering_detected"
  | "inconclusive";

export interface FinalAnalysisDetails {
  category: FinalVerdictCategory;
  title: string;
  badgeText: string;
  badgeStyle: { bg: string; color: string; border: string };
  riskLabel: "High Risk" | "Medium Risk" | "Low Risk" | "Inconclusive";
  riskColor: string;
  riskScore: number;
  confidencePct: number;
  explanation: string;
  keyFindings: Finding[];
  executedLayersCount: number;
  totalLayersCount: number;
}

export function deriveFinalAnalysis(report: AnalysisReport): FinalAnalysisDetails {
  const risk = report.verdict.riskScore ?? 0;
  const confidence = report.verdict.confidence ?? 0.6;
  const label = report.verdict.label;
  const findings = report.findings ?? [];
  const layers = report.layers ?? [];

  // Sort findings by severity
  const order = ["critical", "high", "medium", "low", "info", "benign"];
  const sortedFindings = [...findings].sort(
    (a, b) => order.indexOf(a.severity) - order.indexOf(b.severity)
  );

  const highCriticalFindings = sortedFindings.filter(
    (f) => f.severity === "critical" || f.severity === "high"
  );

  const executedCount = report.engine?.modulesExecuted ?? layers.filter((l) => l.status !== "skipped").length;
  const totalCount = report.engine?.modulesRegistered ?? (layers.length || 10);

  // Determine state category
  let category: FinalVerdictCategory = "no_tampering_detected";
  let title = "No Significant Tampering Detected";
  let badgeText = "Consistent";
  let badgeStyle = { bg: "#f1faf6", color: "#0f6b4f", border: "#c6e6d9" };
  let riskLabel: "High Risk" | "Medium Risk" | "Low Risk" | "Inconclusive" = "Low Risk";
  let riskColor = "#0f6b4f";

  const hasDefinitiveForgeryAlert = highCriticalFindings.some((f) =>
    ["SEM-ARITH", "ID-MISMATCH", "PAN-SYNTAX", "AI-GEN", "CM-CLONE", "COPY-MOVE", "REF-FIELD", "OCR_FIELD_MISMATCH"].includes(f.code)
  );

  if (risk >= 68 || label === "forged" || label === "likely-forged" || (hasDefinitiveForgeryAlert && risk >= 45)) {
    category = "potentially_forged";
    title = "Potentially Forged / Tampered";
    badgeText = "Tampering Alert";
    badgeStyle = { bg: "#fef4f3", color: "#a32117", border: "#f2cfc9" };
    riskLabel = "High Risk";
    riskColor = "#b42318";
  } else if (risk >= 45 || label === "suspicious" || executedCount < 4) {
    category = "inconclusive";
    title = "Inconclusive — Review Needed";
    badgeText = "Review";
    badgeStyle = { bg: "#fffaeb", color: "#9a4109", border: "#f0dcae" };
    riskLabel = "Medium Risk";
    riskColor = "#b54708";
  } else {
    category = "no_tampering_detected";
    title = "No Tampering Detected";
    badgeText = "Consistent";
    badgeStyle = { bg: "#f1faf6", color: "#0f6b4f", border: "#c6e6d9" };
    riskLabel = "Low Risk";
    riskColor = risk >= 24 ? "#17427a" : "#0f6b4f";
  }

  // Derive short, concise explanation from findings
  let explanation = "";

  const arithFinding = findings.find((f) => f.code === "SEM-ARITH");
  const idFinding = findings.find((f) =>
    ["ID-MISMATCH", "PAN-SYNTAX", "REF-FIELD", "OCR_FIELD_MISMATCH", "ID-CHECKSUM"].includes(f.code)
  );
  const aigcFinding = findings.find((f) => f.code === "AI-GEN");
  const cloneFinding = findings.find((f) => f.code === "CM-CLONE" || f.code === "COPY-MOVE");
  const srmFinding = findings.find((f) => f.code === "SRM-LOCAL" || f.code === "PX-ELA");
  const smoothFinding = findings.find((f) => f.code === "PX-SMOOTH");

  if (category === "potentially_forged") {
    if (arithFinding) {
      explanation = "Discrepancy detected between line items and printed total.";
    } else if (idFinding) {
      explanation = `Identifier syntax or layout anomaly detected (${idFinding.title}).`;
    } else if (aigcFinding) {
      explanation = "Synthetic AI-generation artifacts detected in pixel frequencies.";
    } else if (cloneFinding) {
      explanation = "Duplicated image regions detected (copy-move alteration).";
    } else if (srmFinding) {
      explanation = "Localized noise and compression table anomalies detected.";
    } else if (smoothFinding) {
      explanation = "Unnatural smoothing and edge alterations detected.";
    } else {
      explanation = "Multiple anomalies indicate probable document tampering.";
    }
  } else if (category === "inconclusive") {
    explanation = "Inconclusive signals detected. Manual verification recommended.";
  } else {
    explanation = "All forensic checks passed with no suspicious alterations detected.";
  }

  // Key findings (top 2 or 3 non-benign findings, or highest severity)
  const keyFindings = sortedFindings
    .filter((f) => f.severity !== "benign" && f.severity !== "info")
    .slice(0, 3);
  if (keyFindings.length === 0 && sortedFindings.length > 0) {
    keyFindings.push(sortedFindings[0]);
  }

  return {
    category,
    title,
    badgeText,
    badgeStyle,
    riskLabel,
    riskColor,
    riskScore: risk,
    confidencePct: Math.round(confidence * 100),
    explanation,
    keyFindings,
    executedLayersCount: executedCount,
    totalLayersCount: totalCount,
  };
}

export function FinalAnalysisModal({
  isOpen,
  onClose,
  report,
}: {
  isOpen: boolean;
  onClose: () => void;
  report: AnalysisReport | null;
}) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  const details = useMemo(() => {
    if (!report) return null;
    return deriveFinalAnalysis(report);
  }, [report]);

  if (!isOpen || !report || !details) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="final-analysis-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-navy-950/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div
        ref={modalRef}
        className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-hairline bg-white shadow-2xl transition-all"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-hairline px-5 py-4 bg-surface/40">
          <div className="min-w-0 pr-3">
            <span className="font-mono text-[10px] font-semibold tracking-[0.14em] text-electric-600 uppercase">
              Forensic Analysis
            </span>
            <h2
              id="final-analysis-title"
              className="truncate text-lg font-bold tracking-tight text-navy-950"
            >
              {report.file.name}
            </h2>
            <p className="font-mono text-[11px] text-graphite-500">
              {report.container.detectedType || report.file.mimeType} · {fmtBytes(report.file.sizeBytes)}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-graphite-400 transition-colors hover:bg-navy-50 hover:text-navy-900 focus:outline-none focus:ring-2 focus:ring-electric-500"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-5 space-y-4">
          {/* Main Verdict Card */}
          <div
            className="rounded-xl border p-4"
            style={{
              backgroundColor: details.badgeStyle.bg,
              borderColor: details.badgeStyle.border,
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className="rounded px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider uppercase"
                style={{
                  backgroundColor: details.badgeStyle.color,
                  color: "#ffffff",
                }}
              >
                {details.badgeText}
              </span>
              <span
                className="font-mono text-[11.5px] font-bold tracking-wide"
                style={{ color: details.riskColor }}
              >
                Risk {details.riskScore}/100 · {details.confidencePct}% Conf
              </span>
            </div>

            <h3 className="mt-2 text-base font-bold text-navy-950">
              {details.title}
            </h3>

            <p className="mt-1.5 text-[13px] leading-snug text-navy-900">
              {details.explanation}
            </p>
          </div>

          {/* Key Findings (Short list, title only) */}
          <div>
            <div className="flex items-center justify-between pb-1.5">
              <span className="font-mono text-[10.5px] font-bold tracking-[0.1em] text-navy-900 uppercase">
                Key Findings
              </span>
              <span className="font-mono text-[10.5px] text-graphite-500">
                {report.findings.length} total
              </span>
            </div>

            <div className="space-y-1.5">
              {details.keyFindings.length > 0 ? (
                details.keyFindings.map((f) => {
                  const s = SEVERITY_STYLE[f.severity] ?? SEVERITY_STYLE.info;
                  return (
                    <div
                      key={f.id || f.code}
                      className="flex items-center justify-between gap-2 rounded-lg border border-hairline bg-surface/40 px-3 py-2 text-[12px]"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider"
                          style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
                        >
                          {s.label}
                        </span>
                        <span className="shrink-0 font-mono text-[10.5px] text-graphite-500">
                          {f.code}
                        </span>
                        <span className="truncate font-medium text-navy-900">
                          {f.title}
                        </span>
                      </div>
                      <span className="shrink-0 font-mono text-[10px] text-graphite-500">
                        {(f.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-lg border border-dashed border-hairline py-3 px-3 text-center text-[12px] text-graphite-500">
                  No significant anomalies detected.
                </div>
              )}
            </div>
          </div>

          {/* Compact Coverage Strip */}
          <div className="flex items-center justify-between rounded-lg bg-surface/50 px-3 py-2 font-mono text-[10.5px] text-graphite-500 border border-hairline">
            <span>{details.executedLayersCount} of {details.totalLayersCount} layers verified</span>
            <span>{report.durationMs} ms</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-hairline bg-surface/40 px-5 py-3">
          <span className="font-mono text-[10.5px] text-graphite-400">
            Esc to dismiss
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-navy-950 px-4 py-2 text-[12.5px] font-semibold text-white shadow-sm transition-colors hover:bg-navy-900 focus:outline-none focus:ring-2 focus:ring-electric-500"
          >
            View Full Report
          </button>
        </div>
      </div>
    </div>
  );
}
