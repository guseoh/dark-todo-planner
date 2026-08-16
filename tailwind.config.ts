import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#080d18",
          900: "#0d1420",
          850: "#121a28",
          800: "#192333",
          700: "#29364a",
          600: "#3b4a60",
          500: "#607089",
          400: "#93a2b8",
          300: "#c4cfdd",
          200: "#dce4ee",
          100: "#f4f7fb",
        },
        accent: {
          600: "#5b4cf0",
          500: "#6d5dfc",
          400: "#8a7cff",
          300: "#aaa1ff",
          200: "#cdc8ff",
        },
        success: "#22c55e",
        warning: "#f59e0b",
        danger: "#ef4444",
      },
      boxShadow: {
        soft: "0 12px 32px rgba(0, 0, 0, 0.22)",
      },
    },
  },
  plugins: [],
} satisfies Config;
