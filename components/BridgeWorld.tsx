"use client";

import type { ReactNode } from "react";
import type { Inputs } from "@/lib/condLevels";
import type { TraceNode } from "@/lib/interpreter";

export type HikerMode = "idle" | "walk" | "fall" | "cheer" | "confused" | "nod" | "sad";
export type HikerState = { x: number; y: number; facing: 1 | -1; mode: HikerMode; dur: number; say: string | null };
export type Decision = { keyword: "if" | "elif" | "else"; trace: TraceNode | null; taken: boolean; key: number } | null;
export type RoundMark = "pending" | "now" | "ok" | "bad";

// layout (percent of the world box)
export const SINGLE_Y = 56;
export const ROUTE_Y: Record<string, number> = { A: 30, B: 52, C: 74 };
export const START_X = 11;
export const END_X = 89;

type Props = {
  scene: "bridge" | "routes";
  inputs: Inputs;
  changed: Set<string>;
  hiker: HikerState;
  broken: string | null; // "single" | "A" | "B" | "C" when a bridge gives way
  picked: string | null;
  decision: Decision;
  rounds: RoundMark[];
  banner: { text: string; key: number } | null;
  children?: ReactNode;
};

const fmt = (v: boolean | number | string) => (typeof v === "boolean" ? (v ? "True" : "False") : typeof v === "string" ? `"${v}"` : String(v));

export default function BridgeWorld({ scene, inputs, changed, hiker, broken, picked, decision, rounds, banner, children }: Props) {
  const i = inputs;
  const night = i.is_night === true;
  const storm = i.weather === "storm";
  const windy = i.weather === "windy" || i.bridge_safe === false;
  const fog = i.foggy === true;

  const sky = night ? "sky-night" : storm ? "sky-storm" : "sky-day";

  return (
    <div className={`world bridge-world ${sky}`}>
      <div className="bw-sky" />
      {night && (
        <div className="stars" aria-hidden>
          {Array.from({ length: 22 }).map((_, k) => (
            <i key={k} style={{ left: `${(k * 41) % 100}%`, top: `${(k * 29) % 45}%`, animationDelay: `${(k % 5) * 0.5}s` }} />
          ))}
        </div>
      )}
      {night ? <div className="moon" /> : !storm && <div className="sun" />}
      {!night && !storm && (
        <>
          <div className="cloud c1" />
          <div className="cloud c2" />
        </>
      )}
      {storm && <div className="storm-clouds" aria-hidden />}

      {/* canyon */}
      <div className="mountains" aria-hidden />
      <div className="river" aria-hidden />
      <div className={`cliff left ${scene}`} aria-hidden />
      <div className={`cliff right ${scene}`} aria-hidden />
      {scene === "routes" && (
        <>
          <div className="ladder" aria-hidden />
          {(["A", "B", "C"] as const).map((r) => (
            <div key={r} aria-hidden>
              <div className="ledge l" style={{ top: `${ROUTE_Y[r]}%` }} />
              <div className="ledge r" style={{ top: `${ROUTE_Y[r]}%` }} />
            </div>
          ))}
        </>
      )}
      <div className="flag" style={{ top: `${scene === "bridge" ? SINGLE_Y : ROUTE_Y.A}%` }} aria-hidden>
        <span />
      </div>

      {scene === "bridge" ? (
        <RopeBridge
          y={SINGLE_Y}
          state={broken === "single" ? "falling" : i.bridge_safe === false ? "damaged" : typeof i.bridge_strength === "number" && i.bridge_strength < 60 ? "worn" : "ok"}
          closed={i.bridge_closed === true}
          sign={
            typeof i.limit === "number"
              ? `MAX ${i.limit} kg`
              : typeof i.bridge_strength === "number"
                ? `strength ${i.bridge_strength}`
                : i.bridge_safe === false
                  ? "⚠ DANGER"
                  : null
          }
          signWarn={i.bridge_safe === false}
          active={hiker.x > START_X + 1}
        />
      ) : (
        (["A", "B", "C"] as const).map((r) => (
          <RopeBridge
            key={r}
            y={ROUTE_Y[r]}
            label={r}
            state={broken === r ? "falling" : "ok"}
            closed={(r === "B" && i.b_closed === true) || (r === "A" && i.weather === "windy" && "b_closed" in i)}
            sign={r === "A" ? "fast" : r === "C" ? "easy" : null}
            active={picked === r}
          />
        ))
      )}

      {/* weather on top of the scene */}
      {storm && <div className="rain" aria-hidden />}
      {windy && !storm && <div className="wind" aria-hidden><i /><i /><i /><i /></div>}
      {fog && <div className="fog" aria-hidden />}
      {night && !fog && <div className="night-shade" aria-hidden />}

      {/* the hiker */}
      <div
        className={`hiker mode-${hiker.mode}`}
        style={{ left: `${hiker.x}%`, top: `${hiker.y}%`, transitionDuration: `${hiker.dur}ms` }}
      >
        {i.guide === true && (
          <div className="guide" aria-hidden>
            <HikerSvg coat="#0ea5e9" hat="#1e293b" />
          </div>
        )}
        <div className="hiker-body" style={{ transform: `scaleX(${hiker.facing})` }}>
          <HikerSvg />
          {i.lantern === true && <span className="lantern" aria-hidden />}
        </div>
        <div className="badges">
          {typeof i.weight === "number" && <span>{i.weight} kg</span>}
          {typeof i.energy === "number" && <span>⚡ {i.energy}</span>}
          {i.emergency_pass === true && <span>🎫 pass</span>}
          {i.vip_pass === true && <span>⭐ VIP</span>}
        </div>
        {hiker.say && <div className="say">{hiker.say}</div>}
        {hiker.mode === "fall" && <div className="splash big" aria-hidden />}
      </div>

      {/* what the game gives you */}
      <div className="given-card">
        <div className="given-title">Set by the game</div>
        {Object.entries(i).map(([k, v]) => (
          <div key={k} className={`given-row ${changed.has(k) ? "changed" : ""}`}>
            <code>{k}</code>
            <span className={`val ${typeof v}`}>{fmt(v)}</span>
          </div>
        ))}
      </div>

      {/* rounds */}
      {rounds.length > 1 && (
        <div className="round-strip" aria-label="Rounds">
          {rounds.map((r, k) => (
            <span key={k} className={r}>
              {r === "ok" ? "✓" : r === "bad" ? "✗" : k + 1}
            </span>
          ))}
        </div>
      )}

      {banner && (
        <div key={banner.key} className="banner">
          {banner.text}
        </div>
      )}

      {decision && <DecisionPanel d={decision} />}

      {children}
    </div>
  );
}

