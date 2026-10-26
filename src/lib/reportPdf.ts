"use client";

import type { AnalysisReport } from "@/lib/forensics/types";

// ---------------------------------------------------------------------------
// Sanitization & PDF escaping
// ---------------------------------------------------------------------------

function sanitizeText(input: string): string {
  if (!input) return "";
  // Map common unicode to ascii, then strip remaining non-ascii
  const map: Record<string, string> = {
    "×": "x",
    "–": "-",
    "—": "-",
    "•": "-",
    "…": "...",
    "©": "(c)",
    "®": "(r)",
    "™": "TM",
    "→": "->",
    "←": "<-",
    "’": "'",
    "‘": "'",
    "“": '"',
    "”": '"',
    "·": "-",
    "˚": "deg",
    "°": "deg",
    "²": "2",
    "³": "3",
    "½": "1/2",
  };
  let out = "";
  for (const ch of input) {
    if (map[ch] !== undefined) out += map[ch];
    else if (ch.charCodeAt(0) >= 32 && ch.charCodeAt(0) <= 126) out += ch;
    else if (ch === "\n" || ch === "\t") out += ch === "\t" ? " " : "\n";
    else if (ch.charCodeAt(0) > 126) out += " ";
    else out += ch;
  }
  // Collapse control chars except newline (handled separately)
  return out;
}

function pdfEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace("#", "").trim();
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  const num = parseInt(h, 16);
  if (Number.isNaN(num)) return [0, 0, 0];
  const r = ((num >> 16) & 255) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;
  return [r, g, b];
}

// ---------------------------------------------------------------------------
// Minimal PDF writer — A4, Helvetica / Helvetica-Bold, pagination
// ---------------------------------------------------------------------------

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN_L = 40;
const MARGIN_R = 40;
const MARGIN_T = 40;
const MARGIN_B = 46; // reserve for footer
const USABLE_W = PAGE_W - MARGIN_L - MARGIN_R;

class PdfWriter {
  pages: string[] = [""];
  y = 800;
  current = 0;

  private append(op: string) {
    this.pages[this.current] += op;
  }

  newPage() {
    this.pages.push("");
    this.current++;
    this.y = 800;
  }

  ensureSpace(needed: number) {
    if (this.y - needed < MARGIN_B + 4) {
      this.newPage();
    }
  }

  // --- low level ---

