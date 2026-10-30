import type { Config } from "tailwindcss";

// Neutral-only UI scale. Semantic alerts retain their own accessible colors.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#101011",
          900: "#161617",
          850: "#1b1b1d",
          800: "#28282b",
          700: "#454549",
          600: "#8b8b91",
          500: "#99999f",
          400: "#bcbcc1",
          300: "#d1d1d5",
          200: "#e2e2e5",
          100: "#efeff0",
        },
        // Keep accent API names for existing components; values are achromatic.
        accent: {
          600: "#a8a8ad",
          500: "#d4d4d8",
          400: "#e1e1e4",
          300: "#ededf0",
          200: "#f4f4f5",
        },
        success: "#8fb9a3",
        warning: "#d9b47d",
        danger: "#d88d92",
      },
      boxShadow: {
        soft: "none",
      },
    },
  },
  plugins: [],
} satisfies Config;
