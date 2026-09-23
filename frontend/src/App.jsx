import React, { useState, useEffect, useRef } from "react";
import "./App.css";

const API_KEY = "92efacd7933564e4a151335eaa13fdf4";
const CACHE_KEY = "mobile_lookup_cache_v1";
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

// =================================
// CACHE HELPERS
// =================================
function getCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}

function getCached(mobile) {
  const cache = getCache();
  const entry = cache[mobile];
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) {
    delete cache[mobile];
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    return null;
  }
  return entry.data;
}

function setCache(mobile, data) {
  try {
    const cache = getCache();
    cache[mobile] = { data, ts: Date.now() };
    // Keep only last 50 searches
    const keys = Object.keys(cache);
    if (keys.length > 50) {
      const sorted = keys.sort((a, b) => cache[b].ts - cache[a].ts);
      sorted.slice(50).forEach((k) => delete cache[k]);
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

function clearCache() {
  localStorage.removeItem(CACHE_KEY);
}

// =================================
// APP
// =================================
function App() {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const login = async (e) => {
    e.preventDefault();
    setLoginError("");
    setLoggingIn(true);
    try {
      if (username === "admin" && password === "123456") {
        const demoToken = "authenticated-user";
        localStorage.setItem("token", demoToken);
        setToken(demoToken);
        setUsername("");
        setPassword("");
      } else {
        throw new Error("Invalid username or password");
      }
    } catch (error) {
      setLoginError(error.message || "Unable to login");
    } finally {
      setLoggingIn(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
  };

  if (!token) {
    return (
      <main className="page">
        <section className="card login-card">
          <div className="icon">🔐</div>
          <h1>User Login</h1>
          <p className="subtitle">Login to access the search system</p>
          <form onSubmit={login}>
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button type="submit" disabled={loggingIn}>
              {loggingIn ? "Logging in..." : "Login"}
            </button>
          </form>
          {loginError && <div className="error">{loginError}</div>}
        </section>
      </main>
    );
  }

  return <SearchPage logout={logout} />;
}

// =================================
// SEARCH PAGE
// =================================
function SearchPage({ logout }) {
  const [mobile, setMobile] = useState("");
  const [results, setResults] = useState([]);
  const [rawData, setRawData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showRaw, setShowRaw] = useState(false);
  const [status, setStatus] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [cacheHit, setCacheHit] = useState(false);
  const timerRef = useRef(null);
  const abortRef = useRef(null);

  // Elapsed timer during loading
  useEffect(() => {
    if (loading) {
      setElapsed(0);
      const start = Date.now();
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - start) / 1000));
      }, 500);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loading]);

  const searchMobile = async (e) => {
    e.preventDefault();

    if (!/^[6-9]\d{9}$/.test(mobile)) {
      setError("Please enter a valid 10-digit Indian mobile number.");
      setResults([]);
      setRawData(null);
      return;
    }

    // Cancel previous request
    if (abortRef.current) {
      try { abortRef.current.abort(); } catch {}
    }

    setError("");
    setStatus("");
    setCacheHit(false);

    // ✅ STEP 1: Check cache first
    const cached = getCached(mobile);
    if (cached) {
      console.log("📦 Cache hit for", mobile);
      const records = extractRecords(cached);
      setResults(records);
      setRawData(cached);
      setCacheHit(true);
      setStatus("Loaded from cache ⚡");
      setTimeout(() => setStatus(""), 2000);
      return;
    }

    setLoading(true);
    setResults([]);
    setRawData(null);

    const MAX_ATTEMPTS = 4;
    let success = false;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS && !success; attempt++) {
      try {
        setStatus(
          attempt === 1
            ? "Connecting to server... (pehli baar 30 sec lag sakte hain)"
            : `Retry ${attempt}/${MAX_ATTEMPTS}...`
        );

        const controller = new AbortController();
        abortRef.current = controller;

        const timeout = setTimeout(() => controller.abort(), 45000);

        const url = `/api/search?mobile=${encodeURIComponent(mobile)}`;
        console.log(`[Attempt ${attempt}] →`, url);

        const response = await fetch(url, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });

        clearTimeout(timeout);

        const text = await response.text();
        console.log(`[Attempt ${attempt}] ← ${response.status}`, text.slice(0, 200));

        let data;
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error("Server returned non-JSON response");
        }

        // API internal error
      if (data.status === false || data.status === "false") {
  const msg = data.message || data.error || "API error";

  // Vercel timeout — turant fail mat karo, retry karo
  if (
    data.code === 504 &&
    attempt < MAX_ATTEMPTS
  ) {
    setStatus("API slow hai, dobara try kar rahe hain...");
    await new Promise((r) => setTimeout(r, 1000));
    continue;
  }

  throw new Error(msg);
}

        const records = extractRecords(data);

        if (records.length === 0) {
          throw new Error("Is number ka koi record nahi mila.");
        }

        setResults(records);
        setRawData(data);
        setCache(mobile, data);  // ✅ Cache save
        setStatus("");
        success = true;
      } catch (err) {
        console.error(`Attempt ${attempt} failed:`, err.message);

        if (err.name === "AbortError") {
          setError("Request timeout ho gaya (45 sec). Server slow hai — thodi der baad try karo.");
          break;
        }

        if (attempt === MAX_ATTEMPTS) {
          setError(
            `Server ne jawab nahi diya (2 baar try kiya). API free tier pe hai, thodi der baad dobara try karo.`
          );
        } else {
          await new Promise((r) => setTimeout(r, 1500));
        }
      }
    }

    setLoading(false);
    setStatus("");
    abortRef.current = null;
  };

  const cancelSearch = () => {
    if (abortRef.current) {
      try { abortRef.current.abort(); } catch {}
    }
    setLoading(false);
    setStatus("");
    setError("Search cancelled.");
  };

  return (
    <main className="page">
      <section className="card">
        <div className="top-bar">
          <div>
            <div className="icon">🔎</div>
            <h1>Mobile Lookup</h1>
          </div>
          <button className="logout-btn" onClick={logout}>
            Logout
          </button>
        </div>

        <p className="subtitle">Search authorized records by mobile number</p>

        <form onSubmit={searchMobile}>
          <input
            type="tel"
            inputMode="numeric"
            maxLength={10}
            placeholder="Enter 10-digit mobile number"
            value={mobile}
            onChange={(e) =>
              setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))
            }
            required
            disabled={loading}
          />
          <button type="submit" disabled={loading}>
            {loading ? "Searching..." : "Search"}
          </button>
        </form>

        {/* Loading bar with timer */}
        {loading && (
          <div className="loading-box">
            <div className="loading-bar">
              <div className="loading-bar-fill" />
            </div>
            <div className="loading-info">
              <span>{status || "Searching..."}</span>
              <span className="timer">{elapsed}s</span>
            </div>
            <button className="cancel-btn" onClick={cancelSearch} type="button">
              Cancel
            </button>
          </div>
        )}

        {cacheHit && !loading && (
          <div className="info">⚡ Loaded from cache (instant)</div>
        )}

        {error && <div className="error">{error}</div>}

        {results.length > 0 && (
          <div className="results-container">
            <div className="results-header">
              <h2>
                Found {results.length} Record
                {results.length > 1 ? "s" : ""}
              </h2>
              <div className="header-btns">
                <button
                  className="toggle-btn"
                  type="button"
                  onClick={() => setShowRaw((s) => !s)}
                >
                  {showRaw ? "👁️ Formatted" : "{ } Raw JSON"}
                </button>
                <button
                  className="clear-cache-btn"
                  type="button"
                  onClick={() => {
                    clearCache();
                    setStatus("Cache cleared");
                    setTimeout(() => setStatus(""), 1500);
                  }}
                  title="Clear all cached searches"
                >
                  🗑️
                </button>
              </div>
            </div>

            {showRaw ? (
              <pre className="json-view">
                {JSON.stringify(rawData, null, 2)}
              </pre>
            ) : (
              results.map((record, index) => (
                <RecordCard key={index} record={record} />
              ))
            )}
          </div>
        )}

        <p className="notice">
          🔒 Login required. Use only with records you are authorized to access.
        </p>
      </section>
    </main>
  );
}

