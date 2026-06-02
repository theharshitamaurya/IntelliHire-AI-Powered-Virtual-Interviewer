const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const interviewRoutes = require("./routes/interviewRoutes");
const jdRoutes = require("./routes/jdRoutes");
const questionRoutes = require("./routes/questionRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");

dotenv.config();

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static("uploads"));

app.use("/api/interviews", interviewRoutes);
app.use("/api/jds", jdRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/analytics", analyticsRoutes);

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "IntelliHire Backend is running",
    timestamp: new Date().toISOString(),
  });
});

app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({
    message: "Internal server error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

module.exports = app;
