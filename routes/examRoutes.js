import express from "express";
import {
  joinExam,
  getExamQuestions,
  submitExam,
  getMyResult,
  getMyExams,
} from "../controllers/examController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authMiddleware);

router.post("/join", joinExam);
router.get("/my", getMyExams);
router.get("/:examId/questions", getExamQuestions);
router.post("/:examId/submit", submitExam);
router.get("/:examId/result", getMyResult);

export default router;
