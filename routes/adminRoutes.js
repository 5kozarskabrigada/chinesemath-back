import express from "express";
import {
  getUsers,
  createUser,
  deleteUser,
  getExams,
  getExamById,
  createExam,
  updateExam,
  deleteExam,
  getSubmissions,
  getSubmissionDetail,
  getDashboardStats,
  getClassrooms,
  getClassroomById,
  createClassroom,
  updateClassroom,
  deleteClassroom,
  addStudentToClassroom,
  removeStudentFromClassroom,
  getExamLogs,
  getExamLogStats,
  getMonitoringEvents,
  getExamSessions,
  getStudentSessionDetail,
} from "../controllers/adminController.js";
import { authMiddleware, adminMiddleware } from "../middleware/authMiddleware.js";

// ─── Recycle Bin ───────────────────────────────────────────────────────────
import {
  getRecycleBin,
  restoreUser,
  restoreExam,
  restoreQuestion,
  restoreClassroom,
  permanentlyDeleteUser,
  permanentlyDeleteExam,
  permanentlyDeleteQuestion,
  permanentlyDeleteClassroom,
} from "../controllers/adminController.js";

const router = express.Router();

router.use(authMiddleware, adminMiddleware);

// Dashboard
router.get("/stats", getDashboardStats);

// Users
router.get("/users", getUsers);
router.post("/users", createUser);
router.delete("/users/:userId", deleteUser);

// Exams
router.get("/exams", getExams);
router.get("/exams/:examId", getExamById);
router.post("/exams", createExam);
router.put("/exams/:examId", updateExam);
router.delete("/exams/:examId", deleteExam);

// Submissions
router.get("/submissions", getSubmissions);
router.get("/submissions/:submissionId", getSubmissionDetail);

// Classrooms
router.get("/classrooms", getClassrooms);
router.get("/classrooms/:id", getClassroomById);
router.post("/classrooms", createClassroom);
router.put("/classrooms/:id", updateClassroom);
router.delete("/classrooms/:id", deleteClassroom);
router.post("/classrooms/:classroomId/students", addStudentToClassroom);
router.delete("/classrooms/:classroomId/students/:userId", removeStudentFromClassroom);

// Exam Logs
router.get("/logs", getExamLogs);
router.get("/logs/stats", getExamLogStats);

// Monitoring Events
router.get("/exams/:examId/monitoring-events", getMonitoringEvents);

// Exam Sessions
router.get("/exams/:examId/sessions", getExamSessions);
router.get("/exams/:examId/sessions/:studentId", getStudentSessionDetail);

// ─── Recycle Bin ───────────────────────────────────────────────────────────
// List all deleted items
router.get("/recycle-bin", getRecycleBin);

// Restore endpoints
router.post("/recycle-bin/users/:userId/restore", restoreUser);
router.post("/recycle-bin/exams/:examId/restore", restoreExam);
router.post("/recycle-bin/questions/:questionId/restore", restoreQuestion);
router.post("/recycle-bin/classrooms/:classroomId/restore", restoreClassroom);

// Permanent delete endpoints
router.delete("/recycle-bin/users/:userId", permanentlyDeleteUser);
router.delete("/recycle-bin/exams/:examId", permanentlyDeleteExam);
router.delete("/recycle-bin/questions/:questionId", permanentlyDeleteQuestion);
router.delete("/recycle-bin/classrooms/:classroomId", permanentlyDeleteClassroom);

export default router;
