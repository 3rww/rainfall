import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  base: mode === "production" ? "/rainfall/" : "/",
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }

          if (id.includes("@mapbox/mapbox-gl-geocoder")) {
            return "vendor-mapbox-geocoder";
          }

          if (id.includes("mapbox-gl")) {
            return "vendor-mapbox";
          }

          if (
            id.includes("react-datepicker")
            || id.includes("react-select")
            || id.includes("date-fns")
            || id.includes("@floating-ui")
          ) {
            return "vendor-pickers";
          }

          if (
            id.includes("react-markdown")
            || id.includes("remark-gfm")
            || id.includes("/unified/")
            || id.includes("/remark-")
            || id.includes("/rehype-")
            || id.includes("/micromark")
            || id.includes("/mdast-")
            || id.includes("/hast-")
            || id.includes("/vfile")
          ) {
            return "vendor-markdown";
          }

          return undefined;
        }
      }
    }
  },
  test: {
    environment: "jsdom",
    globals: true,
    exclude: [
      "e2e/**",
      "node_modules/**",
      "dist/**"
    ]
  },
}));
