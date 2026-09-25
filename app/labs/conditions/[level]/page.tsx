import { notFound } from "next/navigation";
import type { Metadata } from "next";
import LevelGate from "@/components/LevelGate";
import CondPlayer from "@/components/CondPlayer";
import { COND_LEVELS, condIndex } from "@/lib/condLevels";

export const dynamicParams = false;

export function generateStaticParams() {
  return COND_LEVELS.map((l) => ({ level: l.id }));
}

type Props = { params: Promise<{ level: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { level } = await params;
  const l = COND_LEVELS[condIndex(level)];
  return { title: l ? `${l.title} · Condition Lab` : "Condition Lab" };
}

export default async function Page({ params }: Props) {
  const { level } = await params;
  if (condIndex(level) < 0) notFound();
  return (
    <LevelGate lab="conditions" levels={COND_LEVELS.map(({ id, title }) => ({ id, title }))} levelId={level}>
      <CondPlayer key={level} levelId={level} />
    </LevelGate>
  );
}
