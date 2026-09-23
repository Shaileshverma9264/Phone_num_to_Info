import React, { useState } from "react";
import "./App.css";

// =================================
// API CONFIG
// =================================
const API_BASE = "https://l34k-osint.onrender.com/search";
const API_KEY = "92efacd7933564e4a151335eaa13fdf4";

function App() {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  // ---------------- LOGIN ----------------
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

  // ---------------- LOGOUT ----------------
  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
  };

  // ---------------- LOGIN PAGE ----------------
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

  // ---------------- AUTHENTICATED ----------------
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

  // ---------------- SEARCH WITH RETRY ----------------
 const searchMobile = async (e) => {
  e.preventDefault();

  if (!/^[6-9]\d{9}$/.test(mobile)) {
    setError("Please enter a valid 10-digit Indian mobile number.");
    setResults([]);
    return;
  }

  setLoading(true);
  setError("");
  setStatus("");
  setResults([]);
  setRawData(null);

  const MAX_ATTEMPTS = 3;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      setStatus(`Searching... attempt ${attempt} of ${MAX_ATTEMPTS}`);

      // ✅ Vite proxy URL — CORS issue khatam
     const url = `/api/search?mobile=${encodeURIComponent(mobile)}`;
      console.log(`[Attempt ${attempt}] Fetching:`, url);

      const response = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      const text = await response.text();
      console.log(`[Attempt ${attempt}] Response:`, text.slice(0, 300));

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Invalid JSON from server");
      }

      if (data.status === false || data.status === "false") {
        const msg = data.message || data.error || "API did not respond";

        if (
          attempt < MAX_ATTEMPTS &&
          (data.code === 504 ||
            data.action === "retry" ||
            /retry|did not respond|timeout/i.test(msg))
        ) {
          await new Promise((r) => setTimeout(r, 2000));
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
      setStatus("");
      setLoading(false);
      return;
    } catch (err) {
      console.error(`Attempt ${attempt} error:`, err.message);

      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }

  setError(
    `API ne ${MAX_ATTEMPTS} baar bhi jawab nahi diya. Thodi der baad dobara try karo.`
  );
  setStatus("");
  setLoading(false);
};

  // ---------------- UI ----------------
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

        <p className="subtitle">
          Search authorized records by mobile number
        </p>

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
          />
          <button type="submit" disabled={loading}>
            {loading ? "Searching..." : "Search"}
          </button>
        </form>

        {status && <div className="info">{status}</div>}
        {error && <div className="error">{error}</div>}

        {results.length > 0 && (
          <div className="results-container">
            <div className="results-header">
              <h2>
                Found {results.length} Record
                {results.length > 1 ? "s" : ""}
              </h2>
              <button
                className="toggle-btn"
                type="button"
                onClick={() => setShowRaw((s) => !s)}
              >
                {showRaw ? "👁️ Formatted" : "{ } Raw JSON"}
              </button>
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
// EXTRACT RECORDS — nested data source1, source2... se
// =================================
function extractRecords(data) {
  const out = [];

  // Format: data.data.source1.records, data.data.source2.records, ...
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

    // Direct record
    if (
      data.data.mobile ||
      data.data.name ||
      data.data.Phone ||
      data.data.FullName
    ) {
      return [data.data];
    }
  }

  // Flat array formats
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

  const name =
    record.FullName || record.name || record.fname || "Unknown";

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