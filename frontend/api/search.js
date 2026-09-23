// frontend/api/search.js
// Vercel Serverless Function — proxies to l34k-osint API

export const config = {
  maxDuration: 60, // Vercel Pro pe 60s, Hobby pe 10s hi milega
};

const API_BASE = "https://l34k-osint.onrender.com/search";
const API_KEY = process.env.API_KEY || "92efacd7933564e4a151335eaa13fdf4";

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  const { mobile } = req.query;

  if (!mobile || !/^[6-9]\d{9}$/.test(mobile)) {
    res.setHeader("Content-Type", "application/json");
    return res.status(400).json({ error: "Valid 10-digit mobile required" });
  }

  const apiUrl = `${API_BASE}?key=${API_KEY}&query=91${mobile}`;
  console.log("→ Fetching:", apiUrl);

  try {
    const controller = new AbortController();
    // Vercel Hobby = 10 sec, isliye 9 sec timeout rakho
    const timeoutId = setTimeout(() => controller.abort(), 9000);

    const response = await fetch(apiUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://l34k-osint.onrender.com/",
        Origin: "https://l34k-osint.onrender.com",
      },
    });

    clearTimeout(timeoutId);

    const text = await response.text();
    console.log("← Status:", response.status, "Length:", text.length);

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=7200");
    return res.status(response.status).send(text);
  } catch (err) {
    console.error("Proxy error:", err.name, err.message);

    res.setHeader("Content-Type", "application/json");

    // Timeout — Vercel 500 nahi dega, hum clean response denge
    if (err.name === "AbortError") {
      return res.status(504).json({
        status: false,
        error: "timeout",
        message: "API 9 second me jawab nahi de payi. Thodi der baad try karo.",
        code: 504,
      });
    }

    return res.status(502).json({
      status: false,
      error: "proxy_error",
      message: err.message || "Backend API tak nahi pahunch paye.",
      code: 502,
    });
  }
}