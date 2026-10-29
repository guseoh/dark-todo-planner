import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Warm-neutral charcoal surfaces; accent is reserved for interactive states.
        ink: {
          950: "#111315",
          900: "#191b1f",
          850: "#212428",
          800: "#292d31",
          700: "#41464b",
          600: "#858d95",
          500: "#aab0b6",
          400: "#b9c0c6",
          300: "#cbd1d6",
          200: "#dce0e4",
          100: "#e8e9ec",
        },
        accent: {
          600: "#849e89",
          500: "#a7baab",
          400: "#b6c8b9",
          300: "#c6d7ca",
          200: "#d9e5dc",
        },
        success: "#76c3a2",
        warning: "#e3bd78",
        danger: "#e48e92",
      },
      boxShadow: {
        soft: "0 4px 16px rgba(0, 0, 0, 0.12)",
      },
    },
  },
  plugins: [],
} satisfies Config;
