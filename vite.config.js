import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  base: mode === "production" ? "/rainfall/" : "/",
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
  },
}));
