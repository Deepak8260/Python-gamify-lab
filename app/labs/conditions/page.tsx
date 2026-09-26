import type { Metadata } from "next";
import CondLabMap from "@/components/CondLabMap";

export const metadata: Metadata = {
  title: "Condition Lab · CodePlay Labs",
  description: "Learn Python if, elif, else and logic by writing the decision logic of real systems: access control, payments, deployments and firewalls.",
};

export default function Page() {
  return <CondLabMap />;
}
