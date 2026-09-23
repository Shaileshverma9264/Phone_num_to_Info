import React, { useState } from "react";
import "./App.css";

const API_BASE = "https://l34k-osint.onrender.com/search";
const API_KEY  = "92efacd7933564e4a151335eaa13fdf4";

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
  const [mobile, setMobile]     = useState("");
  const [sources, setSources]   = useState([]);   // [{title, description, records:[]}]
  const [rawData, setRawData]   = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [showRaw, setShowRaw]   = useState(false);

  const searchMobile = async (e) => {
    e.preventDefault();

    if (!/^[6-9]\d{9}$/.test(mobile)) {
      setError("Please enter a valid 10-digit Indian mobile number.");
      setSources([]);
      setRawData(null);
      return;
    }

    setLoading(true);
    setError("");
    setSources([]);
    setRawData(null);

       try {
      // ✅ Apna proxy use karo (localhost:5000)
      const url = `http://localhost:5000/api/search?mobile=${encodeURIComponent(mobile)}`;

      console.log("Requesting (via own proxy):", url);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 60000);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);

      const text = await response.text();
      console.log("Raw API Response:", text);

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Server ne bheja: ${text.slice(0, 200)}`);
      }

      setRawData(data);

      if (data.status === false || data.status === "false") {
        throw new Error(
          data.message || data.error || "API abhi reboot ho rahi hai."
        );
      }

      // ✅ Sources normalize karo (source1, source2...)
      const parsedSources = normalizeSources(data);

      if (
        parsedSources.length === 0 ||
        parsedSources.every((s) => s.records.length === 0)
      ) {
        throw new Error("Is number ka koi record nahi mila.");
      }

      setSources(parsedSources);
    } catch (err) {
      console.error("Search Error:", err);
      setError(err.message || "Unable to connect to server.");
    } finally {
      setLoading(false);
    }
  };

  const totalRecords = sources.reduce((sum, s) => sum + s.records.length, 0);

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
          />
          <button type="submit" disabled={loading}>
            {loading ? "Searching..." : "Search"}
          </button>
        </form>

        {error && <div className="error">{error}</div>}

        {sources.length > 0 && (
          <div className="results-container">
            <div className="results-header">
              <h2>
                Found {totalRecords} Record{totalRecords > 1 ? "s" : ""} in{" "}
                {sources.length} Source{sources.length > 1 ? "s" : ""}
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
              <pre className="json-view">{JSON.stringify(rawData, null, 2)}</pre>
            ) : (
              sources.map((source, sIdx) => (
                <div key={sIdx} className="source-block">
                  <div className="source-header">
                    <h3>{source.title || `Source ${sIdx + 1}`}</h3>
                    {source.description && (
                      <p className="source-desc">{source.description}</p>
                    )}
                  </div>
                  {source.records.map((record, rIdx) => (
                    <RecordCard key={rIdx} record={record} />
                  ))}
                </div>
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
// NORMALIZE — API ke nested response ko flat karo
// =================================
function normalizeSources(data) {
  const out = [];

  // Case 1: Naya format — data.data.source1, source2, ...
  if (data?.data && typeof data.data === "object" && !Array.isArray(data.data)) {
    const entries = Object.entries(data.data);

    // Agar data.data me "records" key hai to wo direct ek source hai
    const looksLikeSourceGroup = entries.some(
      ([, v]) => v && typeof v === "object" && (v.records || v.title)
    );

    if (looksLikeSourceGroup) {
      for (const [, val] of entries) {
        if (val && typeof val === "object") {
          out.push({
            title: val.title || "",
            description: val.description || "",
            records: Array.isArray(val.records)
              ? val.records
              : val.mobile || val.name || val.Phone || val.FullName
              ? [val]
              : [],
          });
        }
      }
      return out;
    }

    // Warna data.data khud ek record hai
    if (data.data.mobile || data.data.name || data.data.Phone || data.data.FullName) {
      out.push({ title: "", description: "", records: [data.data] });
      return out;
    }
  }

  // Case 2: Flat array
  let flat = [];
  if (Array.isArray(data)) flat = data;
  else if (Array.isArray(data?.Results)) flat = data.Results;
  else if (Array.isArray(data?.results)) flat = data.results;
  else if (Array.isArray(data?.result)) flat = data.result;
  else if (Array.isArray(data?.data)) flat = data.data;
  else if (data?.mobile || data?.name) flat = [data];

  if (flat.length) {
    out.push({ title: "", description: "", records: flat });
  }

  return out;
}

// =================================
// RECORD CARD
// =================================
const LABELS = {
  // Common
  Phone: "📱 Phone",
  Phone2: "📱 Phone 2",
  Phone3: "📱 Phone 3",
  Phone4: "📱 Phone 4",
  Phone5: "📱 Phone 5",
  mobile: "📱 Mobile",
  phone: "📱 Phone",
  // Name
  FullName: "👤 Full Name",
  name: "👤 Name",
  fname: "👨 Father",
  father: "👨 Father",
  // Address
  Adres: "🏠 Address",
  Adres2: "🏠 Address 2",
  Adres3: "🏠 Address 3",
  address: "🏠 Address",
  Region: "📍 Region",
  IndianState: "📍 State",
  // Other
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