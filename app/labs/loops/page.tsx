import type { Metadata } from "next";
import LoopLabMap from "@/components/LoopLabMap";

export const metadata: Metadata = {
  title: "Loop Lab · CodePlay Labs",
  description: "Learn Python for and while loops by guiding a robot and launching a rocket.",
};

export default function Page() {
  return <LoopLabMap />;
}
