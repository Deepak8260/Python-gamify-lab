"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Check, ChevronLeft, Lock, Play } from "lucide-react";
import { useProgress } from "@/lib/progress";
import SoundToggle from "./SoundToggle";

export type MapTrack = { id: string; title: string; blurb: string; emoji: string; tone: string; ids: string[] };

type Props = {
  slug: string;
  eyebrow: string;
  title: string;
  blurb: string;
  levels: { id: string; title: string }[];
  tracks: MapTrack[];
  children?: ReactNode; // extra sections below the level map
};

/** Level map shared by every lab. Levels unlock one after another. */
export default function LabMap({ slug, eyebrow, title, blurb, levels, tracks, children }: Props) {
  const { done, totalXp, ready } = useProgress();
  const d = done(slug);
  const nextUp = levels.find((l) => !d.has(l.id));
  const doneCount = levels.filter((l) => d.has(l.id)).length; // ignores saved ids of levels that no longer exist

  return (
    <main className="app">
      <header className="topbar">
        <div className="crumbs">
          <Link href="/" className="back">
            <ChevronLeft size={18} />
            <span>All labs</span>
          </Link>
        </div>
        <div className="topbar-right">
          <span className="xp-chip">{totalXp} XP</span>
          <SoundToggle />
        </div>
      </header>

      <section className="lab-hero">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{blurb}</p>
        </div>
        <div className="lab-hero-side">
          <div className="lab-progress big">
            <div className="bar">
              <i style={{ width: `${(doneCount / levels.length) * 100}%` }} />
            </div>
            <span>
              {doneCount} / {levels.length} levels
            </span>
          </div>
          {ready && nextUp && (
            <Link className="btn run" href={`/labs/${slug}/${nextUp.id}`}>
              <Play size={16} fill="currentColor" />
              {doneCount ? "Continue" : "Start"}
            </Link>
          )}
        </div>
      </section>

      {tracks.map((t) => (
        <section key={t.id} className={`track tone-${t.tone}`}>
          <div className="track-head">
            <span className="track-emoji" aria-hidden>
              {t.emoji}
            </span>
            <div>
              <h2>{t.title}</h2>
              <p>{t.blurb}</p>
            </div>
          </div>
          <div className="level-grid">
            {t.ids.map((id) => {
              const i = levels.findIndex((l) => l.id === id);
              const l = levels[i];
              const prev = levels[i - 1];
              const unlocked = !prev || d.has(prev.id);
              const complete = d.has(l.id);
              const body = (
                <>
                  <span className="lv-num">{i + 1}</span>
                  <span className="lv-title">{l.title}</span>
                  <span className="lv-state">
                    {complete ? <Check size={16} /> : unlocked ? <Play size={14} fill="currentColor" /> : <Lock size={14} />}
                  </span>
                </>
              );
              return unlocked ? (
                <Link key={l.id} href={`/labs/${slug}/${l.id}`} className={`level-card ${complete ? "complete" : "open"} ${nextUp?.id === l.id ? "next" : ""}`}>
                  {body}
                </Link>
              ) : (
                <div key={l.id} className="level-card locked" aria-disabled>
                  {body}
                </div>
              );
            })}
          </div>
        </section>
      ))}
      {children}
    </main>
  );
}
