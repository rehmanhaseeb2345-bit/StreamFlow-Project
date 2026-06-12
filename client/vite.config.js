import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The backend sets auth cookies with sameSite: "strict", so the browser only
// sends them on same-origin requests. In dev, the proxy makes /api requests
// originate from this dev server's origin; in production the built app must
// be served from the same domain as the API.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: false,
      },
    },
  },
});
