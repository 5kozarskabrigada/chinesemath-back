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
} from "../controllers/adminController.js";
import { authMiddleware, adminMiddleware } from "../middleware/authMiddleware.js";

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

export default router;
