import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#101720",
          900: "#192330",
          850: "#202c3d",
          800: "#29384b",
          700: "#44546a",
          600: "#8d9db3",
          500: "#a3b2c7",
          400: "#bbc8d9",
          300: "#ced9e7",
          200: "#e0e8f3",
          100: "#f3f6fc",
        },
        accent: {
          600: "#1d4ed8",
          500: "#2563eb",
          400: "#3070df",
          300: "#93baff",
          200: "#bed4ff",
        },
        success: "#5cceac",
        warning: "#e7b95d",
        danger: "#f08088",
      },
      boxShadow: {
        soft: "0 8px 24px rgba(0, 0, 0, 0.18)",
      },
    },
  },
  plugins: [],
} satisfies Config;
