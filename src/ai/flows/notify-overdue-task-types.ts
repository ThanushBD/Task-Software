import { z } from 'zod';

// SCHEMA DEFINITIONS
export const NotifyOverdueTaskInputSchema = z.object({
  taskId: z.string().describe('The ID of the overdue task.'),
  taskTitle: z.string().describe('The title of the overdue task.'),
  managerEmail: z.string().email().describe('The email address of the concerned manager.'),
  ceoEmail: z.string().email().describe('The email address of the CEO.'),
  deadline: z.string().describe('The deadline of the task (ISO 8601).'),
});

export const NotifyOverdueTaskOutputSchema = z.object({
  simulationMessage: z.string().describe('A message confirming the simulated notification.'),
});

export type NotifyOverdueTaskInput = z.infer<typeof NotifyOverdueTaskInputSchema>;
export type NotifyOverdueTaskOutput = z.infer<typeof NotifyOverdueTaskOutputSchema>; 