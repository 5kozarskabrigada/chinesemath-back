import express from "express";
import {
  joinExam,
  getExamQuestions,
  submitExam,
  getMyResult,
  getMyExams,
  logExamEvent,
} from "../controllers/examController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

// Phone camera ready status (in-memory store for simplicity) - no auth required
const phoneCameraReadyStatus = new Map(); // key: examId_studentId, value: timestamp

router.post("/:examId/phone-camera-ready", (req, res) => {
  const { examId } = req.params;
  const { studentId } = req.body;
  const key = `${examId}_${studentId}`;
  phoneCameraReadyStatus.set(key, Date.now());
  res.json({ success: true });
});

router.get("/:examId/phone-camera-ready/:studentId", (req, res) => {
  const { examId, studentId } = req.params;
  const key = `${examId}_${studentId}`;
  const timestamp = phoneCameraReadyStatus.get(key);
  // Check if ready within last 30 seconds
  const isReady = timestamp && (Date.now() - timestamp) < 30000;
  res.json({ ready: !!isReady });
});

// All other routes require auth
router.use(authMiddleware);

router.post("/join", joinExam);
router.get("/my", getMyExams);
router.get("/:examId/questions", getExamQuestions);
router.post("/:examId/submit", submitExam);
router.get("/:examId/result", getMyResult);
router.post("/log", logExamEvent);

export default router;
