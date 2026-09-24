import { repr, type LoopInfo } from "@/lib/interpreter";

export type Hud = {
  loops: LoopInfo[];
  step: number;
  vars: Record<string, string>;
  check: { cond: string; result: boolean } | null;
} | null;

/** Floating card that shows what the loop is doing right now. */
export default function LoopHud({ hud }: { hud: Hud }) {
  if (!hud) return null;
  const loop = hud.loops[hud.loops.length - 1];
  const extra = Object.entries(hud.vars).filter(([k]) => k !== loop?.varName).slice(0, 3);

  return (
    <div className="hud" aria-live="polite">
      {loop ? (
        <div className="hud-row">
          <span className="hud-label">{loop.total !== null ? "for loop" : "while loop"}</span>
          <span className="hud-count">
            {loop.total !== null ? (
              <>
                {loop.iteration}
                <em> / {loop.total}</em>
              </>
            ) : (
              <>
                <em>round </em>
                {loop.iteration}
              </>
            )}
          </span>
        </div>
      ) : (
        <div className="hud-row">
          <span className="hud-label">step</span>
          <span className="hud-count">{hud.step}</span>
        </div>
      )}

      {hud.check && (
        <div key={`c${hud.step}`} className={`hud-check ${hud.check.result ? "yes" : "no"}`}>
          <code>{hud.check.cond}</code>
          <span>{hud.check.result ? "True → go again" : "False → stop"}</span>
        </div>
      )}

      {loop?.varName && (
        <div className="hud-var">
          {loop.varName} = <b key={`${hud.step}`}>{hud.vars[loop.varName] ?? "…"}</b>
        </div>
      )}
      {extra.map(([k, v]) => (
        <div key={k} className="hud-var">
          {k} = <b key={`${k}${hud.step}${v}`}>{v}</b>
        </div>
      ))}

      {loop?.values && loop.values.length > 0 && (
        <div className="hud-chips">
          {loop.values.map((v, k) => (
            <span key={k} className={k + 1 === loop.iteration ? "on" : k + 1 < loop.iteration ? "done" : ""}>
              {repr(v)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
