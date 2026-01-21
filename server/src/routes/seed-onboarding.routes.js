import express from "express";
import EmployeeOnboarding from "../models/EmployeeOnboarding.model.js";
import mongoose from "mongoose";

const router = express.Router();

router.post("/seed-onboarding", async (req, res) => {
  try {
    const onboarding = await EmployeeOnboarding.create({
      employee: new mongoose.Types.ObjectId(),
      program: new mongoose.Types.ObjectId(),
      startDate: new Date(),

      tasks: [
        {
          title: "Välkomstpaket & Introduktion",
          status: "Klar",
          order: 1,
          items: [
            { type: "file", label: "Välkomstguide.pdf" },
            { type: "file", label: "Företagspresentation.pptx" },
          ],
        },
        {
          title: "Systemåtkomster & IT-Setup",
          status: "Pågår",
          order: 2,
          comment: "Väntar på Jira-konto",
          items: [
            { type: "file", label: "IT policy.pdf" },
            { type: "file", label: "Inloggningsguide.pdf" },
          ],
        },
      ],
    });

    res.status(201).json(onboarding);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;