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
app.use("/api/exams", phoneCameraRoutes);
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

    // Send list of active students in this exam
    const studentsInRoom = Array.from(io.sockets.adapter.rooms.get(room) || [])
      .map(id => io.sockets.sockets.get(id))
      .filter(s => s && s.handshake.query.type === "student")
      .map(s => ({
        socketId: s.id,
        studentId: s.handshake.query.studentId,
      }));

    socket.emit("active_students", studentsInRoom);

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
    socket.to(room).emit("student_joined", {
      socketId: socket.id,
      studentId: studentId,
      timestamp: new Date().toISOString(),
    });

    // Camera stream from student (laptop camera)
    socket.on("camera_stream", (data) => {
      // Forward to admins monitoring this exam
      socket.to(room).emit("student_camera_stream", {
        studentId,
        socketId: socket.id,
        stream: data.stream,
        cameraType: data.cameraType || "laptop",
        timestamp: data.timestamp,
      });
    });

    // Phone camera stream
    socket.on("phone_camera_stream", (data) => {
      socket.to(room).emit("student_phone_camera_stream", {
        studentId,
        socketId: socket.id,
        stream: data.stream,
        timestamp: data.timestamp,
      });
    });

    // Violation detection
    socket.on("violation_detected", (data) => {
      console.log(`Violation detected: Student ${studentId}, Type: ${data.type}`);
      socket.to(room).emit("student_violation", {
        studentId,
        socketId: socket.id,
        violationType: data.type,
        severity: data.severity,
        timestamp: data.timestamp || new Date().toISOString(),
      });
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
      socket.to(room).emit("student_left", {
        socketId: socket.id,
        studentId: studentId,
        timestamp: new Date().toISOString(),
      });
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
