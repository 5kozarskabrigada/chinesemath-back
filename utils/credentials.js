/**
 * Credential generation utilities for auto-creating student accounts
 */

/**
 * Generate a username from first and last name
 * Format: name.surname1234
 */
export function generateUsername(firstName = "", lastName = "") {
  const normalize = (value) =>
    String(value)
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 20);

  const first = normalize(firstName);
  const last = normalize(lastName);
  const base = [first, last].filter(Boolean).join(".") || "student";
  const suffix = Math.floor(1000 + Math.random() * 9000);

  return `${base}${suffix}`;
}

/**
 * Generate a secure random password
 * Format: At least 12 characters with uppercase, lowercase, numbers, and special characters
 * Example: Sk9@mP2$xQ1w
 */
export function generatePassword() {
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const special = "@#$%*&!";

  let password = "";

  // Ensure at least one of each type
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];

  // Fill the rest randomly (12 chars total)
  const allChars = uppercase + lowercase + numbers + special;
  for (let i = password.length; i < 12; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle the password
  return password.split("").sort(() => Math.random() - 0.5).join("");
}