function RopeBridge({
  y,
  state,
  closed,
  sign,
  signWarn,
  label,
  active,
}: {
  y: number;
  state: "ok" | "damaged" | "worn" | "falling";
  closed?: boolean;
  sign?: string | null;
  signWarn?: boolean;
  label?: string;
  active?: boolean;
}) {
  const planks = 18;
  const gap = new Set(state === "damaged" || state === "falling" ? [7, 8, 9, 10] : []);
  return (
    <div className={`rope-bridge ${state} ${active ? "active" : ""}`} style={{ top: `${y}%` }}>
      <svg viewBox="0 0 600 50" preserveAspectRatio="none" aria-hidden>
        <path d="M0 2 Q300 34 600 2" className="rope" />
        <path d="M0 -14 Q300 18 600 -14" className="rope top" />
        {Array.from({ length: planks }).map((_, k) => {
          const t = (k + 0.5) / planks;
          const px = t * 600;
          const py = 2 + 4 * 16 * t * (1 - t);
          const missing = gap.has(k);
          const cracked = state === "worn" && k % 4 === 1;
          return (
            <g key={k}>
              <line x1={px} y1={py - 14} x2={px} y2={py} className="hanger" />
              {!missing || state === "falling" ? (
                <rect
                  x={px - 14}
                  y={py - 1}
                  width="28"
                  height="7"
                  rx="2"
                  className={`plank ${cracked ? "cracked" : ""} ${missing ? "drop" : ""}`}
                  style={missing ? { animationDelay: `${(k - 7) * 0.08}s` } : undefined}
                />
              ) : null}
            </g>
          );
        })}
      </svg>
      <span className="post l" />
      <span className="post r" />
      {label && <span className="bridge-label">{label}</span>}
      {sign && <span className={`bridge-sign ${signWarn ? "warn" : ""}`}>{sign}</span>}
      {closed && <span className="barrier">CLOSED</span>}
    </div>
  );
}

function DecisionPanel({ d }: { d: NonNullable<Decision> }) {
  return (
    <div key={d.key} className={`decision ${d.taken ? "taken" : "skip"}`} aria-live="polite">
      <div className="decision-head">
        <code>
          <b>{d.keyword}</b>
          {d.trace ? ` ${d.trace.src}` : ""}:
        </code>
      </div>
      {d.trace && <TraceRows node={d.trace} depth={0} />}
      <div className="decision-foot">
        {d.keyword === "else" ? "nothing above was True → run the else block" : d.taken ? "True → run this block" : "False → skip this block"}
      </div>
    </div>
  );
}

function TraceRows({ node, depth }: { node: TraceNode; depth: number }) {
  const showSelf = depth > 0 || node.kids.length === 0 || node.shown;
  return (
    <>
      {showSelf && (
        <div className="trace-row" style={{ paddingLeft: depth * 12 }}>
          <code>{node.src}</code>
          {node.shown && !node.skipped && <span className="arrow">→ {node.shown}</span>}
          <span className={`pill ${node.skipped ? "skipped" : node.truthy ? "t" : "f"}`}>{node.skipped ? "skipped" : node.value}</span>
        </div>
      )}
      {node.kids.map((k, idx) => (
        <TraceRows key={idx} node={k} depth={showSelf ? depth + 1 : depth} />
      ))}
      {depth === 0 && node.kids.length > 0 && (
        <div className="trace-row total">
          <code>{node.kind === "not" ? "not …" : node.kids.map((k) => (k.skipped ? "…" : k.value)).join(` ${node.kind} `)}</code>
          <span className={`pill ${node.truthy ? "t" : "f"}`}>{node.value}</span>
        </div>
      )}
    </>
  );
}

function HikerSvg({ coat = "#16a34a", hat = "#f97316" }: { coat?: string; hat?: string }) {
  return (
    <svg viewBox="0 0 40 64" className="hiker-svg" aria-hidden>
      <rect x="6" y="22" width="12" height="20" rx="4" fill="#92400e" />
      <g className="legs">
        <rect className="leg l" x="14" y="44" width="5" height="16" rx="2.5" fill="#334155" />
        <rect className="leg r" x="21" y="44" width="5" height="16" rx="2.5" fill="#1e293b" />
      </g>
      <rect x="12" y="22" width="17" height="24" rx="6" fill={coat} />
      <rect className="arm" x="25" y="25" width="5" height="15" rx="2.5" fill={coat} />
      <circle cx="21" cy="14" r="8" fill="#fcd9b6" />
      <circle cx="24" cy="13" r="1.3" fill="#1e293b" />
      <path d="M11 11 Q21 1 31 11 Z" fill={hat} />
      <rect x="9" y="10" width="24" height="3" rx="1.5" fill={hat} />
    </svg>
  );
}
