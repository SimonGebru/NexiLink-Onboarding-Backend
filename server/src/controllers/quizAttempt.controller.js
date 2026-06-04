import mongoose from "mongoose";
import ApiError from "../utils/ApiError.js";

import EmployeeOnboarding from "../models/EmployeeOnboarding.model.js";
import Quiz from "../models/Quiz.model.js";
import QuizAttempt from "../models/QuizAttempt.model.js";

function calculateResult({ quizQuestions = [], answers = [] }) {
  const normalizedAnswers = answers.map((answer) => ({
    questionIndex: Number(answer.questionIndex),
    selectedAnswer: Number(answer.selectedAnswer),
  }));

  const gradedAnswers = normalizedAnswers.map((answer) => {
    const question = quizQuestions[answer.questionIndex];

    if (!question) {
      return {
        ...answer,
        isCorrect: false,
      };
    }

    return {
      ...answer,
      isCorrect: answer.selectedAnswer === question.correctAnswer,
    };
  });

  const score = gradedAnswers.filter((answer) => answer.isCorrect).length;
  const totalQuestions = quizQuestions.length;
  const percent =
    totalQuestions === 0 ? 0 : Math.round((score / totalQuestions) * 100);

  return {
    gradedAnswers,
    score,
    totalQuestions,
    percent,
    passed: percent >= 70,
  };
}

export async function submitQuizAttempt(req, res, next) {
  try {
    const { onboardingId } = req.params;
    const { answers } = req.body;

    if (!mongoose.Types.ObjectId.isValid(onboardingId)) {
      throw new ApiError(400, "Invalid onboardingId format");
    }

    if (!Array.isArray(answers) || answers.length === 0) {
      throw new ApiError(400, "answers must be a non-empty array");
    }

    const onboarding = await EmployeeOnboarding.findById(onboardingId)
      .populate("employee")
      .populate("assignedQuiz");

    if (!onboarding) {
      throw new ApiError(404, "Onboarding not found");
    }

    if (!onboarding.assignedQuiz) {
      throw new ApiError(400, "This onboarding does not have an assigned quiz");
    }

    const isAdminOrHr = req.user.role === "admin" || req.user.role === "hr";

    const isEmployeeOwner =
      req.user.role === "employee" &&
      req.user.employeeId &&
      onboarding.employee?._id?.toString() === req.user.employeeId.toString();

    if (!isAdminOrHr && !isEmployeeOwner) {
      throw new ApiError(403, "You are not allowed to submit this quiz");
    }

    const quiz = await Quiz.findById(onboarding.assignedQuiz._id);

    if (!quiz) {
      throw new ApiError(404, "Quiz not found");
    }

    const quizQuestions = quiz.quiz?.questions || [];

    if (quizQuestions.length === 0) {
      throw new ApiError(400, "Quiz does not contain any questions");
    }

    const hasInvalidAnswer = answers.some((answer) => {
      const questionIndex = Number(answer.questionIndex);
      const selectedAnswer = Number(answer.selectedAnswer);

      return (
        !Number.isInteger(questionIndex) ||
        questionIndex < 0 ||
        questionIndex >= quizQuestions.length ||
        !Number.isInteger(selectedAnswer) ||
        selectedAnswer < 0 ||
        selectedAnswer > 3
      );
    });

    if (hasInvalidAnswer) {
      throw new ApiError(
        400,
        "Each answer must have a valid questionIndex and selectedAnswer"
      );
    }

    const { gradedAnswers, score, totalQuestions, percent, passed } =
      calculateResult({
        quizQuestions,
        answers,
      });

    const attempt = await QuizAttempt.create({
      employee: onboarding.employee._id,
      onboarding: onboarding._id,
      quiz: quiz._id,
      answers: gradedAnswers,
      score,
      totalQuestions,
      percent,
      passed,
      completedAt: new Date(),
    });

    const populatedAttempt = await QuizAttempt.findById(attempt._id)
      .populate("employee")
      .populate("onboarding")
      .populate("quiz");

    res.status(201).json({
      ok: true,
      attempt: populatedAttempt,
    });
  } catch (err) {
    next(err);
  }
}

export async function getMyQuizAttempts(req, res, next) {
  try {
    const employeeId = req.user?.employeeId;

    if (!employeeId) {
      throw new ApiError(401, "No employeeId found on user");
    }

    const attempts = await QuizAttempt.find({
      employee: employeeId,
    })
      .sort({ createdAt: -1 })
      .populate("quiz")
      .populate("onboarding");

    res.json({
      ok: true,
      attempts,
    });
  } catch (err) {
    next(err);
  }
}

export async function getOnboardingQuizAttempts(req, res, next) {
  try {
    const { onboardingId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(onboardingId)) {
      throw new ApiError(400, "Invalid onboardingId format");
    }

    const onboarding = await EmployeeOnboarding.findById(onboardingId);

    if (!onboarding) {
      throw new ApiError(404, "Onboarding not found");
    }

    const isAdminOrHr = req.user.role === "admin" || req.user.role === "hr";

    const isEmployeeOwner =
      req.user.role === "employee" &&
      req.user.employeeId &&
      onboarding.employee?.toString() === req.user.employeeId.toString();

    if (!isAdminOrHr && !isEmployeeOwner) {
      throw new ApiError(403, "You are not allowed to view these attempts");
    }

    const attempts = await QuizAttempt.find({
      onboarding: onboardingId,
    })
      .sort({ createdAt: -1 })
      .populate("employee")
      .populate("quiz");

    res.json({
      ok: true,
      attempts,
    });
  } catch (err) {
    next(err);
  }
}