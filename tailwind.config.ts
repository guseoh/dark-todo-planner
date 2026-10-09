import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#121519",
          900: "#1a1f24",
          850: "#22282e",
          800: "#2a3138",
          700: "#3b444e",
          600: "#87929d",
          500: "#9ca7b2",
          400: "#b6c0c9",
          300: "#c9d0d6",
          200: "#dde2e6",
          100: "#f0f2f4",
        },
        accent: {
          600: "#075fb8",
          500: "#0b72d7",
          400: "#0968c7",
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
