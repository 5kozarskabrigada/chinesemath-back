import { pool } from "../db.js";
import { v4 as uuidv4 } from "uuid";

// ─── Student: join exam by access code ─────────────────────────────────────

export async function joinExam(req, res) {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: "Access code required" });
  try {
    const result = await pool.query(
      `SELECT id, title, description, duration_minutes, total_questions, status
       FROM exams
       WHERE access_code = $1 AND status = 'published' AND is_deleted = false`,
      [code.trim().toUpperCase()]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Exam not found or not available" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("joinExam error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ─── Student: get exam questions (no correct answers) ───────────────────────

export async function getExamQuestions(req, res) {
  const { examId } = req.params;
  try {
    const examResult = await pool.query(
      `SELECT id, title, description, duration_minutes, total_questions, status
       FROM exams WHERE id = $1 AND is_deleted = false`,
      [examId]
    );
    if (!examResult.rows[0]) return res.status(404).json({ error: "Exam not found" });
    const exam = examResult.rows[0];
    if (exam.status !== "published") return res.status(403).json({ error: "Exam is not available" });

    // Check existing submission
    const subResult = await pool.query(
      `SELECT id, status FROM exam_submissions WHERE exam_id = $1 AND user_id = $2`,
      [examId, req.user.id]
    );
    if (subResult.rows[0]?.status === "submitted") {
      return res.status(409).json({ error: "You have already submitted this exam" });
    }

    const qResult = await pool.query(
      `SELECT id, question_number, question_text, options
       FROM questions
       WHERE exam_id = $1 AND is_deleted = false
       ORDER BY question_number ASC`,
      [examId]
    );

    res.json({ exam, questions: qResult.rows });
  } catch (err) {
    console.error("getExamQuestions error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ─── Student: submit exam ────────────────────────────────────────────────────

export async function submitExam(req, res) {
  const { examId } = req.params;
  const { answers, timeSpent } = req.body;
  // answers: { [questionId]: "A" | "B" | "C" | "D" }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Verify exam exists and is published
    const examResult = await client.query(
      `SELECT id, total_questions FROM exams WHERE id = $1 AND status = 'published' AND is_deleted = false`,
      [examId]
    );
    if (!examResult.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Exam not found" });
    }

    // Prevent double submission
    const existingSub = await client.query(
      `SELECT id, status FROM exam_submissions WHERE exam_id = $1 AND user_id = $2`,
      [examId, req.user.id]
    );
    if (existingSub.rows[0]?.status === "submitted") {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Already submitted" });
    }

    // Fetch correct answers
    const qResult = await client.query(
      `SELECT id, question_number, correct_answer FROM questions WHERE exam_id = $1 AND is_deleted = false`,
      [examId]
    );
    const questions = qResult.rows;

    let totalCorrect = 0;
    const answerRows = [];

    for (const q of questions) {
      const userAnswer = answers?.[q.id] ?? null;
      const isCorrect = userAnswer !== null && userAnswer === q.correct_answer;
      if (isCorrect) totalCorrect++;
      answerRows.push({ questionId: q.id, userAnswer, isCorrect });
    }

    const totalQuestions = questions.length;
    const score = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

    // Upsert submission
    let submissionId;
    if (existingSub.rows[0]) {
      await client.query(
        `UPDATE exam_submissions
         SET answers = $1, total_correct = $2, total_questions = $3, score = $4,
             time_spent = $5, status = 'submitted', submitted_at = NOW()
         WHERE id = $6`,
        [JSON.stringify(answers), totalCorrect, totalQuestions, score, timeSpent || 0, existingSub.rows[0].id]
      );
      submissionId = existingSub.rows[0].id;
    } else {
      const subInsert = await client.query(
        `INSERT INTO exam_submissions (exam_id, user_id, answers, total_correct, total_questions, score, time_spent, status, submitted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'submitted', NOW())
         RETURNING id`,
        [examId, req.user.id, JSON.stringify(answers), totalCorrect, totalQuestions, score, timeSpent || 0]
      );
      submissionId = subInsert.rows[0].id;
    }

    // Insert individual answer records
    for (const a of answerRows) {
      await client.query(
        `INSERT INTO answers (submission_id, question_id, user_answer, is_correct)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (submission_id, question_id) DO UPDATE
         SET user_answer = EXCLUDED.user_answer, is_correct = EXCLUDED.is_correct`,
        [submissionId, a.questionId, a.userAnswer, a.isCorrect]
      );
    }

    await client.query("COMMIT");
    res.json({ submissionId, totalCorrect, totalQuestions, score });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("submitExam error:", err);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
}

// ─── Student: get own submission result ─────────────────────────────────────

export async function getMyResult(req, res) {
  const { examId } = req.params;
  try {
    const result = await pool.query(
      `SELECT es.id, es.total_correct, es.total_questions, es.score, es.time_spent, es.submitted_at,
              e.title AS exam_title
       FROM exam_submissions es
       JOIN exams e ON e.id = es.exam_id
       WHERE es.exam_id = $1 AND es.user_id = $2 AND es.status = 'submitted'`,
      [examId, req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Submission not found" });

    // Get answers with correct answers
    const answersResult = await pool.query(
      `SELECT a.question_id, a.user_answer, a.is_correct,
              q.question_number, q.question_text, q.options, q.correct_answer
       FROM answers a
       JOIN questions q ON q.id = a.question_id
       WHERE a.submission_id = $1
       ORDER BY q.question_number ASC`,
      [result.rows[0].id]
    );

    res.json({ submission: result.rows[0], answers: answersResult.rows });
  } catch (err) {
    console.error("getMyResult error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ─── Student: list own exams ─────────────────────────────────────────────────

export async function getMyExams(req, res) {
  try {
    const result = await pool.query(
      `SELECT es.exam_id, e.title, es.score, es.total_correct, es.total_questions,
              es.status, es.submitted_at
       FROM exam_submissions es
       JOIN exams e ON e.id = es.exam_id
       WHERE es.user_id = $1
       ORDER BY es.submitted_at DESC NULLS LAST`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("getMyExams error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
