import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = env.VITE_API_BASE_URL || `http://localhost:${env.PORT || "3000"}`;

  return {
    base: env.GITHUB_PAGES === "true" ? "/dark-todo-planner/" : "/",
    plugins: [react()],
    server: {
      proxy: {
        "/api": apiTarget,
      },
    },
  };
});
