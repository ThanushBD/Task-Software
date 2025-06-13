// lib/email.ts
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY); // Ensure this is set in .env

export async function sendOverdueNotificationEmail({
  taskId,
  taskTitle,
  deadline,
  managerEmail,
  ceoEmail,
}: {
  taskId: string;
  taskTitle: string;
  deadline: string;
  managerEmail: string;
  ceoEmail: string;
}) {
  const subject = `🚨 Overdue Task: ${taskTitle}`;
  const htmlContent = `
    <div style="font-family: Arial, sans-serif;">
      <h2 style="color: red;">⚠️ Overdue Task Alert</h2>
      <p><strong>Task ID:</strong> ${taskId}</p>
      <p><strong>Task Title:</strong> ${taskTitle}</p>
      <p><strong>Deadline:</strong> ${new Date(deadline).toLocaleString()}</p>
      <p>This task is now overdue. Please take action immediately.</p>
    </div>
  `;

  await resend.emails.send({
    from: 'Task Manager <onboarding@resend.dev>',
    to: [managerEmail, ceoEmail],
    subject,
    html: htmlContent,
  });
}
