require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");

const authRoutes = require("./src/routes/auth");
const userRoutes = require("./src/routes/users");
const newsRoutes = require("./src/routes/news");
const uploadRoutes = require("./src/routes/uploads");
const auditLogRoutes = require("./src/routes/auditLogs");
const dashboardRoutes = require("./src/routes/dashboard");
const eventsRoutes = require("./src/routes/events");
const pageContentRoutes = require("./src/routes/pageContent");
const pageBlocksRoutes = require("./src/routes/pageBlocks");
const provinceCoverageRoutes = require("./src/routes/provinceCoverage");
const pricingPlansRoutes = require("./src/routes/pricingPlans");
const servicesContentRoutes = require("./src/routes/servicesContent");
const trustedClientsRoutes = require("./src/routes/trustedClients");
const testimonialsRoutes = require("./src/routes/testimonials");
const careerOpeningsRoutes = require("./src/routes/careerOpenings");

const app = express();

// If you deploy behind a reverse proxy / load balancer (Render, Railway,
// Vercel, Nginx, etc.), uncomment this — otherwise every request looks
// like it comes from the proxy's IP, which breaks IP-based rate limiting.
// app.set("trust proxy", 1);

// Adds a set of standard security response headers (blocks clickjacking,
// MIME-sniffing attacks, hides the "X-Powered-By: Express" fingerprint, etc.)
app.use(helmet());

// Only the domains listed here may call this API from a browser. Add your
// real domains via the ALLOWED_ORIGINS env var, comma-separated, e.g.:
//   ALLOWED_ORIGINS=https://admin.today.com.kh,https://today.com.kh
// Local dev origins are always allowed so `npm run dev` keeps working.
const DEV_ORIGINS = ["http://localhost:5173", "http://localhost:5174"];
const allowedOrigins = [
  ...DEV_ORIGINS,
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()) : []),
];

app.use(
  cors({
    origin(origin, callback) {
      // Allow requests with no origin (server-to-server, curl, mobile apps).
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
  }),
);

app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/news", newsRoutes);
app.use("/uploads-api", uploadRoutes);
app.use("/audit-logs", auditLogRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/events", eventsRoutes);
app.use("/page-content", pageContentRoutes);
app.use("/page-blocks", pageBlocksRoutes);
app.use("/province-coverage", provinceCoverageRoutes);
app.use("/pricing-plans", pricingPlansRoutes);
app.use("/services-content", servicesContentRoutes);
app.use("/trusted-clients", trustedClientsRoutes);
app.use("/testimonials", testimonialsRoutes);
app.use("/career-openings", careerOpeningsRoutes);
app.use("/contact-info", require("./src/routes/contactInfo"));
app.use("/contact-messages", require("./src/routes/contactMessages"));

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`TODAY Admin API running on http://localhost:${PORT}`);
});