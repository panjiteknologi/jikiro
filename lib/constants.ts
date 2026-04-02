import { generateDummyPassword } from "./db/utils";

export const isProductionEnvironment = process.env.NODE_ENV === "production";
export const isDevelopmentEnvironment = process.env.NODE_ENV === "development";
export const isTestEnvironment = Boolean(
  process.env.PLAYWRIGHT_TEST_BASE_URL ||
    process.env.PLAYWRIGHT ||
    process.env.CI_PLAYWRIGHT
);

export const guestRegex = /^guest-\d+$/;

export const DUMMY_PASSWORD = generateDummyPassword();

export type ChatSuggestion = {
  id: string;
  title: string;
  prompt: string;
  emoji: string;
  description?: string;
  tint: {
    background: string;
    border: string;
    glow: string;
  };
};

export const suggestions: ChatSuggestion[] = [
  {
    id: "build-feature",
    title: "Build something fun",
    prompt: "Build a classic Snake game with TypeScript.",
    emoji: "🛠️",
    description: "Ship a playful feature with code I can run.",
    tint: {
      background: "oklch(0.62 0.09 240 / 0.10)",
      border: "oklch(0.62 0.09 240 / 0.22)",
      glow: "oklch(0.62 0.09 240 / 0.16)",
    },
  },
  {
    id: "explain-concept",
    title: "Explain it clearly",
    prompt: "What are the advantages of using AI?",
    emoji: "💡",
    description: "Break down a concept with practical examples.",
    tint: {
      background: "oklch(0.78 0.12 85 / 0.13)",
      border: "oklch(0.78 0.12 85 / 0.26)",
      glow: "oklch(0.78 0.12 85 / 0.18)",
    },
  },
  {
    id: "plan-work",
    title: "Create a marketing plan",
    prompt: "Create a plan to add a polished marketing flow to this app.",
    emoji: "📝",
    description: "Turn a rough idea into clear implementation steps.",
    tint: {
      background: "oklch(0.7 0.11 20 / 0.10)",
      border: "oklch(0.7 0.11 20 / 0.22)",
      glow: "oklch(0.7 0.11 20 / 0.16)",
    },
  },
];
