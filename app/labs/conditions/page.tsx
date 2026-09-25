import type { Metadata } from "next";
import CondLabMap from "@/components/CondLabMap";

export const metadata: Metadata = {
  title: "Condition Lab · CodePlay Labs",
  description: "Learn Python if, elif, else and logic by getting a hiker safely across the canyon.",
};

export default function Page() {
  return <CondLabMap />;
}
