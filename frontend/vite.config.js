import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api/search": {
        target: "https://l34k-osint.onrender.com",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => {
          const url = new URL(path, "http://dummy");
          const mobile = url.searchParams.get("mobile") || "";
          return `/search?key=92efacd7933564e4a151335eaa13fdf4&query=91${mobile}`;
        },
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            proxyReq.setHeader(
              "User-Agent",
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
            );
            proxyReq.setHeader("Accept", "application/json, text/plain, */*");
            proxyReq.setHeader("Referer", "https://l34k-osint.onrender.com/");
            proxyReq.setHeader("Origin", "https://l34k-osint.onrender.com");
          });
        },
      },
    },
  },
});