// =================================
// EXTRACT RECORDS
// =================================
function extractRecords(data) {
  const out = [];

  if (
    data?.data &&
    typeof data.data === "object" &&
    !Array.isArray(data.data)
  ) {
    const entries = Object.entries(data.data);
    const isSourceGroup = entries.some(
      ([, v]) => v && typeof v === "object" && (v.records || v.title)
    );

    if (isSourceGroup) {
      for (const [, val] of entries) {
        if (val && typeof val === "object" && Array.isArray(val.records)) {
          out.push(...val.records);
        }
      }
      return out;
    }

    if (
      data.data.mobile ||
      data.data.name ||
      data.data.Phone ||
      data.data.FullName
    ) {
      return [data.data];
    }
  }

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.Results)) return data.Results;
  if (Array.isArray(data?.data)) return data.data;

  return out;
}

// =================================
// RECORD CARD
// =================================
const LABELS = {
  Phone: "📱 Phone",
  Phone2: "📱 Phone 2",
  Phone3: "📱 Phone 3",
  Phone4: "📱 Phone 4",
  Phone5: "📱 Phone 5",
  mobile: "📱 Mobile",
  phone: "📱 Phone",
  FullName: "👤 Full Name",
  name: "👤 Name",
  fname: "👨 Father",
  father: "👨 Father",
  Adres: "🏠 Address",
  Adres2: "🏠 Address 2",
  Adres3: "🏠 Address 3",
  address: "🏠 Address",
  Region: "📍 Region",
  IndianState: "📍 State",
  Email: "📧 Email",
  MobileOperator: "📶 Operator",
  circle: "📡 Circle",
  operator: "📶 Operator",
  aadhar: "🆔 Aadhar",
  aadhaar: "🆔 Aadhar",
};

const SKIP_KEYS = new Set(["__v", "status", "_id", "id"]);

function formatValue(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value).replace(/!/g, ", ");
}

function RecordCard({ record }) {
  const entries = Object.entries(record).filter(
    ([k, v]) =>
      !SKIP_KEYS.has(k) &&
      v !== null &&
      v !== undefined &&
      v !== "" &&
      !Array.isArray(v)
  );

  const name = record.FullName || record.name || record.fname || "Unknown";

  return (
    <div className="result">
      <h3>👤 {name}</h3>
      {entries.map(([key, value]) => (
        <div className="row" key={key}>
          <span>{LABELS[key] || `🔹 ${key}`}</span>
          <strong>{formatValue(value)}</strong>
        </div>
      ))}
    </div>
  );
}

export default App;