/*
 * The list of labs shown on the home page.
 * To add a new lab later: add an entry here and create its pages under app/labs/<slug>.
 */

export type Lab = {
  slug: string;
  title: string;
  tagline: string;
  concepts: string[];
  status: "live" | "soon";
  accent: string; // CSS colour used for the card
  emoji: string;
  levels?: number;
};

export const LABS: Lab[] = [
  {
    slug: "loops",
    title: "Loop Lab",
    tagline: "Make a robot cross a bridge and launch a rocket, using loops.",
    concepts: ["for", "range()", "while"],
    status: "live",
    accent: "#6366f1",
    emoji: "🔁",
    levels: 15,
  },
  {
    slug: "conditions",
    title: "Condition Lab",
    tagline: "Write the decision logic behind real systems: logins, payments, deployments and firewalls.",
    concepts: ["if", "elif", "else", "and / or / not", "nested if"],
    status: "live",
    accent: "#10b981",
    emoji: "🧭",
    levels: 17,
  },
  {
    slug: "variables",
    title: "Variable Vault",
    tagline: "Store, change and swap values to crack the vault.",
    concepts: ["variables", "numbers", "strings"],
    status: "soon",
    accent: "#0ea5e9",
    emoji: "🔐",
  },
  {
    slug: "lists",
    title: "List Lab",
    tagline: "Pack, sort and unpack a delivery truck.",
    concepts: ["lists", "indexes", "append()"],
    status: "soon",
    accent: "#f59e0b",
    emoji: "📦",
  },
  {
    slug: "functions",
    title: "Function Factory",
    tagline: "Build machines you can use again and again.",
    concepts: ["def", "parameters", "return"],
    status: "soon",
    accent: "#ec4899",
    emoji: "🏭",
  },
];