  private colorOp(hex: string, stroke = false): string {
    const [r, g, b] = hexToRgb(hex);
    return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} ${stroke ? "RG" : "rg"}\n`;
  }

  addText(
    text: string,
    x: number,
    y: number,
    size: number,
    font: "/F1" | "/F2" = "/F1",
    color = "#071122",
  ) {
    const safe = pdfEscape(sanitizeText(text));
    const [r, g, b] = hexToRgb(color);
    // Use q/Q to isolate color, then BT/Tm for absolute positioning
    this.append(
      `q\n${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg\nBT\n${font} ${size} Tf\n1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm\n(${safe}) Tj\nET\nQ\n`,
    );
  }

  addRect(x: number, y: number, w: number, h: number, fillHex: string) {
    const [r, g, b] = hexToRgb(fillHex);
    this.append(`q\n${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg\n${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f\nQ\n`);
  }

  addLine(x1: number, y1: number, x2: number, y2: number, color = "#e2e8f2", width = 0.6) {
    const [r, g, b] = hexToRgb(color);
    this.append(
      `q\n${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG\n${width.toFixed(2)} w\n${x1.toFixed(2)} ${y1.toFixed(2)} m\n${x2.toFixed(2)} ${y2.toFixed(2)} l\nS\nQ\n`,
    );
  }

  // --- high level helpers ---

  private measure(text: string, size: number): number {
    // Helvetica approx 0.52 * size per char at 1.0 scale (close enough for wrapping)
    // Tabs/spaces same. Slight over-estimate prevents overflow.
    return text.length * size * 0.52;
  }

  wrap(text: string, maxW: number, size: number): string[] {
    const sanitized = sanitizeText(text);
    // Respect explicit newlines
    const paragraphs = sanitized.split("\n");
    const lines: string[] = [];
    for (const para of paragraphs) {
      if (!para.trim()) {
        lines.push("");
        continue;
      }
      const words = para.split(/\s+/).filter(Boolean);
      let cur = "";
      for (const w of words) {
        const test = cur ? cur + " " + w : w;
        if (this.measure(test, size) > maxW && cur) {
          // word itself may be longer than maxW — hard break it
          if (this.measure(w, size) > maxW) {
            // flush cur first
            lines.push(cur);
            let chunk = "";
            for (const ch of w) {
              if (this.measure(chunk + ch, size) > maxW && chunk) {
                lines.push(chunk);
                chunk = ch;
              } else chunk += ch;
            }
            cur = chunk;
          } else {
            lines.push(cur);
            cur = w;
          }
        } else {
          cur = test;
        }
      }
      if (cur) lines.push(cur);
    }
    return lines.length ? lines : [""];
  }

  addSpacer(h: number) {
    this.ensureSpace(h);
    this.y -= h;
  }

  addDivider() {
    this.ensureSpace(10);
    this.addLine(MARGIN_L, this.y, PAGE_W - MARGIN_R, this.y, "#e2e8f2", 0.7);
    this.y -= 10;
  }

  addHeading(text: string, size = 12, color = "#071122") {
    const lines = this.wrap(text, USABLE_W, size);
    const lh = size * 1.35;
    this.ensureSpace(lines.length * lh + 4);
    for (const line of lines) {
      this.addText(line, MARGIN_L, this.y, size, "/F2", color);
      this.y -= lh;
    }
    this.y -= 2;
  }

  addSubHeading(text: string, size = 9.5, color = "#1d4a86") {
    const lines = this.wrap(text, USABLE_W, size);
    const lh = size * 1.4;
    this.ensureSpace(lines.length * lh + 4);
    for (const line of lines) {
      this.addText(line, MARGIN_L, this.y, size, "/F2", color);
      this.y -= lh;
    }
    this.y -= 2;
  }

  addParagraph(text: string, size = 8.2, color = "#334155", leading = 11, indent = 0) {
    if (!text) return;
    const maxW = USABLE_W - indent;
    const lines = this.wrap(text, maxW, size);
    const x = MARGIN_L + indent;
    this.ensureSpace(lines.length * leading + 2);
    for (const line of lines) {
      if (!line) {
        this.y -= leading * 0.6;
        this.ensureSpace(leading);
        continue;
      }
      this.addText(line, x, this.y, size, "/F1", color);
      this.y -= leading;
    }
    this.y -= 1;
  }

  addBoldParagraph(text: string, size = 8.2, color = "#0f172a", leading = 11, indent = 0) {
    if (!text) return;
    const maxW = USABLE_W - indent;
    const lines = this.wrap(text, maxW, size);
    const x = MARGIN_L + indent;
    this.ensureSpace(lines.length * leading + 2);
    for (const line of lines) {
      if (!line) {
        this.y -= leading * 0.6;
        this.ensureSpace(leading);
        continue;
      }
      this.addText(line, x, this.y, size, "/F2", color);
      this.y -= leading;
    }
    this.y -= 1;
  }

  addBullet(text: string, size = 8.2, color = "#334155", bulletColor = "#1a3ff5") {
    const bullet = " -  ";
    const indent = 12;
    const maxW = USABLE_W - indent - 6;
    const lines = this.wrap(text, maxW, size);
    const lh = 11;
    this.ensureSpace(lines.length * lh + 2);
    // first line with bullet
    if (lines[0] !== undefined) {
      this.addText(bullet.trim(), MARGIN_L + 2, this.y, size, "/F1", bulletColor);
      this.addText(lines[0], MARGIN_L + indent, this.y, size, "/F1", color);
      this.y -= lh;
      for (let i = 1; i < lines.length; i++) {
        this.addText(lines[i], MARGIN_L + indent, this.y, size, "/F1", color);
        this.y -= lh;
      }
    }
    this.y -= 1;
  }

  addLabeledValue(label: string, value: string, labelW = 118, size = 8.2) {
    const lh = 11;
    const valueW = USABLE_W - labelW - 8;
    const vLines = this.wrap(value || "-", valueW, size);
    const needed = vLines.length * lh;
    this.ensureSpace(needed + 2);
    // label (bold) on first line
    this.addText(label, MARGIN_L, this.y, size, "/F2", "#475569");
    for (let i = 0; i < vLines.length; i++) {
      this.addText(vLines[i], MARGIN_L + labelW, this.y - i * lh, size, "/F1", "#0f172a");
    }
    this.y -= Math.max(lh, needed);
    this.y -= 2;
  }

  addBadgeLine(text: string, size = 7.5, color = "#0f6b4f", bg = "#f1faf6") {
    // Simple inline badge: drawn as colored text in brackets
    this.addParagraph(text, size, color, 10, 0);
  }

  addTableRow(label: string, value: string, labelSize = 7.8, valSize = 7.8) {
    this.addLabeledValue(label, value, 132, valSize);
  }

  // footers added after content
  addFooters(caseCode: string) {
    const total = this.pages.length;
    for (let i = 0; i < total; i++) {
      const pageNumText = `Page ${i + 1} of ${total}`;
      const left = "Forgify  -  Forensic Analysis Report  -  Confidential";
      const right = sanitizeText(caseCode || "UNREGISTERED");
      // We need to temporarily switch to target page to append
      const prev = this.current;
      this.current = i;
      // footer line
      this.addLine(MARGIN_L, 30, PAGE_W - MARGIN_R, 30, "#e2e8f2", 0.5);
      // left
      this.addText(left, MARGIN_L, 20, 6, "/F1", "#6b7c99");
      // center page number (approx centered)
      const cx = PAGE_W / 2 - 22;
      this.addText(pageNumText, cx, 20, 6, "/F1", "#6b7c99");
      // right
      const rw = this.measure(right, 6);
      this.addText(right, PAGE_W - MARGIN_R - rw, 20, 6, "/F1", "#6b7c99");
      this.current = prev;
    }
  }

  // Build final PDF blob
  buildBlob(): Blob {
    // finalize pages: ensure each page content ends cleanly (no extra ops needed)
    const N = this.pages.length;
    const header = "%PDF-1.4\n";
    const encoder = new TextEncoder();

    const objects: string[] = [];

    // 1 catalog
    objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
    // 2 pages
    const kids = Array.from({ length: N }, (_, i) => `${3 + i} 0 R`).join(" ");
    objects.push(`2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${N} >>\nendobj\n`);
    // pages
    for (let i = 0; i < N; i++) {
      const contentNum = 3 + N + i;
      objects.push(
        `${3 + i} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${3 + 2 * N} 0 R /F2 ${4 + 2 * N} 0 R >> >> /Contents ${contentNum} 0 R >>\nendobj\n`,
      );
    }
    // contents
    for (let i = 0; i < N; i++) {
      const content = this.pages[i] || "";
      const byteLen = encoder.encode(content).length;
      objects.push(`${3 + N + i} 0 obj\n<< /Length ${byteLen} >>\nstream\n${content}\nendstream\nendobj\n`);
    }
    // fonts
    objects.push(`${3 + 2 * N} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`);
    objects.push(`${4 + 2 * N} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n`);

    // compute offsets using byte lengths
    let pdfBytes: Uint8Array[] = [];
    const headerBytes = encoder.encode(header);
    pdfBytes.push(headerBytes);
    let offsets: number[] = [0];
    let pos = headerBytes.length;
    const objBytes: Uint8Array[] = objects.map((o) => encoder.encode(o));
    for (const b of objBytes) {
      offsets.push(pos);
      pdfBytes.push(b);
      pos += b.length;
    }
    const xrefOffset = pos;
    const xrefHeader = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    const xrefBytes = encoder.encode(xrefHeader);
    pdfBytes.push(xrefBytes);
    pos += xrefBytes.length;

    for (let i = 1; i <= objects.length; i++) {
      const line = String(offsets[i]).padStart(10, "0") + " 00000 n \n";
      const lb = encoder.encode(line);
      pdfBytes.push(lb);
      pos += lb.length;
    }

    const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    const trailerBytes = encoder.encode(trailer);
    pdfBytes.push(trailerBytes);

    // concat
    const totalLen = pdfBytes.reduce((a, b) => a + b.length, 0);
    const out = new Uint8Array(totalLen);
    let off = 0;
    for (const b of pdfBytes) {
      out.set(b, off);
      off += b.length;
    }
    return new Blob([out], { type: "application/pdf" });
  }
}

// ---------------------------------------------------------------------------
// Content helpers
// ---------------------------------------------------------------------------

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function bandLabel(risk: number): string {
  if (risk >= 86) return "Forged";
  if (risk >= 68) return "Likely forged";
  if (risk >= 45) return "Suspicious";
  if (risk >= 24) return "Low risk";
  return "Authentic";
}

function bandColor(risk: number): string {
  if (risk >= 86) return "#8f1d1d";
  if (risk >= 68) return "#b42318";
  if (risk >= 45) return "#b54708";
  if (risk >= 24) return "#1d4a86";
  return "#0f6b4f";
}

function shortHash(hash: string, size = 12): string {
  if (!hash) return "-";
  if (hash.length <= size + 6) return hash;
  return `${hash.slice(0, size)}...${hash.slice(-6)}`;
}

function severityLabel(s: string): string {
  const m: Record<string, string> = {
    critical: "Critical",
    high: "High",
    medium: "Medium",
    low: "Low",
    info: "Info",
    benign: "Benign",
  };
  return m[s] ?? s;
}

// ---------------------------------------------------------------------------
// Build report
// ---------------------------------------------------------------------------

export function buildReportPdfBlob(report: AnalysisReport): Blob {
  const w = new PdfWriter();

  // Top color bar
  w.addRect(0, PAGE_H - 4, PAGE_W, 4, "#1a3ff5");

  // Header — branding
  w.y = 800;
  w.addText("Forgify", MARGIN_L, w.y, 14, "/F2", "#061529");
  w.addText("DIGITAL FORENSICS ENGINE", MARGIN_L + 62, w.y + 1, 7, "/F1", "#64748b");
  // engine badge right
  const engineText = `${report.engine.name} v${report.engine.version}  -  ${report.engine.backend}`;
  const engW = (engineText.length * 6 * 0.52);
  w.addText(engineText, PAGE_W - MARGIN_R - engW, w.y, 6.5, "/F1", "#64748b");
  w.y -= 18;
  w.addLine(MARGIN_L, w.y, PAGE_W - MARGIN_R, w.y, "#e2e8f2", 0.7);
  w.y -= 14;

  // Title
  w.addHeading("Forensic Analysis Report", 16, "#061529");
  w.addParagraph(`Exhibit-level forensic examination  |  Generated ${new Date(report.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}  |  ${report.durationMs} ms`, 7.5, "#64748b", 10);
  w.addSpacer(4);

  // Case code band
  const risk = report.verdict.riskScore;
  const band = bandLabel(risk);
  const bColor = bandColor(risk);
  // Draw badge area: risk box
  w.ensureSpace(44);
  const boxY = w.y - 30;
  w.addRect(MARGIN_L, boxY, USABLE_W, 36, "#f8fafc");
  w.addLine(MARGIN_L, boxY, MARGIN_L, boxY + 36, bColor, 3);
  w.addText(band.toUpperCase(), MARGIN_L + 10, w.y - 6, 9, "/F2", bColor);
  w.addText(report.caseCode || "UNREGISTERED", MARGIN_L + 10, w.y - 20, 10, "/F2", "#0f172a");
  const scoreText = `Risk ${Math.round(risk)}/100`;
  const confText = `conf ${Math.round(report.verdict.confidence * 100)}%`;
  const agreeText = `agreement ${report.fusion.agreement.toFixed(2)}`;
  const scoreW = scoreText.length * 7 * 0.52;
  w.addText(scoreText, PAGE_W - MARGIN_R - 170, w.y - 6, 8, "/F2", bColor);
  w.addText(confText, PAGE_W - MARGIN_R - 170, w.y - 18, 7, "/F1", "#475569");
  w.addText(agreeText, PAGE_W - MARGIN_R - 85, w.y - 12, 7, "/F1", "#475569");
  w.y = boxY - 10;
  w.addSpacer(2);

  // File summary
  w.addSubHeading("Exhibit summary", 9.5, "#0f172a");
  w.addDivider();
  w.addLabeledValue("File name:", report.file.name);
  w.addLabeledValue("MIME / kind:", `${report.file.mimeType}  /  ${report.container.detectedType}  (${report.file.kind})`);
  if (report.file.dimensions) w.addLabeledValue("Dimensions:", report.file.dimensions);
  if (report.file.pages) w.addLabeledValue("Pages:", String(report.file.pages));
  w.addLabeledValue("Size:", `${fmtBytes(report.file.sizeBytes)}  (${report.file.sizeBytes.toLocaleString()} bytes)`);
  w.addLabeledValue("Analysed:", `${new Date(report.createdAt).toISOString()}  (${report.durationMs} ms)`);
  w.addLabeledValue("Modules:", `${report.engine.modulesExecuted}/${report.engine.modulesRegistered}  executed`);
  w.addLabeledValue("Backend:", report.engine.backend);
  w.addSpacer(4);

  // Verdict
  w.addSubHeading("Verdict & recommendation", 9.5, "#0f172a");
  w.addDivider();
  // Verdict label line
  const verdictColor = bColor;
  w.addParagraph(`Verdict: ${band}  (label: ${report.verdict.label})`, 8.6, verdictColor, 11);
  w.addParagraph(report.verdict.recommendation, 8.2, "#1e293b", 11);
  w.addSpacer(2);
  w.addParagraph(`Chain of custody: ${report.verdict.chainOfCustody}`, 7.2, "#64748b", 10);
  w.addSpacer(4);

  // Hashes & container
  w.addSubHeading("Evidence integrity — hashes", 9.5, "#0f172a");
  w.addDivider();
  w.addLabeledValue("SHA-256:", report.hashes.sha256);
  w.addLabeledValue("SHA-1:", report.hashes.sha1);
  w.addLabeledValue("MD5:", report.hashes.md5);
  w.addLabeledValue("Fingerprint:", report.hashes.blurHashFingerprint);
  w.addLabeledValue("Byte entropy:", `${report.hashes.byteEntropy} b/B`);
  if (report.hashes) w.addSpacer(4);

  w.addSubHeading("Container observations", 9.5, "#0f172a");
  w.addDivider();
  if (report.container.containerNotes.length) {
    for (const n of report.container.containerNotes) w.addBullet(n, 7.8, "#334155");
  } else {
    w.addParagraph("No container anomalies noted.", 7.8, "#64748b");
  }
  w.addSpacer(2);
  w.addLabeledValue("Declared type:", report.container.declaredType || "-");
  w.addLabeledValue("Detected type:", report.container.detectedType || "-");
  w.addLabeledValue("Type mismatch:", report.container.typeMismatch ? "Yes" : "No");
  w.addLabeledValue("EXIF / XMP / ICC:", `${report.container.exifPresent ? "yes" : "no"} / ${report.container.xmpPresent ? "yes" : "no"} / ${report.container.iccPresent ? "yes" : "no"}`);
  if (report.container.width && report.container.height) w.addLabeledValue("Image size:", `${report.container.width} x ${report.container.height} px`);
  if (report.container.quantizationQuality !== undefined) w.addLabeledValue("JPEG quality est.:", String(report.container.quantizationQuality));
  w.addSpacer(4);

  // Layers overview
  w.addSubHeading(`Layer results — ${report.layers.length} layers`, 9.5, "#0f172a");
  w.addDivider();
  const sorted = [...report.layers].sort((a, b) => b.score - a.score);
  for (const l of sorted) {
    const statusColor = l.status === "alert" ? "#b42318" : l.status === "review" ? "#b54708" : "#475569";
    w.ensureSpace(28);
    w.addText(l.name, MARGIN_L, w.y, 8.4, "/F2", "#0f172a");
    const right = `score ${(l.score * 100).toFixed(0)}  |  conf ${(l.confidence * 100).toFixed(0)}%  |  ${l.status}`;
    const rw = right.length * 7.5 * 0.52;
    w.addText(right, PAGE_W - MARGIN_R - rw, w.y, 7.2, "/F1", statusColor);
    w.y -= 11;
    w.addParagraph(l.summary, 7.5, "#334155", 10);
    w.addParagraph(`Runtime: ${l.runtime}  -  ${l.durationMs} ms  -  weight ${l.weight.toFixed(2)}  -  mode ${l.mode}`, 6.8, "#64748b", 9);
    if (l.metrics.length) {
      const metricLine = l.metrics.slice(0, 4).map((m) => `${m.label}: ${m.value}`).join("  |  ");
      if (metricLine) w.addParagraph(metricLine, 6.8, "#475569", 9);
    }
    w.y -= 2;
    w.addLine(MARGIN_L, w.y, PAGE_W - MARGIN_R, w.y, "#f1f5f9", 0.5);
    w.y -= 6;
  }
  w.addSpacer(2);

  // Fusion
  w.addSubHeading("Evidence fusion", 9.5, "#0f172a");
  w.addDivider();
  w.addLabeledValue("Method:", report.fusion.method);
  w.addLabeledValue("Risk score:", `${report.fusion.riskScore}/100`);
  w.addLabeledValue("Confidence:", `${(report.fusion.confidence * 100).toFixed(1)}%`);
  w.addLabeledValue("Agreement:", report.fusion.agreement.toFixed(2));
  w.addLabeledValue("Alerts:", String(report.fusion.alertCount));
  w.addSpacer(2);
  w.addParagraph("Rationale:", 7.8, "#0f172a", 10);
  for (const r of report.fusion.rationale) w.addBullet(r, 7.5, "#334155");
  if (report.fusion.contributions?.length) {
    w.addSpacer(2);
    w.addParagraph("Per-layer contributions:", 7.8, "#0f172a", 10);
    for (const c of report.fusion.contributions) {
      w.addBullet(`${c.name} (${c.layer}): score ${(c.score * 100).toFixed(0)}  weight ${c.weight.toFixed(2)}  -> ${c.contribution.toFixed(3)}  [${c.status}]`, 7.2, "#475569");
    }
  }
  w.addSpacer(4);

  // Findings — ordered by severity
  w.addSubHeading(`Findings — ${report.findings.length} total (ordered by severity)`, 9.5, "#0f172a");
  w.addDivider();
  const order = ["critical", "high", "medium", "low", "info", "benign"];
  const ordered = [...report.findings].sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));
  if (!ordered.length) {
    w.addParagraph("No findings raised. All layers returned pass / neutral.", 7.8, "#64748b");
  } else {
    for (let idx = 0; idx < ordered.length; idx++) {
      const f = ordered[idx];
      const sColor = f.severity === "critical" ? "#8f1d1d" : f.severity === "high" ? "#b42318" : f.severity === "medium" ? "#b54708" : f.severity === "low" ? "#1d4a86" : "#475569";
      w.ensureSpace(40);
      // header line
      w.addText(`${severityLabel(f.severity).toUpperCase()}`, MARGIN_L, w.y, 7, "/F2", sColor);
      w.addText(f.code, MARGIN_L + 62, w.y, 6.5, "/F1", "#64748b");
      w.addText(f.layer, MARGIN_L + 132, w.y, 6.5, "/F1", "#1a3ff5");
      const confStr = `conf ${(f.confidence * 100).toFixed(0)}%`;
      const cw = confStr.length * 6.5 * 0.52;
      w.addText(confStr, PAGE_W - MARGIN_R - cw, w.y, 6.5, "/F1", "#475569");
      w.y -= 10;
      w.addBoldParagraph(f.title, 8.4, "#0f172a", 11);
      w.addParagraph(f.description, 7.8, "#334155", 10);
      if (f.metric) w.addParagraph(`Metric: ${f.metric}`, 7, "#64748b", 9);
      if (f.evidence.length) {
        for (const ev of f.evidence) {
          w.addLabeledValue(`${ev.label}:`, ev.value, 132, 7.2);
        }
      }
      if (f.region) {
        w.addParagraph(`Region: x ${f.region.x.toFixed(3)} y ${f.region.y.toFixed(3)} w ${f.region.width.toFixed(3)} h ${f.region.height.toFixed(3)}`, 6.8, "#64748b", 9);
      }
      if (f.recommendation) {
        w.ensureSpace(16);
        w.addParagraph(`Recommended action: ${f.recommendation}`, 7.2, "#1e293b", 10);
      }
      w.y -= 2;
      w.addLine(MARGIN_L, w.y, PAGE_W - MARGIN_R, w.y, "#f1f5f9", 0.5);
      w.y -= 8;
    }
  }
  w.addSpacer(2);

  // Regions
  w.addSubHeading(`Suspicious regions — ${report.regions.length} localised`, 9.5, "#0f172a");
  w.addDivider();
  if (!report.regions.length) {
    w.addParagraph("No localised regions. Global scores only.", 7.8, "#64748b");
  } else {
    for (const r of report.regions) {
      w.ensureSpace(28);
      w.addText(r.label, MARGIN_L, w.y, 7.8, "/F2", "#0f172a");
      const meta = `${r.layer}  |  score ${(r.score * 100).toFixed(0)}  |  conf ${(r.confidence * 100).toFixed(0)}%`;
      const mw = meta.length * 6.5 * 0.52;
      w.addText(meta, PAGE_W - MARGIN_R - mw, w.y, 6.5, "/F1", "#475569");
      w.y -= 11;
      const box = `x ${r.x.toFixed(3)} y ${r.y.toFixed(3)} w ${r.width.toFixed(3)} h ${r.height.toFixed(3)}  —  ${r.technique}`;
      w.addParagraph(box, 6.8, "#475569", 9);
      if (r.notes) w.addParagraph(r.notes, 7, "#334155", 10);
      w.y -= 2;
      w.addLine(MARGIN_L, w.y, PAGE_W - MARGIN_R, w.y, "#f8fafc", 0.5);
      w.y -= 6;
    }
  }
  w.addSpacer(2);

  // Unified regions if present
  if (report.unifiedRegions?.length) {
    w.addSubHeading(`Unified regions — ${report.unifiedRegions.length} merged`, 9.5, "#0f172a");
    w.addDivider();
    for (const ur of report.unifiedRegions) {
      w.ensureSpace(24);
      w.addText(ur.regionType, MARGIN_L, w.y, 7.8, "/F2", "#0f172a");
      w.y -= 10;
      w.addParagraph(`Detectors: ${ur.detectors.join(", ")}  |  conf ${(ur.confidence * 100).toFixed(0)}%`, 6.8, "#475569", 9);
      w.addParagraph(`Why suspicious: ${ur.whySuspicious}`, 7.2, "#334155", 10);
      if (ur.evidence.length) for (const ev of ur.evidence) w.addBullet(ev, 6.8, "#475569");
      w.y -= 2;
    }
    w.addSpacer(2);
  }

  // OCR
  w.addSubHeading(`OCR & text — ${report.ocr.wordCount} words, mean conf ${(report.ocr.meanConfidence * 100).toFixed(1)}%`, 9.5, "#0f172a");
  w.addDivider();
  w.addLabeledValue("Engine:", report.ocr.engine);
  w.addLabeledValue("Mode / language:", `${report.ocr.mode} / ${report.ocr.language}`);
  w.addLabeledValue("Blocks:", String(report.ocr.blocks.length));
  const low = report.ocr.blocks.filter((b) => b.confidence < 0.8).length;
  w.addLabeledValue("Low confidence:", String(low));
  w.addSpacer(2);
  if (report.ocr.blocks.length) {
    w.addParagraph("Recovered blocks (index | text | confidence):", 7.5, "#0f172a", 10);
    for (const b of report.ocr.blocks.slice(0, 80)) {
      const conf = `${(b.confidence * 100).toFixed(0)}%`;
      const flag = b.anomalies.length ? ` [${b.anomalies.join(", ")}]` : "";
      const line = `${String(b.index).padStart(2, "0")}: "${b.text}"  ${conf}${flag}`;
      w.addBullet(line, 6.6, b.anomalies.length ? "#b42318" : "#334155");
    }
    if (report.ocr.blocks.length > 80) w.addParagraph(`... and ${report.ocr.blocks.length - 80} more blocks (see JSON export for full text).`, 6.8, "#64748b", 9);
  } else {
    w.addParagraph(report.ocr.text ? report.ocr.text.slice(0, 1200) : "No text recovered. The exhibit may be a pure image, scan without embedded text, or OCR was unavailable.", 7.5, "#334155", 10);
  }
  w.addSpacer(4);

  // Metadata
  w.addSubHeading(`Metadata — ${report.metadata.length} entries`, 9.5, "#0f172a");
  w.addDivider();
  if (!report.metadata.length) {
    w.addParagraph("No metadata entries recovered (missing metadata is treated as neutral, never suspicious).", 7.8, "#64748b");
  } else {
    // group by group name
    const groups = new Map<string, typeof report.metadata>();
    for (const m of report.metadata) {
      const list = groups.get(m.group) ?? [];
      list.push(m);
      groups.set(m.group, list);
    }
    for (const [group, entries] of groups) {
      w.addParagraph(group.toUpperCase(), 7.5, "#1d4a86", 10);
      for (const e of entries) {
        const flag = e.flag && e.flag !== "ok" ? ` [${e.flag}]` : ` [${e.source}]`;
        w.addLabeledValue(`${e.key}:`, `${e.value}${flag}`, 138, 7);
      }
      w.addSpacer(2);
    }
  }
  w.addSpacer(2);

  // Reference
  w.addSubHeading("Reference comparison", 9.5, "#0f172a");
  w.addDivider();
  w.addLabeledValue("Mode:", report.reference.mode);
  if (report.reference.candidateLabel) w.addLabeledValue("Reference:", report.reference.candidateLabel);
  if (report.reference.deltaNotes.length) {
    for (const n of report.reference.deltaNotes.slice(0, 20)) w.addBullet(n, 7.2, "#334155");
  } else {
    w.addParagraph("No reference exhibit supplied. Examination ran in reference-free mode.", 7.5, "#64748b", 10);
  }
  w.addSpacer(4);

  // Pipeline
  w.addSubHeading(`Pipeline trace — ${report.pipeline.length} steps, total ${report.durationMs} ms`, 9.5, "#0f172a");
  w.addDivider();
  for (const step of report.pipeline) {
    w.ensureSpace(22);
    w.addText(String(step.step).padStart(2, "0"), MARGIN_L, w.y, 7, "/F2", "#475569");
    w.addText(step.label, MARGIN_L + 16, w.y, 7.5, "/F2", "#0f172a");
    const stColor = step.status === "alert" ? "#b42318" : step.status === "warn" ? "#b54708" : "#0f6b4f";
    const st = step.status.toUpperCase();
    const sw = st.length * 6 * 0.52;
    w.addText(st, PAGE_W - MARGIN_R - sw - 36, w.y, 6, "/F2", stColor);
    w.addText(`${step.durationMs} ms`, PAGE_W - MARGIN_R - 30, w.y, 6, "/F1", "#64748b");
    w.y -= 10;
    w.addParagraph(step.detail, 6.8, "#475569", 9);
    w.y -= 1;
  }
  w.addSpacer(4);

  // Limitations
  w.addSubHeading("Limitations & disclaimer", 9.5, "#b42318");
  w.addDivider();
  for (const lim of report.limitations) w.addBullet(lim, 7, "#334155");
  w.addSpacer(6);
  w.addParagraph("This report is generated evidence to assist human examination. It does not certify authenticity or forgery, does not replace issuer verification, and must be read alongside chain-of-custody and provenance records. Findings marked neutral / missing are not suspicious — they are absent evidence.", 7, "#b42318", 10);
  w.addParagraph("Detector outputs are evidence, not proof. A consistent semantic result proves internal arithmetic identities hold; it does not certify the document against the issuing authority.", 7, "#64748b", 10);
  w.addSpacer(8);
  w.addParagraph(`Report ID: ${report.id || "—"}  |  Case: ${report.caseCode}  |  Engine: ${report.engine.name} v${report.engine.version} (${report.engine.backend})`, 6.5, "#64748b", 9);

  // footers
  w.addFooters(report.caseCode);

  return w.buildBlob();
}

export function downloadReportPdf(report: AnalysisReport): void {
  try {
    const blob = buildReportPdfBlob(report);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sanitizeText(report.caseCode || "forgify")}-report.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  } catch (e) {
    console.error("PDF export failed", e);
    // fallback: download JSON if PDF fails
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.caseCode || "forgify"}-report.pdf.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
}
