"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Robot from "./Robot";
import LoopHud, { type Hud } from "./LoopHud";
import type { RobotLevel } from "@/lib/loopLevels";

export type RobotState = {
  pos: number;
  facing: 1 | -1;
  hop: number; // changes on every jump to restart the hop animation
  dur: number; // ms
  falling: boolean;
  happy: boolean;
};

type Props = {
  level: RobotLevel;
  robot: RobotState;
  visited: Set<number>;
  bubble: { text: string; key: number } | null;
  ballGot: boolean;
  hud: Hud;
  busy: boolean;
  children?: ReactNode;
};

export default function RobotWorld({ level, robot, visited, bubble, ballGot, hud, busy, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(900);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const lo = Math.min(...level.tiles);
  const hi = Math.max(...level.tiles);
  const hasWater = level.tiles.length !== hi - lo + 1;
  const tileSet = new Set(level.tiles);
  const pathSet = new Set(level.path);
  const cracked = new Set(level.cracked ?? []);
  const gems = level.gems ?? [];
  const scene = level.scene ?? "day";

  // one block in pixels: fit the start, the whole route and a little margin
  const left = Math.min(level.start, ...level.path);
  const right = Math.max(level.start, ...level.path);
  const need = right - left + 3.4;
  const u = Math.max(38, Math.min(92, w / need));
  const home = (left + right) / 2;
  const half = w / u / 2 - 0.9;
  let cam = home;
  if (robot.pos > home + half) cam = robot.pos - half;
  if (robot.pos < home - half) cam = robot.pos + half;
  const shift = w / 2 - cam * u;

  const positions: number[] = [];
  for (let x = lo - (hasWater ? 3 : 0); x <= hi + (hasWater ? 3 : 0); x++) positions.push(x);

  return (
    <div
      ref={ref}
      className={`world robot-world scene-${scene} ${hasWater ? "has-water" : ""}`}
      style={{ ["--u" as string]: `${u}px`, ["--move" as string]: `${robot.dur}ms` }}
    >
      <div className="sky" />
      <div className="sun" />
      {scene === "night" && (
        <div className="stars" aria-hidden>
          {STARS.map(([x, y], k) => (
            <i key={k} style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${(k % 5) * 0.6}s` }} />
          ))}
        </div>
      )}
      <div className="cloud c1" />
      <div className="cloud c2" />
      {!hasWater && (
        <svg className="hills" viewBox="0 0 1200 200" preserveAspectRatio="none" aria-hidden>
          <path d="M0 140 C 180 60, 320 60, 480 120 S 800 170, 980 90 S 1150 70, 1200 100 L1200 200 L0 200Z" fill="#d9f0e3" />
          <path d="M0 170 C 220 110, 420 130, 620 160 S 1000 120, 1200 150 L1200 200 L0 200Z" fill="#c4e7d3" />
        </svg>
      )}
      {hasWater && <div className="water" />}

      <div className="stage" style={{ transform: `translateX(${shift}px)` }}>
        {positions.map((x) => {
          if (cracked.has(x)) {
            return (
              <div key={x} className="tile cracked" style={{ left: `calc(${x} * var(--u))` }}>
                <div className="tile-top" />
                <div className="tile-front">
                  <span>{x}</span>
                </div>
              </div>
            );
          }
          if (!tileSet.has(x)) {
            return hasWater ? (
              <div key={x} className="water-mark" style={{ left: `calc(${x} * var(--u))` }}>
                {x}
              </div>
            ) : null;
          }
          const kind = x === level.start ? "start" : x === level.ball ? "goal" : pathSet.has(x) ? "block" : "stone";
          return (
            <div key={x} className={`tile ${kind} ${visited.has(x) ? "lit" : ""}`} style={{ left: `calc(${x} * var(--u))` }}>
              <div className="tile-top" />
              <div className="tile-front">
                <span>{x}</span>
              </div>
              {kind === "start" && <div className="tile-cap">start</div>}
            </div>
          );
        })}

        {/* gems, collected when Robo lands on them */}
        {gems.map((g) => (
          <div key={g} className={`gem-wrap ${visited.has(g) ? "got" : ""}`} style={{ left: `calc(${g} * var(--u))` }}>
            <div className="gem" />
          </div>
        ))}

        {/* ball, sitting on the last block of the path */}
        <div
          className={`ball-wrap ${ballGot ? "got" : ""} ${!ballGot && Math.abs(robot.pos - level.ball) < 0.5 ? "front" : ""}`}
          style={{ left: `calc(${ballGot ? robot.pos : level.ball} * var(--u))` }}
        >
          <div className="ball-shadow" />
          <div className="ball" />
          {ballGot && (
            <div className="sparkles" aria-hidden>
              {Array.from({ length: 10 }).map((_, k) => (
                <i key={k} style={{ ["--a" as string]: `${k * 36}deg` }} />
              ))}
            </div>
          )}
        </div>

        {/* Robo */}
        <div
          className={`robot ${robot.falling ? "falling" : ""}`}
          style={{ transform: `translateX(calc(${robot.pos} * var(--u)))` }}
        >
          <div key={robot.hop} className={`robot-anim ${robot.hop > 0 ? "hopping" : ""} ${robot.happy ? "cheer" : ""}`}>
            <div className="robot-shadow" />
            <div className="robot-body">
              <div style={{ transform: `scaleX(${robot.facing})` }} className="robot-flip">
                <Robot happy={robot.happy} busy={busy} />
              </div>
              {bubble && (
                <div key={bubble.key} className="bubble">
                  {bubble.text}
                </div>
              )}
            </div>
          </div>
          {robot.falling && hasWater && <div className="splash" aria-hidden />}
        </div>
      </div>

      <LoopHud hud={hud} />
      {children}
    </div>
  );
}

// fixed star positions for night scenes, as [left %, top %]
const STARS = [
  [6, 12], [14, 30], [22, 8], [31, 22], [39, 6], [47, 28], [55, 14], [63, 5], [70, 24], [78, 10], [86, 30], [93, 16],
];
