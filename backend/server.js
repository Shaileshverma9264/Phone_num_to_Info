// const express = require("express");
// const cors = require("cors");
// require("dotenv").config();

// const app = express();
// const PORT = process.env.PORT || 5000;

// app.use(cors());
// app.use(express.json());

// app.get("/api/lookup/:mobile", async (req, res) => {
//   const { mobile } = req.params;

//   if (!/^[6-9]\d{9}$/.test(mobile)) {
//     return res.status(400).json({
//       message: "Invalid mobile number",
//     });
//   }

//   try {
//     if (!process.env.API_URL || !process.env.API_KEY) {
//       return res.status(500).json({
//         message: "Configure API_URL and API_KEY in backend/.env first.",
//       });
//     }

//     const upstreamResponse = await fetch(
//       `${process.env.API_URL}?mobile=${encodeURIComponent(mobile)}`,
//       {
//         headers: {
//           Authorization: `Bearer ${process.env.API_KEY}`,
//           Accept: "application/json",
//         },
//       },
//     );

//     if (!upstreamResponse.ok) {
//       return res.status(404).json({
//         message: "Record not found",
//       });
//     }

//     const data = await upstreamResponse.json();

//     if (!Array.isArray(data.Results) || data.Results.length === 0) {
//       return res.status(404).json({
//         message: "Record not found",
//       });
//     }

//     const record = data.Results[0];

//     // Only return fields your application is authorized to disclose.
//     res.json({
//       mobile: record.mobile || "",
//       name: record.name || "",
//       father: record.father || "",
//       circle: record.circle || "",
//       address: record.address || "",
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({
//       message: "Unable to reach upstream API.",
//     });
//   }
// });

// app.listen(PORT, () => {
//   console.log(`Backend running at http://localhost:${PORT}`);
// });

const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// -----------------------------
// Authentication Middleware
// -----------------------------
app.get("/", (req, res) => {
  res.send("Backend is running successfully!");
});
function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      message: "Authentication required",
    });
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      message: "Invalid authentication token",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;

    next();
  } catch (error) {
    return res.status(403).json({
      message: "Session expired or invalid",
    });
  }
}

// -----------------------------
// Login API
// -----------------------------

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;

  if (
    username !== process.env.ADMIN_USERNAME ||
    password !== process.env.ADMIN_PASSWORD
  ) {
    return res.status(401).json({
      message: "Invalid username or password",
    });
  }

  const token = jwt.sign(
    {
      username: username,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "1h",
    },
  );

  res.json({
    message: "Login successful",
    token: token,
  });
});

// -----------------------------
// Protected Mobile Lookup API
// -----------------------------

app.get("/api/lookup/:mobile", authenticateToken, async (req, res) => {
  const { mobile } = req.params;

  if (!/^[6-9]\d{9}$/.test(mobile)) {
    return res.status(400).json({
      message: "Invalid mobile number",
    });
  }

  try {
    if (!process.env.API_URL || !process.env.API_KEY) {
      return res.status(500).json({
        message: "Configure API_URL and API_KEY first.",
      });
    }

    const upstreamResponse = await fetch(
      `${process.env.API_URL}?mobile=${encodeURIComponent(mobile)}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.API_KEY}`,
          Accept: "application/json",
        },
      },
    );

    if (!upstreamResponse.ok) {
      return res.status(404).json({
        message: "Record not found",
      });
    }

    const data = await upstreamResponse.json();

    if (!Array.isArray(data.Results) || data.Results.length === 0) {
      return res.status(404).json({
        message: "Record not found",
      });
    }

    // Return all records
    const records = data.Results.map((record) => ({
      mobile: record.mobile || "",

      name: record.name || "",

      father: record.father || "",

      circle: record.circle || "",

      address: record.address || "",
    }));

    res.json(records);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Unable to reach upstream API.",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});
