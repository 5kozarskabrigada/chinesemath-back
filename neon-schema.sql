-- ============================================================
-- Chinese Math Exam Platform — Neon PostgreSQL Schema
-- Run this ONCE in the Neon SQL Editor.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Users ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE,
    username VARCHAR(100) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'student' CHECK (role IN ('admin', 'student')),
    is_active BOOLEAN DEFAULT true,
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ─── Exams ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS exams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    access_code VARCHAR(20) UNIQUE NOT NULL,
    duration_minutes INTEGER DEFAULT 60,
    total_questions INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived', 'deleted')),
    is_deleted BOOLEAN DEFAULT false,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exams_access_code ON exams(access_code);
CREATE INDEX IF NOT EXISTS idx_exams_status ON exams(status);

-- ─── Questions (MCQ) ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
    question_number INTEGER NOT NULL,
    -- LaTeX/plain text question
    question_text TEXT NOT NULL,
    -- JSON array: [{"label":"A","text":"..."},{"label":"B","text":"..."},...]
    options JSONB NOT NULL,
    -- Correct option label: "A", "B", "C", or "D"
    correct_answer VARCHAR(5) NOT NULL,
    explanation TEXT DEFAULT '',
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(exam_id, question_number)
);

CREATE INDEX IF NOT EXISTS idx_questions_exam_id ON questions(exam_id);

-- ─── Exam Submissions ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS exam_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID REFERENCES exams(id),
    user_id UUID REFERENCES users(id),
    answers JSONB DEFAULT '{}'::jsonb,
    total_correct INTEGER DEFAULT 0,
    total_questions INTEGER DEFAULT 0,
    score DECIMAL(5,2) DEFAULT 0,
    time_spent INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted')),
    submitted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(exam_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_submissions_user_id ON exam_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_exam_id ON exam_submissions(exam_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON exam_submissions(status);

-- ─── Answers ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID REFERENCES exam_submissions(id) ON DELETE CASCADE,
    question_id UUID REFERENCES questions(id),
    user_answer VARCHAR(5),
    is_correct BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(submission_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_answers_submission_id ON answers(submission_id);

-- ─── Classrooms ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS classrooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    created_by UUID REFERENCES users(id),
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_classrooms_created_by ON classrooms(created_by);

-- ─── Classroom Members (Students in Classrooms) ──────────────

CREATE TABLE IF NOT EXISTS classroom_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    classroom_id UUID REFERENCES classrooms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(classroom_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_classroom_members_classroom ON classroom_members(classroom_id);
CREATE INDEX IF NOT EXISTS idx_classroom_members_user ON classroom_members(user_id);

-- ─── Default admin user (password: Admin@1234) ───────────────
-- Change this password immediately after first login!

INSERT INTO users (username, email, first_name, last_name, password_hash, role)
VALUES (
    'admin',
    'admin@chinesemath.local',
    'Admin',
    'User',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewfGz3O8oamxVGha', -- Admin@1234
    'admin'
)
ON CONFLICT (username) DO NOTHING;
