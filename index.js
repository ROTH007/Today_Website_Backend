require("dotenv").config();
const express = require("express");
const cors = require("cors");
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

const app = express();

app.use(cors());
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