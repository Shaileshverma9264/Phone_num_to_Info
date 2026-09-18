
import React, { useState } from "react";
import "./App.css";

// External search API
const SEARCH_API_BASE =
  "https://sarkariupdate.online/osint/APIX.php?api=num_api";

function App() {
  const [token, setToken] = useState(
    localStorage.getItem("token")
  );

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  // -----------------------------
  // LOGIN
  // -----------------------------

  const login = async (e) => {
    e.preventDefault();

    setLoginError("");
    setLoggingIn(true);

    try {
      // Demo-only frontend authentication.
      // Not secure for production use.

      if (
        username === "admin" &&
        password === "123456"
      ) {
        const demoToken = "authenticated-user";

        localStorage.setItem("token", demoToken);
        setToken(demoToken);

        setUsername("");
        setPassword("");
      } else {
        throw new Error(
          "Invalid username or password"
        );
      }
    } catch (error) {
      setLoginError(
        error.message || "Unable to login"
      );
    } finally {
      setLoggingIn(false);
    }
  };

  // -----------------------------
  // LOGOUT
  // -----------------------------

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
  };

  // -----------------------------
  // LOGIN PAGE
  // -----------------------------

  if (!token) {
    return (
      <main className="page">
        <section className="card login-card">
          <div className="icon">🔐</div>

          <h1>User Login</h1>

          <p className="subtitle">
            Login to access the search system
          </p>

          <form onSubmit={login}>
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) =>
                setUsername(e.target.value)
              }
              required
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              required
            />

            <button
              type="submit"
              disabled={loggingIn}
            >
              {loggingIn
                ? "Logging in..."
                : "Login"}
            </button>
          </form>

          {loginError && (
            <div className="error">
              {loginError}
            </div>
          )}
        </section>
      </main>
    );
  }

  // -----------------------------
  // AUTHENTICATED APP
  // -----------------------------

  return (
    <SearchPage
      token={token}
      logout={logout}
    />
  );
}

// =================================
// SEARCH PAGE
// =================================

function SearchPage({ token, logout }) {
  const [mobile, setMobile] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // -----------------------------
  // SEARCH
  // -----------------------------

  const searchMobile = async (e) => {
    e.preventDefault();

    if (!/^[6-9]\d{9}$/.test(mobile)) {
      setError(
        "Please enter a valid 10-digit Indian mobile number."
      );

      setResults([]);
      return;
    }

    setLoading(true);
    setError("");
    setResults([]);

    try {
      const url =
        `${SEARCH_API_BASE}&q=${encodeURIComponent(mobile)}`;

      const response = await fetch(url);

      const text = await response.text();
      console.log("API Response:", text);

      let data;

      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(
          "API returned invalid JSON data."
        );
      }

      if (!response.ok) {
        throw new Error(
          data.message || "Request failed"
        );
      }

      // Support common response formats.
      // This API returns its record inside data.data.

      let records = [];

      if (Array.isArray(data)) {
        records = data;
      } else if (Array.isArray(data.Results)) {
        records = data.Results;
      } else if (Array.isArray(data.results)) {
        records = data.results;
      } else if (Array.isArray(data.data)) {
        records = data.data;
      } else if (Array.isArray(data.result)) {
        records = data.result;
      } else if (
        data.data &&
        typeof data.data === "object"
      ) {
        records = [data.data];
      } else if (data.mobile || data.name) {
        records = [data];
      }

      if (
        data.status &&
        data.status !== "success"
      ) {
        throw new Error(
          data.message || "API request was unsuccessful."
        );
      }

      if (records.length === 0) {
        throw new Error("No records found.");
      }

      setResults(records);
    } catch (err) {
      console.error("Search Error:", err);

      setError(
        err.message ||
        "Unable to connect to server."
      );
    } finally {
      setLoading(false);
    }
  };

  // -----------------------------
  // SEARCH PAGE UI
  // -----------------------------

  return (
    <main className="page">
      <section className="card">
        <div className="top-bar">
          <div>
            <div className="icon">🔎</div>
            <h1>Mobile Lookup</h1>
          </div>

          <button
            className="logout-btn"
            onClick={logout}
          >
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
              setMobile(
                e.target.value.replace(/\D/g, "")
              )
            }
            required
          />

          <button
            type="submit"
            disabled={loading}
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </form>

        {error && (
          <div className="error">
            {error}
          </div>
        )}

        {results.length > 0 && (
          <div className="results-container">
            <h2>
              Found {results.length} Record
              {results.length > 1 ? "s" : ""}
            </h2>

            {results.map((record, index) => (
              <div
                className="result"
                key={index}
              >
                <h3>
                  👤 {record.name || "Unknown"}
                </h3>

                <Info
                  label="📱 Mobile"
                  value={record.mobile}
                />

                <Info
                  label="👨 Father"
                  value={
                    record.fname || record.father
                  }
                />

                <Info
                  label="📡 Circle"
                  value={record.circle}
                />

                <Info
                  label="🏠 Address"
                  value={
                    record.address
                      ? record.address.replace(
                          /!/g,
                          ", "
                        )
                      : ""
                  }
                />
                 <Info
                  label="🏠 AddId"
                  value={
                    record.aadhar
                      ? record.aadhar.replace(
                          /!/g,
                          ", "
                        )
                      : ""
                  }
                />

                <Info
                  label="📧 Email"
                  value={record.email}
                />
              </div>
            ))}
          </div>
        )}

        <p className="notice">
          🔒 Login required. Use only with records
          you are authorized to access.
        </p>
      </section>
    </main>
  );
}

// =================================
// INFO ROW
// =================================

function Info({ label, value }) {
  return (
    <div className="row">
      <span>{label}</span>
      <strong>{value || "—"}</strong>
    </div>
  );
}

export default App;