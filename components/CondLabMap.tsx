"use client";

import LabMap from "./LabMap";
import { COND_LEVELS, COND_TRACKS } from "@/lib/condLevels";

const TONES: Record<string, string> = { first: "teal", numbers: "indigo", paths: "purple", boss: "amber" };

export default function CondLabMap() {
  return (
    <LabMap
      slug="conditions"
      eyebrow="Lab 2"
      title="Condition Lab"
      blurb="Get the hiker safely across the canyon. Your code looks at the situation and decides: cross, wait, or which bridge to take."
      levels={COND_LEVELS}
      tracks={COND_TRACKS.map((t) => ({ ...t, tone: TONES[t.id] }))}
    />
  );
}
