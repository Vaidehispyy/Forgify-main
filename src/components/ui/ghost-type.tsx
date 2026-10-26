"use client";

import { useEffect, useState } from "react";

interface GhostTypeProps {
  phrases?: string[];
  typingSpeed?: number;
  deletingSpeed?: number;
  pauseDuration?: number;
  className?: string;
  cursorClassName?: string;
}

const DEFAULT_PHRASES = [
  "Forensic analysis that proves manipulation.",
  "Multi-signal evidence you can defend.",
  "Detect every synthetic artifact and forged layer.",
  "Zero black-box guesswork. Mathematical certainty.",
];

export function GhostType({
  phrases = DEFAULT_PHRASES,
  typingSpeed = 50,
  deletingSpeed = 25,
  pauseDuration = 2200,
  className = "",
  cursorClassName = "",
}: GhostTypeProps) {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const currentPhrase = phrases[phraseIndex];

    if (isPaused) {
      const timer = setTimeout(() => {
        setIsPaused(false);
        setIsDeleting(true);
      }, pauseDuration);
      return () => clearTimeout(timer);
    }

    if (!isDeleting && charIndex === currentPhrase.length) {
      setIsPaused(true);
      return;
    }

    if (isDeleting && charIndex === 0) {
      setIsDeleting(false);
      setPhraseIndex((prev) => (prev + 1) % phrases.length);
      return;
    }

    const speed = isDeleting ? deletingSpeed : typingSpeed;
    const timer = setTimeout(() => {
      setCharIndex((prev) => (isDeleting ? prev - 1 : prev + 1));
    }, speed);

    return () => clearTimeout(timer);
  }, [charIndex, isDeleting, isPaused, phraseIndex, phrases, typingSpeed, deletingSpeed, pauseDuration, mounted]);

  const currentPhrase = phrases[phraseIndex] || "";
  const displayedText = currentPhrase.slice(0, charIndex);
  const ghostText = currentPhrase.slice(charIndex);

  if (!mounted) {
    return (
      <span className={className}>
        <span>{phrases[0]}</span>
      </span>
    );
  }

  return (
    <span className={`inline-block font-sans ${className}`}>
      <span className="text-white">{displayedText}</span>
      <span
        aria-hidden="true"
        className="inline-block w-[2.5px] h-[1em] ml-1 align-[-0.1em] bg-[#0099ff] animate-pulse"
      />
      <span
        aria-hidden="true"
        className="select-none text-slate-500/40 transition-opacity duration-150"
      >
        {ghostText}
      </span>
    </span>
  );
}
