"use client";

import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { py, type Inputs, type Outcome, type Value } from "@/lib/condLevels";
import type { TraceNode } from "@/lib/interpreter";

export type Decision = { keyword: "if" | "elif" | "else"; trace: TraceNode | null; taken: boolean; key: number } | null;
export type RoundMark = "pending" | "now" | "ok" | "bad";
/** idle → request arrives → your code decides → routed to an outcome (or stuck without one) */
export type Stage = "idle" | "incoming" | "deciding" | "routed" | "stuck";

type Props = {
  system: { name: string; icon: string; request: string };
  outcomes: Outcome[];
  inputs: Inputs;
  changed: Set<string>;
  stage: Stage;
  picked: Value | null;
  expected: Value | null; // shown when the pick was wrong
  ok: boolean | null;
  decision: Decision;
  assigned: string | null;
  rounds: RoundMark[];
  visibleCount: number;
  testLabel: string | null;
  roundKey: number;
  banner: { text: string; key: number } | null;
  children?: ReactNode;
};

const fmt = (v: Value) => (typeof v === "string" ? `"${v}"` : py(v));

/**
 * Condition Lab scene: a request arrives with the values, the student's code
 * runs in the decision engine, and the request is routed to one outcome.
 */
export default function SystemWorld(p: Props) {
  const hiddenMarks = p.rounds.slice(p.visibleCount);
  return (
    <div className={`world sys-world stage-${p.stage}`}>
      <div className="sys-bg" aria-hidden />

      {p.rounds.length > 1 && (
        <div className="round-strip" aria-label="Tests">
          {p.rounds.slice(0, p.visibleCount).map((r, k) => (
            <span key={k} className={r}>
              {r === "ok" ? "✓" : r === "bad" ? "✗" : k + 1}
            </span>
          ))}
          {hiddenMarks.length > 0 && (
            <span className="hidden-group" title={`${hiddenMarks.length} hidden tests`}>
              <Lock size={11} />
              {hiddenMarks.map((r, k) => (
                <i key={k} className={r} />
              ))}
            </span>
          )}
        </div>
      )}

      {p.banner && (
        <div key={p.banner.key} className="banner">
          {p.banner.text}
        </div>
      )}

      <div className="sys-flow">
        <div key={p.roundKey} className="sys-ticket">
          <div className="sys-ticket-head">
            <span>📨 {p.system.request}</span>
            {p.testLabel && <em>{p.testLabel}</em>}
          </div>
          {Object.entries(p.inputs).map(([k, v]) => (
            <div key={k} className={`given-row ${p.changed.has(k) ? "changed" : ""}`}>
              <code>{k}</code>
              <span className={`val ${typeof v}`}>{fmt(v)}</span>
            </div>
          ))}
        </div>

        <div className="sys-wire in" aria-hidden>
          <i />
        </div>

        <div className="sys-engine">
          <div className="sys-engine-head">
            <span className="sys-engine-icon" aria-hidden>
              {p.system.icon}
            </span>
            <div>
              <b>{p.system.name}</b>
              <small>your code decides</small>
            </div>
          </div>
          <div className="sys-engine-body">
            {p.stage === "stuck" ? (
              <div className="sys-engine-note bad">⚠ No usable decision</div>
            ) : p.decision ? (
              <DecisionPanel d={p.decision} />
            ) : (
              <div className="sys-engine-note">
                {p.stage === "idle" ? "Waiting for a request…" : p.stage === "routed" ? "Decision made" : "Running your code…"}
              </div>
            )}
          </div>
          {p.assigned && (
            <div key={p.assigned} className="sys-assigned">
              <code>{p.assigned}</code>
            </div>
          )}
        </div>

        <div className="sys-wire out" aria-hidden>
          <i />
        </div>

        <div className="sys-lanes" role="list">
          {p.outcomes.map((o) => {
            const isPicked = p.stage === "routed" && p.picked === o.value;
            const isExpected = p.stage === "routed" && p.ok === false && p.expected === o.value;
            return (
              <div
                key={String(o.value)}
                role="listitem"
                className={`lane tone-${o.tone} ${isPicked ? `picked ${p.ok ? "ok" : "bad"}` : ""} ${isExpected ? "expected" : ""}`}
              >
                <span className="lane-icon" aria-hidden>
                  {o.icon}
                </span>
                <span className="lane-text">
                  <b>{o.label}</b>
                  <code>{py(o.value)}</code>
                </span>
                {isPicked && <span className="lane-tag">{p.ok ? "✓" : "✗ your code"}</span>}
                {isExpected && <span className="lane-tag expected">expected</span>}
              </div>
            );
          })}
        </div>
      </div>

      {p.children}
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
