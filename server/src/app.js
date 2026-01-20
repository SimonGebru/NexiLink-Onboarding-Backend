import express from "express";
import cors from "cors";

const app = express();


app.use(cors());
app.use(express.json());


app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

// Routes kopplas in här:
// app.use("/api/auth", authRoutes);
// app.use("/api/programs", programRoutes);
// app.use("/api/employees", employeeRoutes);
// app.use("/api/onboardings", onboardingRoutes);

export default app;