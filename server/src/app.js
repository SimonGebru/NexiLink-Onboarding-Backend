import express from "express";
import cors from "cors";

import authRoutes from "./routes/auth.routes.js";
import programRoutes from "./routes/program.routes.js";
import onboardingRoutes from "./routes/onboarding.routes.js";
import employeeRoutes from "./routes/employee.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import devAiRoutes from "./routes/devAi.routes.js";
import notificationsRouter from "./routes/notifications.js";
import programAnalysisRoutes from "./routes/programAnalysis.routes.js";
import meRoutes from "./routes/me.routes.js";
import inviteRoutes from "./routes/invite.routes.js";
import conversationRoutes from "./routes/conversation.routes.js";
import todoRoutes from "./routes/todo.routes.js";
import quizRoutes from "./routes/quiz.routes.js";
import quizAttemptRoutes from "./routes/quizAttempt.routes.js";

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
app.use("/api/dev/ai", devAiRoutes);
app.use("/api/notifications", notificationsRouter);
app.use("/api/programs", programAnalysisRoutes);
app.use("/api", quizRoutes);
app.use("/api", quizAttemptRoutes);
app.use("/api/me", meRoutes);
app.use("/api/invites/employee", inviteRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/todos", todoRoutes);

app.use(errorHandler);

export default app;
