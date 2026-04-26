import express from "express";

const router = express.Router();

// Phone camera ready status (in-memory store for simplicity) - no auth required
const phoneCameraReadyStatus = new Map(); // key: examId_studentId, value: timestamp

router.post("/ready", (req, res) => {
  const { examId, studentId } = req.body;
  const key = `${examId}_${studentId}`;
  phoneCameraReadyStatus.set(key, Date.now());
  res.json({ success: true });
});

router.get("/ready/:examId/:studentId", (req, res) => {
  const { examId, studentId } = req.params;
  const key = `${examId}_${studentId}`;
  const timestamp = phoneCameraReadyStatus.get(key);
  // Check if ready within last 30 seconds
  const isReady = timestamp && (Date.now() - timestamp) < 30000;
  res.json({ ready: !!isReady });
});

export default router;
