// frontend/api/search.js
// Vercel Serverless Function — acts as our backend proxy

const API_BASE = "https://l34k-osint.onrender.com/search";
const API_KEY = "92efacd7933564e4a151335eaa13fdf4";

export default async function handler(req, res) {
  // CORS headers — allow any origin
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  const { mobile } = req.query;

  if (!mobile) {
    return res.status(400).json({ error: "mobile required" });
  }

  try {
    const apiUrl = `${API_BASE}?key=${API_KEY}&query=91${mobile}`;
    console.log("→ Fetching:", apiUrl);

    const response = await fetch(apiUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://l34k-osint.onrender.com/",
        Origin: "https://l34k-osint.onrender.com",
      },
    });

    const text = await response.text();
    console.log("← Status:", response.status, "Length:", text.length);

    res.setHeader("Content-Type", "application/json");
    res.status(response.status).send(text);
  } catch (err) {
    console.error("Proxy error:", err.message);
    res.status(500).json({ error: err.message });
  }
}