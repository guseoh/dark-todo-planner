import type { Config } from "tailwindcss";

// Each legacy shade follows the resolved theme. New components should use ui.* roles.
const themedShade = (variable: string) => `rgb(var(--${variable}) / <alpha-value>)`;

// Neutral-only UI scale. Semantic alerts retain their own accessible colors.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: themedShade("ink-950"),
          900: themedShade("ink-900"),
          850: themedShade("ink-850"),
          800: themedShade("ink-800"),
          700: themedShade("ink-700"),
          600: themedShade("ink-600"),
          500: themedShade("ink-500"),
          400: themedShade("ink-400"),
          300: themedShade("ink-300"),
          200: themedShade("ink-200"),
          100: themedShade("ink-100"),
        },
        accent: {
          600: themedShade("accent-600"),
          500: themedShade("accent-500"),
          400: themedShade("accent-400"),
          300: themedShade("accent-300"),
          200: themedShade("accent-200"),
        },
        ui: {
          canvas: "var(--ui-canvas)",
          navigation: "var(--ui-navigation)",
          surface: "var(--ui-surface)",
          inset: "var(--ui-inset)",
          hover: "var(--ui-hover)",
          selected: "var(--ui-selected)",
          elevated: "var(--ui-elevated)",
          divider: "var(--ui-divider)",
          "control-border": "var(--ui-control-border)",
          text: "var(--ui-text-primary)",
          secondary: "var(--ui-text-secondary)",
          muted: "var(--ui-text-muted)",
          focus: "var(--ui-focus)",
          action: "var(--ui-action-bg)",
          "action-text": "var(--ui-action-text)",
        },
        success: themedShade("semantic-success"),
        warning: themedShade("semantic-warning"),
        danger: themedShade("semantic-danger"),
        info: themedShade("semantic-info"),
      },
      boxShadow: {
        soft: "none",
      },
    },
  },
  plugins: [],
} satisfies Config;
