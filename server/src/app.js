import express from "express";
import cors from "cors";

import authRoutes from "./routes/auth.routes.js";
import programRoutes from "./routes/program.routes.js";
import onboardingRoutes from "./routes/onboarding.routes.js";
import employeeRoutes from "./routes/employee.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";

import errorHandler from "./middlewares/errorHandler.js";

const app = express();


app.use(cors());
app.use(express.json());


app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});


app.use("/api/auth", authRoutes);
app.use("/api/programs", programRoutes);
app.use("/api/onboardings", onboardingRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/dashboard", dashboardRoutes);


app.use(errorHandler);

export default app;