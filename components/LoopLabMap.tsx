"use client";

import LabMap from "./LabMap";
import { LOOP_LEVELS, TRACKS } from "@/lib/loopLevels";

export default function LoopLabMap() {
  return (
    <LabMap
      slug="loops"
      eyebrow="Lab 1"
      title="Loop Lab"
      blurb="Make things happen again and again. Guide Robo across the bridge, then get a rocket ready for lift-off."
      levels={LOOP_LEVELS}
      tracks={TRACKS.map((t) => ({
        id: t.id,
        title: t.title,
        blurb: t.blurb,
        emoji: t.id === "for" ? "🤖" : "🚀",
        tone: t.id === "for" ? "indigo" : "purple",
        ids: t.levels.map((l) => l.id),
      }))}
    />
  );
}
