import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import authRoutes from "./routes/authRoutes.js";
import examRoutes from "./routes/examRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import phoneCameraRoutes from "./routes/phoneCameraRoutes.js";
import { pool } from "./db.js";

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 4000;

const corsOptions = {
  origin: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  maxAge: 86400,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/phone-camera", phoneCameraRoutes);
app.use("/api/exams", examRoutes);
app.use("/api/admin", adminRoutes);

// Health check
app.get("/", (req, res) => {
  res.send("Chinese Math Exam API is running");
});

import { checkDbHealth } from "./db.js";
app.get("/api/health", async (req, res) => {
  try {
    const result = await checkDbHealth();
    res.json({ status: result.ok ? "ok" : "degraded", db: result.ok ? "connected" : "unreachable" });
  } catch (err) {
    res.status(503).json({ status: "error", db: err.message });
  }
});

// Initialize Socket.IO
const io = new Server(httpServer, {
  cors: corsOptions,
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Throttle map for camera snapshot storage: key = `${examId}-${studentId}-${cameraType}`, value = last save timestamp
const snapshotThrottles = new Map();
const SNAPSHOT_INTERVAL_MS = 60000; // Save one snapshot every 60 seconds

// Socket.IO connection handling
io.on("connection", (socket) => {
  const { type, examId, studentId } = socket.handshake.query;
  
  console.log(`Socket connected: ${socket.id}, type: ${type}, examId: ${examId}`);

  // Admin Dashboard Connection
  if (type === "admin_dashboard") {
    socket.join("admin_dashboard");
    console.log(`Admin dashboard connected: ${socket.id}`);

    socket.on("disconnect", () => {
      console.log(`Admin dashboard disconnected: ${socket.id}`);
    });
  }

  // Exam Monitoring (Admin viewing specific exam)
  else if (type === "admin" && examId) {
    const room = `exam-${examId}`;
    socket.join(room);
    console.log(`Admin monitoring exam ${examId}: ${socket.id}`);

    // Handle admin sending messages to students
    socket.on("admin_message", (data) => {
      const { targetStudentId, message, messageType } = data;
      console.log(`Admin message to student ${targetStudentId}: ${message} (type: ${messageType})`);
      // Send to the specific student in the exam room
      const timestamp = new Date().toISOString();
      io.to(room).emit("student_admin_message", {
        studentId: targetStudentId,
        message,
        messageType,
        timestamp,
      });
      // Persist to DB
      pool.query(
        `INSERT INTO exam_logs (exam_id, user_id, event_type, event_data) VALUES ($1, (SELECT id FROM users WHERE id::text = $2 LIMIT 1), $3, $4)`,
        [examId, targetStudentId, 'monitoring_message', JSON.stringify({ message, messageType, timestamp })]
      ).catch(err => console.error('Failed to save monitoring message:', err.message));
    });

    // Admin request camera check
    socket.on("admin_request_camera_check", (data) => {
      const { targetStudentId } = data;
      console.log(`Admin requesting camera check for student ${targetStudentId}`);
      io.to(room).emit("student_camera_check_request", {
        studentId: targetStudentId,
        timestamp: new Date().toISOString(),
      });
    });

    // Admin terminate exam
    socket.on("admin_terminate_exam", (data) => {
      const { targetStudentId } = data;
      console.log(`Admin terminating exam for student ${targetStudentId}`);
      const timestamp = new Date().toISOString();
      io.to(room).emit("student_exam_terminated", {
        studentId: targetStudentId,
        timestamp,
      });
      // Persist disqualification to DB
      pool.query(
        `INSERT INTO exam_logs (exam_id, user_id, event_type, event_data) VALUES ($1, (SELECT id FROM users WHERE id::text = $2 LIMIT 1), $3, $4)`,
        [examId, targetStudentId, 'monitoring_disqualify', JSON.stringify({ timestamp })]
      ).catch(err => console.error('Failed to save disqualification:', err.message));
    });

    socket.on("disconnect", () => {
      console.log(`Admin stopped monitoring exam ${examId}: ${socket.id}`);
    });
  }

  // Student Exam Session
  else if (type === "student" && examId && studentId) {
    const room = `exam-${examId}`;
    socket.join(room);
    console.log(`Student ${studentId} joined exam ${examId}: ${socket.id}`);

    // Notify admins that a new student joined
    const joinTimestamp = new Date().toISOString();
    socket.to(room).emit("student_joined", {
      socketId: socket.id,
      studentId: studentId,
      timestamp: joinTimestamp,
    });
    // Persist student join to DB
    pool.query(
      `INSERT INTO exam_logs (exam_id, user_id, event_type, event_data) VALUES ($1, (SELECT id FROM users WHERE id::text = $2 LIMIT 1), $3, $4)`,
      [examId, studentId, 'monitoring_student_joined', JSON.stringify({ timestamp: joinTimestamp })]
    ).catch(err => console.error('Failed to save student join:', err.message));

    // Camera stream from student (laptop camera)
    socket.on("camera_stream", (data) => {
      // Forward to admins monitoring this exam
      socket.to(room).emit("student_camera_stream", {
        studentId,
        socketId: socket.id,
        data: data.data,
        cameraType: data.cameraType || "laptop",
        timestamp: data.timestamp,
      });
      // Throttled snapshot save
      const throttleKey = `${examId}-${studentId}-laptop`;
      const lastSave = snapshotThrottles.get(throttleKey) || 0;
      if (Date.now() - lastSave >= SNAPSHOT_INTERVAL_MS && data.data) {
        snapshotThrottles.set(throttleKey, Date.now());
        pool.query(
          `INSERT INTO exam_logs (exam_id, user_id, event_type, event_data) VALUES ($1, (SELECT id FROM users WHERE id::text = $2 LIMIT 1), $3, $4)`,
          [examId, studentId, 'camera_snapshot', JSON.stringify({ cameraType: 'laptop', image: data.data, timestamp: data.timestamp || new Date().toISOString() })]
        ).catch(err => console.error('Failed to save laptop snapshot:', err.message));
      }
    });

    // Phone camera stream
    socket.on("phone_camera_stream", (data) => {
      socket.to(room).emit("student_phone_camera_stream", {
        studentId,
        socketId: socket.id,
        data: data.data,
        timestamp: data.timestamp,
      });
      // Throttled snapshot save
      const throttleKey = `${examId}-${studentId}-phone`;
      const lastSave = snapshotThrottles.get(throttleKey) || 0;
      if (Date.now() - lastSave >= SNAPSHOT_INTERVAL_MS && data.data) {
        snapshotThrottles.set(throttleKey, Date.now());
        pool.query(
          `INSERT INTO exam_logs (exam_id, user_id, event_type, event_data) VALUES ($1, (SELECT id FROM users WHERE id::text = $2 LIMIT 1), $3, $4)`,
          [examId, studentId, 'camera_snapshot', JSON.stringify({ cameraType: 'phone', image: data.data, timestamp: data.timestamp || new Date().toISOString() })]
        ).catch(err => console.error('Failed to save phone snapshot:', err.message));
      }
    });

    // Camera status updates
    socket.on("camera_status", (data) => {
      socket.to(room).emit("camera_status", {
        studentId,
        ...data,
      });
    });

    // Camera error notifications
    socket.on("camera_error", (data) => {
      socket.to(room).emit("camera_error", {
        studentId,
        ...data,
      });
    });

    // Violation detection
    socket.on("violation_detected", (data) => {
      console.log(`Violation detected: Student ${studentId}, Type: ${data.type}`);
      const violationTimestamp = data.timestamp || new Date().toISOString();
      socket.to(room).emit("student_violation", {
        studentId,
        socketId: socket.id,
        violationType: data.type,
        severity: data.severity,
        timestamp: violationTimestamp,
      });
      // Persist violation to DB
      pool.query(
        `INSERT INTO exam_logs (exam_id, user_id, event_type, event_data) VALUES ($1, (SELECT id FROM users WHERE id::text = $2 LIMIT 1), $3, $4)`,
        [examId, studentId, 'monitoring_violation', JSON.stringify({ type: data.type, severity: data.severity, timestamp: violationTimestamp })]
      ).catch(err => console.error('Failed to save violation:', err.message));
    });

    // Student status updates
    socket.on("student_status", (data) => {
      socket.to(room).emit("student_status_update", {
        studentId,
        socketId: socket.id,
        status: data.status,
        timestamp: data.timestamp || new Date().toISOString(),
      });
    });

    // Phone camera ready notification
    socket.on("phone_camera_ready", (data) => {
      console.log(`Phone camera ready: Student ${data.studentId} in exam ${data.examId}`);
      // Relay to all sockets in the exam room (including the laptop)
      io.to(`exam-${data.examId}`).emit("phone_camera_ready", {
        studentId: data.studentId,
        examId: data.examId,
        timestamp: new Date().toISOString(),
      });
    });

    socket.on("disconnect", () => {
      console.log(`Student ${studentId} left exam ${examId}: ${socket.id}`);
      const leftTimestamp = new Date().toISOString();
      socket.to(room).emit("student_left", {
        socketId: socket.id,
        studentId: studentId,
        timestamp: leftTimestamp,
      });
      // Persist student leave to DB
      pool.query(
        `INSERT INTO exam_logs (exam_id, user_id, event_type, event_data) VALUES ($1, (SELECT id FROM users WHERE id::text = $2 LIMIT 1), $3, $4)`,
        [examId, studentId, 'monitoring_student_left', JSON.stringify({ timestamp: leftTimestamp })]
      ).catch(err => console.error('Failed to save student leave:', err.message));
    });
  }

  // Unknown connection type
  else {
    console.log(`Unknown connection type: ${type}, disconnecting ${socket.id}`);
    socket.disconnect();
  }
});

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Socket.IO server initialized`);
});

// Global error handler
app.use((err, req, res, _next) => {
  console.error("Unhandled error:", err);
  if (!res.headersSent) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, closing server...");
  io.close(() => {
    console.log("Socket.IO server closed");
  });
  const { pool } = await import("./db.js");
  await pool.end().catch(() => {});
  process.exit(0);
});
