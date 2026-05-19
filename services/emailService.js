import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Create reusable transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.office365.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: process.env.EMAIL_SECURE === 'true', // false for 587, true for 465
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
  tls: {
    ciphers: 'SSLv3',
    rejectUnauthorized: false
  },
});

// Verify transporter configuration (disabled - will verify on first send)
// Microsoft 365 sometimes blocks verify() calls but allows actual sending
// transporter.verify((error, success) => {
//   if (error) {
//     console.error('Email service configuration error:', error);
//   } else {
//     console.log('✅ Email service ready to send messages');
//   }
// });

console.log('📧 Email service initialized (credentials will be verified on first send)');

/**
 * Send welcome email with login credentials
 */
export async function sendWelcomeEmail(email, { firstName, lastName, username, password }) {
  console.log(`[EmailService] Attempting to send welcome email to: ${email}`);
  
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to ExamRoom</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 40px 40px 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">
                Welcome to ExamRoom
              </h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0; font-size: 16px;">
                Your Online Exam Platform Account
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                Hello <strong>${firstName} ${lastName}</strong>,
              </p>
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
                Your student account has been created successfully. Below are your login credentials:
              </p>

              <!-- Credentials Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border: 2px solid #e5e7eb; border-radius: 8px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 24px;">
                    <table width="100%" cellpadding="8" cellspacing="0">
                      <tr>
                        <td style="color: #6b7280; font-size: 14px; font-weight: 600; padding: 8px 0;">
                          Username:
                        </td>
                        <td style="color: #111827; font-size: 16px; font-weight: 700; font-family: 'Courier New', monospace; padding: 8px 0;">
                          ${username}
                        </td>
                      </tr>
                      <tr>
                        <td style="color: #6b7280; font-size: 14px; font-weight: 600; padding: 8px 0;">
                          Password:
                        </td>
                        <td style="color: #111827; font-size: 16px; font-weight: 700; font-family: 'Courier New', monospace; padding: 8px 0;">
                          ${password}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Login Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 30px;">
                <tr>
                  <td align="center">
                    <a href="https://examroomedu.com/login" 
                       style="display: inline-block; background-color: #dc2626; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 2px 4px rgba(220, 38, 38, 0.3);">
                      Login to Your Account
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Instructions -->
              <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 16px 20px; border-radius: 4px; margin-bottom: 30px;">
                <p style="color: #991b1b; font-size: 14px; font-weight: 600; margin: 0 0 8px;">
                  🔐 Important Security Note:
                </p>
                <p style="color: #7f1d1d; font-size: 14px; line-height: 1.5; margin: 0;">
                  Please change your password after your first login for security purposes. Keep your credentials confidential.
                </p>
              </div>

              <!-- Getting Started -->
              <h3 style="color: #111827; font-size: 18px; font-weight: 600; margin: 0 0 16px;">
                Getting Started:
              </h3>
              <ol style="color: #374151; font-size: 15px; line-height: 1.8; margin: 0 0 30px; padding-left: 20px;">
                <li>Visit <a href="https://examroomedu.com" style="color: #dc2626; text-decoration: none;">examroomedu.com</a></li>
                <li>Log in using your credentials above</li>
                <li>Complete your profile setup</li>
                <li>Check your assigned exams</li>
              </ol>

              <!-- Support -->
              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0;">
                If you have any questions or need assistance, please contact your administrator or reach out to our support team.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px; margin: 0 0 8px;">
                <strong>ExamRoom</strong> - Professional Online Exam Platform
              </p>
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                © ${new Date().getFullYear()} ExamRoom Education. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const mailOptions = {
    from: `"ExamRoom Education" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: '🎓 Welcome to ExamRoom - Your Login Credentials',
    html: htmlContent,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Welcome email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Failed to send welcome email:', error);
    throw error;
  }
}

/**
 * Send exam submission PDF via email
 */
export async function sendSubmissionEmail(email, { firstName, lastName, examTitle, score, totalQuestions, pdfBuffer }) {
  console.log(`[EmailService] Attempting to send submission email to: ${email}`);
  
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Exam Results</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 40px 40px 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">
                📊 Exam Results
              </h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0; font-size: 16px;">
                ${examTitle}
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                Hello <strong>${firstName} ${lastName}</strong>,
              </p>
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
                Your exam submission has been processed. Please find your detailed results attached as a PDF.
              </p>

              <!-- Score Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 2px solid #86efac; border-radius: 8px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 24px; text-align: center;">
                    <div style="font-size: 48px; font-weight: 700; color: #15803d; margin-bottom: 8px;">
                      ${score}/${totalQuestions}
                    </div>
                    <div style="font-size: 16px; color: #166534; font-weight: 600;">
                      ${((score / totalQuestions) * 100).toFixed(1)}% Correct
                    </div>
                  </td>
                </tr>
              </table>

              <!-- PDF Attachment Note -->
              <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px 20px; border-radius: 4px; margin-bottom: 30px;">
                <p style="color: #1e40af; font-size: 14px; font-weight: 600; margin: 0 0 8px;">
                  📎 Attachment Included
                </p>
                <p style="color: #1e3a8a; font-size: 14px; line-height: 1.5; margin: 0;">
                  Your complete exam results with detailed question-by-question breakdown are attached to this email as a PDF document.
                </p>
              </div>

              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0;">
                If you have any questions about your results or need further clarification, please contact your instructor or administrator.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px; margin: 0 0 8px;">
                <strong>ExamRoom</strong> - Professional Online Exam Platform
              </p>
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                © ${new Date().getFullYear()} ExamRoom Education. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const mailOptions = {
    from: `"ExamRoom Education" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `📊 Your Exam Results: ${examTitle}`,
    html: htmlContent,
    attachments: [
      {
        filename: `exam-results-${examTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Submission email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Failed to send submission email:', error);
    throw error;
  }
}

export default {
  sendWelcomeEmail,
  sendSubmissionEmail,
};
