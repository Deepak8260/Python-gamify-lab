"use client";

import LabMap from "./LabMap";
import { COND_LEVELS, COND_TRACKS } from "@/lib/condLevels";
import { conceptReport, useCondStats } from "@/lib/condStats";
import { useProgress } from "@/lib/progress";

const TONES: Record<string, string> = { foundations: "teal", facts: "indigo", boolean: "sky", combining: "purple", real: "rose", boss: "amber" };

export default function CondLabMap() {
  return (
    <LabMap
      slug="conditions"
      eyebrow="Lab 2"
      title="Condition Lab"
      blurb="Write the decision logic behind real systems: sign-ups, payments, API gateways, deployments and firewalls. Every level tests your code on visible and hidden cases."
      levels={COND_LEVELS}
      tracks={COND_TRACKS.map((t) => ({ ...t, tone: TONES[t.id] }))}
    >
      <ConceptReport />
    </LabMap>
  );
}

/** Which concepts the student has practised, mastered, and made mistakes with. */
function ConceptReport() {
  const stats = useCondStats();
  const { done, ready } = useProgress();
  if (!ready) return null;
  const rows = conceptReport(COND_LEVELS, stats, done("conditions"));
  const mastered = rows.filter((r) => r.state === "mastered").length;
  const practised = rows.filter((r) => r.state !== "new").length;
  const tricky = rows.filter((r) => r.mistakes > 0).sort((a, b) => b.mistakes - a.mistakes).slice(0, 3);

  return (
    <section className="track concept-report">
      <div className="track-head">
        <span className="track-emoji" aria-hidden>
          📊
        </span>
        <div>
          <h2>Concept coverage</h2>
          <p>
            {practised} of {rows.length} concepts practised · {mastered} mastered (every level that uses it is complete)
          </p>
        </div>
      </div>
      {tricky.length > 0 && (
        <p className="concept-tricky">
          Most mistakes so far: {tricky.map((r) => `${r.label} (${r.mistakes})`).join(", ")}. Replaying the levels that use them is good practice.
        </p>
      )}
      <div className="concept-grid">
        {rows.map((r) => (
          <div key={r.concept} className={`concept-card ${r.state}`}>
            <div className="concept-top">
              <b>{r.label}</b>
              <span className="concept-state">{r.state === "mastered" ? "✓ mastered" : r.state === "practised" ? "practising" : `from level ${r.firstLevel}`}</span>
            </div>
            <small>{r.blurb}</small>
            <div className="lab-progress">
              <div className="bar">
                <i style={{ width: `${(r.completed / r.levels.length) * 100}%` }} />
              </div>
              <span>
                {r.completed}/{r.levels.length} levels
              </span>
            </div>
            {r.mistakes > 0 && <span className="concept-mistakes">⚠ {r.mistakes} mistake{r.mistakes === 1 ? "" : "s"}</span>}
          </div>
        ))}
      </div>
    </section>
  );
}
