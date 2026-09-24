"use client";

import type { ReactNode } from "react";
import LoopHud, { type Hud } from "./LoopHud";
import type { GaugeLevel } from "@/lib/loopLevels";

export type RocketMode = "idle" | "ready" | "launch" | "sputter" | "overflow";

type Props = {
  level: GaugeLevel;
  value: number | null; // last printed value (null = nothing printed yet)
  pulse: number; // changes on every print, restarts the pump animation
  mode: RocketMode;
  hud: Hud;
  dur: number;
  children?: ReactNode;
};

export default function RocketWorld({ level, value, pulse, mode, hud, dur, children }: Props) {
  const shown = value ?? level.start;
  const pct = (v: number) => Math.max(0, Math.min(100, (v / level.max) * 100));
  const up = level.dir === "up";
  const temp = !up;
  const over = value !== null && (up ? value > level.limit : value < level.limit);

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(level.max * f));

  return (
    <div className={`world rocket-world mode-${mode}`} style={{ ["--pump" as string]: `${dur}ms` }}>
      <div className="night" />
      <div className="stars" aria-hidden>
        {Array.from({ length: 28 }).map((_, k) => (
          <i key={k} style={{ left: `${(k * 37) % 100}%`, top: `${(k * 53) % 62}%`, animationDelay: `${(k % 7) * 0.4}s` }} />
        ))}
      </div>
      <div className="moon" />
      <div className="ground" />

      {/* launch pad + rocket */}
      <div className="pad-area">
        <div className="tower" aria-hidden>
          <i />
          <i />
          <i />
          <i />
        </div>
        <div className="rocket">
          <div className="rocket-shake">
            <svg viewBox="0 0 80 190" className="rocket-svg" aria-hidden>
              <defs>
                <linearGradient id="rk-body" x1="0" x2="1">
                  <stop offset="0" stopColor="#e2e8f0" />
                  <stop offset=".45" stopColor="#ffffff" />
                  <stop offset="1" stopColor="#cbd5e1" />
                </linearGradient>
              </defs>
              <path d="M40 4 C 60 22, 64 48, 64 70 L16 70 C 16 48, 20 22, 40 4Z" fill="#ef4444" />
              <rect x="16" y="68" width="48" height="92" rx="6" fill="url(#rk-body)" />
              <circle cx="40" cy="96" r="12" fill="#1e3a8a" stroke="#94a3b8" strokeWidth="4" />
              <circle cx="36" cy="92" r="4" fill="#93c5fd" />
              <rect x="16" y="128" width="48" height="6" fill="#ef4444" opacity=".85" />
              <path d="M16 120 L2 160 L2 172 L16 160Z" fill="#dc2626" />
              <path d="M64 120 L78 160 L78 172 L64 160Z" fill="#dc2626" />
              <path d="M34 150 L46 150 L44 172 L36 172Z" fill="#b91c1c" />
              <rect x="26" y="160" width="28" height="12" rx="3" fill="#475569" />
            </svg>
            <div className="flame" aria-hidden />
          </div>
          {(mode === "launch" || mode === "sputter") && (
            <div className="smoke" aria-hidden>
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
          )}
        </div>
        <div className="pad" />
      </div>

      {/* hose from the pump/gauge to the rocket */}
      <div className="hose" aria-hidden>
        {pulse > 0 && <i key={pulse} className={up ? "" : "rev"} />}
      </div>

      {/* gauge */}
      <div className={`gauge ${temp ? "temp" : ""} ${over ? "over" : ""}`}>
        <div className="gauge-title">{level.label}</div>
        <div key={pulse} className="readout">
          {shown}
          {level.unit}
        </div>
        <div className="gauge-bar">
          <div className="gauge-fill" style={{ height: `${pct(Math.max(0, shown))}%` }} />
          {ticks.map((t) => (
            <div key={t} className="tick" style={{ bottom: `${pct(t)}%` }}>
              <span>{t}</span>
            </div>
          ))}
          <div className="mark target" style={{ bottom: `${pct(level.target)}%` }}>
            <span>{up ? `ready ${level.target}+` : `launch below ${level.target}${level.unit}`}</span>
          </div>
          <div className="mark limit" style={{ bottom: `${pct(level.limit)}%` }}>
            <span>{up ? `max ${level.limit}` : `freezes ${level.limit}${level.unit}`}</span>
          </div>
          {mode === "overflow" && up && (
            <div className="spill" aria-hidden>
              <i />
              <i />
              <i />
            </div>
          )}
        </div>
      </div>

      <LoopHud hud={hud} />
      {children}
    </div>
  );
}
