// frontend/api/search.js
// Vercel Serverless Function

const API_BASE = "https://l34k-osint.onrender.com/search";
const API_KEY = "92efacd7933564e4a151335eaa13fdf4";

export default async function handler(req, res) {
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

  const apiUrl = `${API_BASE}?key=${API_KEY}&query=91${mobile}`;
  console.log("→ Fetching:", apiUrl);

  const MAX_ATTEMPTS = 3;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
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
      console.log("← Status:", response.status);

      // Agar API ne retry bola to dobara try karo
      if (
        text.includes('"did not respond"') &&
        attempt < MAX_ATTEMPTS
      ) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }

      res.setHeader("Content-Type", "application/json");
      return res.status(response.status).send(text);
    } catch (err) {
      console.error(`Attempt ${attempt} error:`, err.message);

      if (attempt === MAX_ATTEMPTS) {
        return res.status(500).json({ error: err.message });
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
}