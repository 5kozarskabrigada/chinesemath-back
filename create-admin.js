// Run once to create the first admin user:
// node create-admin.js

import dotenv from "dotenv";
dotenv.config();
import bcrypt from "bcryptjs";
import { pool } from "./db.js";

const username = "admin";
const email = "admin@chinesemath.local";
const password = "Admin@1234"; // Change after first login!
const firstName = "Admin";
const lastName = "User";

const hash = await bcrypt.hash(password, 12);
await pool.query(
  `INSERT INTO users (username, email, first_name, last_name, password_hash, role)
   VALUES ($1, $2, $3, $4, $5, 'admin')
   ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
  [username, email, firstName, lastName, hash]
);
console.log(`Admin user created: ${username} / ${password}`);
await pool.end();
