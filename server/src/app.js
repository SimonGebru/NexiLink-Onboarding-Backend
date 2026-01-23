import express from "express";
import cors from "cors";
//import seedRoutes from "./routes/seed.routes.js";
//import seedOnboardingRoutes from "./routes/seed-onboarding.routes.js";
import errorHandler from "./middlewares/errorHandler.js";
//import ApiError from "./utils/ApiError.js";
import authRoutes from "./routes/auth.routes.js";

const app = express();


app.use(cors());
app.use(express.json());
//app.use((req, res, next) => {
  //console.log("REQ:", req.method, req.url);
 // next();
//});
//app.get("/api/dev/test-error", (req, res) => {
//throw new ApiError(400, "Testfel: något gick med flit fel");
//});

//app.use("/api/dev", seedRoutes);
// app.use("/api/dev", seedOnboardingRoutes);

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

// Routes kopplas in här:
app.use("/api/auth", authRoutes);
// app.use("/api/programs", programRoutes);
// app.use("/api/employees", employeeRoutes);
// app.use("/api/onboardings", onboardingRoutes);

app.use(errorHandler);

export default app;