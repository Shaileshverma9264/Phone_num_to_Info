// proxy.js
import http from "http";
import { URL } from "url";

const PORT = 5000;
const API_BASE = "https://l34k-osint.onrender.com/search";
const API_KEY = "92efacd7933564e4a151335eaa13fdf4";

http
  .createServer(async (req, res) => {
    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      return res.end();
    }

    const u = new URL(req.url, `http://localhost:${PORT}`);

    if (u.pathname !== "/api/search") {
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("Not found");
    }

    const mobile = u.searchParams.get("mobile");
    if (!mobile) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "mobile required" }));
    }

    try {
      const apiUrl = `${API_BASE}?key=${API_KEY}&query=91${mobile}`;
      console.log("→ Fetching:", apiUrl);

      // ✅ Browser jaisa User-Agent bhejo
      const r = await fetch(apiUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept: "application/json, text/plain, */*",
          "Accept-Language": "en-US,en;q=0.9",
          Referer: "https://l34k-osint.onrender.com/",
          Origin: "https://l34k-osint.onrender.com",
        },
      });

      const text = await r.text();
      console.log("← Status:", r.status, "Length:", text.length);

      res.writeHead(r.status, { "Content-Type": "application/json" });
      res.end(text);
    } catch (e) {
      console.error("Proxy error:", e.message);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: e.message }));
    }
  })
  .listen(PORT, () => {
    console.log(`✅ Proxy running → http://localhost:${PORT}`);
    console.log(
      `   Test: http://localhost:${PORT}/api/search?query=9264975594`
    );
  });