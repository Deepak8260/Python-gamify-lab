import { notFound } from "next/navigation";
import type { Metadata } from "next";
import LevelGate from "@/components/LevelGate";
import { LOOP_LEVELS, levelIndex } from "@/lib/loopLevels";

export const dynamicParams = false;

export function generateStaticParams() {
  return LOOP_LEVELS.map((l) => ({ level: l.id }));
}

type Props = { params: Promise<{ level: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { level } = await params;
  const l = LOOP_LEVELS[levelIndex(level)];
  return { title: l ? `${l.title} · Loop Lab` : "Loop Lab" };
}

export default async function Page({ params }: Props) {
  const { level } = await params;
  if (levelIndex(level) < 0) notFound();
  return <LevelGate levelId={level} />;
}
