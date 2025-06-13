'use server';

/**
 * Real-time flow to send an overdue task notification using Resend and Genkit AI.
 */

import { sendOverdueNotificationEmail } from '@/lib/email';
import { NotifyOverdueTaskInput, NotifyOverdueTaskOutput } from './notify-overdue-task-types';

// Flow logic
export async function notifyOverdueTask(
  input: NotifyOverdueTaskInput
): Promise<NotifyOverdueTaskOutput> {
  // Send real-time email using Resend
  await sendOverdueNotificationEmail(input);

  // Generate simulation message
  const simulationMessage = `SIMULATED EMAIL: Task '${input.taskTitle}' (ID: ${input.taskId}) is overdue (Deadline: ${input.deadline}). Notification sent to Manager (${input.managerEmail}) and CEO (${input.ceoEmail}).`;

  return {
    simulationMessage,
  };
}