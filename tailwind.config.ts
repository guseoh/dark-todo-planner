import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#131517",
          900: "#181a1b",
          850: "#1d2022",
          800: "#222629",
          700: "#30353a",
          600: "#4a5056",
          500: "#747b80",
          400: "#9da3a7",
          300: "#c1beb8",
          200: "#d8d5cf",
          100: "#ece8e1",
        },
        accent: {
          600: "#075fb8",
          500: "#0b72d7",
          400: "#2b86e5",
          300: "#67a5ed",
          200: "#a8cef6",
        },
        success: "#46a758",
        warning: "#c99b36",
        danger: "#d45b5b",
      },
      boxShadow: {
        soft: "0 8px 24px rgba(0, 0, 0, 0.18)",
      },
    },
  },
  plugins: [],
} satisfies Config;
