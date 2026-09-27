"use client";

import { useEffect, useRef } from "react";

type VoiceOrbProps = {
  active: boolean;
  isSpeaking: boolean;
  getInputVolume: () => number;
  getOutputVolume: () => number;
};

/** Pulsing orb driven by the live volume: orange while Noura speaks, blue while she listens. */
export function VoiceOrb({ active, isSpeaking, getInputVolume, getOutputVolume }: VoiceOrbProps) {
  const orbRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const orb = orbRef.current;
    if (!active || !orb) return;
    let frame = 0;
    const tick = () => {
      let volume = 0;
      try {
        volume = isSpeaking ? getOutputVolume() : getInputVolume();
      } catch {
        volume = 0;
      }
      orb.style.transform = `scale(${1 + Math.min(volume, 1) * 0.35})`;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      orb.style.transform = "";
    };
  }, [active, isSpeaking, getInputVolume, getOutputVolume]);

  return (
    <div className="flex h-52 items-center justify-center">
      <div
        ref={orbRef}
        className={`h-36 w-36 rounded-full transition-[background] duration-500 ${
          active
            ? isSpeaking
              ? "bg-[radial-gradient(circle_at_35%_30%,#ffc9a3,#f26522_55%,#a83a06)]"
              : "bg-[radial-gradient(circle_at_35%_30%,#ffffff,#6f8fbf_55%,#02285f)]"
            : "bg-[radial-gradient(circle_at_35%_30%,#ffffff,#e3e8f0_60%,#b3bfd1)]"
        } shadow-[0_20px_60px_rgba(2,40,95,0.25)]`}
      />
    </div>
  );
}
