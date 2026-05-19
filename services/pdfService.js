import PDFDocument from 'pdfkit';

/**
 * Generate PDF for exam submission
 */
export async function generateSubmissionPDF(submissionData, answersData) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks = [];

      // Collect PDF chunks
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const { submission, answers } = submissionData;
      const percentage = ((submission.score / submission.total_questions) * 100).toFixed(1);

      // Helper function for drawing boxes
      const drawBox = (x, y, width, height, fillColor, text, textColor = 'black') => {
        doc.rect(x, y, width, height).fillAndStroke(fillColor, '#000000');
        doc.fillColor(textColor).fontSize(10).text(text, x + 10, y + (height - 10) / 2, {
          width: width - 20,
          align: 'center',
        });
      };

      // === HEADER ===
      doc.fillColor('#dc2626')
        .fontSize(28)
        .font('Helvetica-Bold')
        .text('EXAM RESULTS REPORT', { align: 'center' });

      doc.moveDown(0.5);
      doc.fillColor('#666666').fontSize(12).font('Helvetica').text(submission.exam_title, { align: 'center' });
      
      doc.moveDown(1.5);
      doc.strokeColor('#e5e7eb').lineWidth(2).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(1);

      // === STUDENT INFORMATION ===
      doc.fillColor('#111827').fontSize(14).font('Helvetica-Bold').text('Student Information');
      doc.moveDown(0.5);

      const infoStartY = doc.y;
      doc.fontSize(11).font('Helvetica');
      doc.fillColor('#6b7280').text('Name:', 50, infoStartY);
      doc.fillColor('#111827').text(`${submission.first_name} ${submission.last_name}`, 150, infoStartY);
      
      doc.fillColor('#6b7280').text('Username:', 50, infoStartY + 20);
      doc.fillColor('#111827').text(submission.username, 150, infoStartY + 20);
      
      doc.fillColor('#6b7280').text('Submission Date:', 50, infoStartY + 40);
      doc.fillColor('#111827').text(new Date(submission.submitted_at).toLocaleString(), 150, infoStartY + 40);
      
      doc.fillColor('#6b7280').text('Time Spent:', 50, infoStartY + 60);
      const minutes = Math.floor(submission.time_spent / 60);
      const seconds = submission.time_spent % 60;
      doc.fillColor('#111827').text(`${minutes}m ${seconds}s`, 150, infoStartY + 60);

      doc.moveDown(4);

      // === SCORE SUMMARY ===
      doc.fillColor('#111827').fontSize(14).font('Helvetica-Bold').text('Score Summary');
      doc.moveDown(0.5);

      const summaryY = doc.y;
      const boxWidth = 150;
      const boxHeight = 80;
      const spacing = 20;

      // Score box
      doc.rect(50, summaryY, boxWidth, boxHeight).fillAndStroke('#dcfce7', '#86efac').lineWidth(2);
      doc.fillColor('#15803d').fontSize(32).font('Helvetica-Bold')
        .text(`${submission.score}/${submission.total_questions}`, 50, summaryY + 15, {
          width: boxWidth,
          align: 'center',
        });
      doc.fillColor('#166534').fontSize(11).font('Helvetica')
        .text('Correct Answers', 50, summaryY + 55, {
          width: boxWidth,
          align: 'center',
        });

      // Percentage box
      doc.rect(50 + boxWidth + spacing, summaryY, boxWidth, boxHeight).fillAndStroke('#dbeafe', '#93c5fd').lineWidth(2);
      doc.fillColor('#1e40af').fontSize(32).font('Helvetica-Bold')
        .text(`${percentage}%`, 50 + boxWidth + spacing, summaryY + 15, {
          width: boxWidth,
          align: 'center',
        });
      doc.fillColor('#1e3a8a').fontSize(11).font('Helvetica')
        .text('Accuracy', 50 + boxWidth + spacing, summaryY + 55, {
          width: boxWidth,
          align: 'center',
        });

      // Grade box (simple grading)
      const grade = percentage >= 90 ? 'A' : percentage >= 80 ? 'B' : percentage >= 70 ? 'C' : percentage >= 60 ? 'D' : 'F';
      const gradeColor = percentage >= 70 ? '#fef3c7' : '#fee2e2';
      const gradeBorderColor = percentage >= 70 ? '#fbbf24' : '#f87171';
      const gradeTextColor = percentage >= 70 ? '#92400e' : '#991b1b';
      
      doc.rect(50 + (boxWidth + spacing) * 2, summaryY, boxWidth, boxHeight).fillAndStroke(gradeColor, gradeBorderColor).lineWidth(2);
      doc.fillColor(gradeTextColor).fontSize(32).font('Helvetica-Bold')
        .text(grade, 50 + (boxWidth + spacing) * 2, summaryY + 15, {
          width: boxWidth,
          align: 'center',
        });
      doc.fillColor(gradeTextColor).fontSize(11).font('Helvetica')
        .text('Grade', 50 + (boxWidth + spacing) * 2, summaryY + 55, {
          width: boxWidth,
          align: 'center',
        });

      doc.y = summaryY + boxHeight + 30;

      // === DETAILED ANSWERS ===
      doc.fillColor('#111827').fontSize(14).font('Helvetica-Bold').text('Detailed Question Breakdown');
      doc.moveDown(0.5);

      answers.forEach((answer, index) => {
        // Check if we need a new page
        if (doc.y > 700) {
          doc.addPage();
          doc.y = 50;
        }

        const questionY = doc.y;
        const isCorrect = answer.is_correct;

        // Question number with status
        doc.fillColor(isCorrect ? '#15803d' : '#991b1b')
          .fontSize(12)
          .font('Helvetica-Bold')
          .text(`Question ${answer.question_number}`, 50, questionY);
        
        doc.fillColor(isCorrect ? '#15803d' : '#991b1b')
          .fontSize(10)
          .font('Helvetica')
          .text(isCorrect ? '✓ Correct' : '✗ Incorrect', 500, questionY, { align: 'right' });

        doc.moveDown(0.3);

        // Question text
        doc.fillColor('#374151').fontSize(10).font('Helvetica')
          .text(answer.question_text, 50, doc.y, { width: 495, align: 'left' });

        doc.moveDown(0.5);

        // Options (if available)
        if (answer.options) {
          const options = JSON.parse(answer.options);
          options.forEach((option, optIndex) => {
            const letter = String.fromCharCode(65 + optIndex);
            const isUserAnswer = answer.user_answer === letter;
            const isCorrectAnswer = answer.correct_answer === letter;
            
            let prefix = `${letter}. `;
            if (isUserAnswer && isCorrectAnswer) {
              prefix = `${letter}. ✓ `;
              doc.fillColor('#15803d').font('Helvetica-Bold');
            } else if (isUserAnswer) {
              prefix = `${letter}. ✗ `;
              doc.fillColor('#991b1b').font('Helvetica-Bold');
            } else if (isCorrectAnswer) {
              prefix = `${letter}. ✓ `;
              doc.fillColor('#15803d').font('Helvetica');
            } else {
              doc.fillColor('#6b7280').font('Helvetica');
            }
            
            doc.fontSize(9).text(prefix + option, 70, doc.y, { width: 475 });
            doc.moveDown(0.3);
          });
        } else {
          // Free text answer
          doc.fillColor('#6b7280').fontSize(9).font('Helvetica-Oblique')
            .text(`Your answer: ${answer.user_answer || '(No answer)'}`, 70, doc.y, { width: 475 });
          doc.moveDown(0.3);
          doc.fillColor('#15803d').fontSize(9).font('Helvetica')
            .text(`Correct answer: ${answer.correct_answer}`, 70, doc.y, { width: 475 });
        }

        // Explanation (if available)
        if (answer.explanation) {
          doc.moveDown(0.3);
          doc.fillColor('#3b82f6').fontSize(9).font('Helvetica-Bold')
            .text('Explanation:', 70, doc.y);
          doc.fillColor('#374151').fontSize(9).font('Helvetica')
            .text(answer.explanation, 70, doc.y + 12, { width: 475 });
        }

        doc.moveDown(1);
        
        // Separator line
        doc.strokeColor('#e5e7eb').lineWidth(0.5).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(1);
      });

      // === FOOTER ===
      const pageCount = doc.bufferedPageRange().count;
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        doc.fontSize(8).fillColor('#9ca3af').text(
          `ExamRoom Education • Page ${i + 1} of ${pageCount} • Generated: ${new Date().toLocaleDateString()}`,
          50,
          doc.page.height - 50,
          { align: 'center', width: 495 }
        );
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

export default {
  generateSubmissionPDF,
};
