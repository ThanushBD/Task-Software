'use server';

/**
 * @fileOverview AI flow to suggest an optimal deadline for a task based on its details.
 *
 * - optimizeTaskDeadline - A function that suggests an optimal deadline for a given task description.
 * - OptimizeTaskDeadlineInput - The input type for the optimizeTaskDeadline function.
 * - OptimizeTaskDeadlineOutput - The return type for the optimizeTaskDeadline function.
 */

import { z } from 'zod';

// Input schema for the task description
const OptimizeTaskDeadlineInputSchema = z.object({
  taskDescription: z
    .string()
    .min(10, 'Please provide a more detailed task description.')
    .describe('Detailed description of the task for which a deadline is needed.'),
});

export type OptimizeTaskDeadlineInput = z.infer<typeof OptimizeTaskDeadlineInputSchema>;

// Output schema including suggested deadline and reasoning
const OptimizeTaskDeadlineOutputSchema = z.object({
  suggestedDeadline: z
    .string()
    .describe('The suggested deadline for the task in ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ).'),
  reasoning: z
    .string()
    .describe('The reasoning behind the suggested deadline, considering the task description.'),
});

export type OptimizeTaskDeadlineOutput = z.infer<typeof OptimizeTaskDeadlineOutputSchema>;

// Export a callable function
export async function optimizeTaskDeadline(
  input: OptimizeTaskDeadlineInput
): Promise<OptimizeTaskDeadlineOutput> {
  // Simple deadline calculation based on description length
  const descriptionLength = input.taskDescription.length;
  const daysToAdd = Math.min(Math.max(Math.ceil(descriptionLength / 100), 1), 14); // 1-14 days
  const suggestedDeadline = new Date(Date.now() + daysToAdd * 24 * 60 * 60 * 1000).toISOString();

  return {
    suggestedDeadline,
    reasoning: `Based on the task description length (${descriptionLength} characters), a deadline of ${daysToAdd} days is suggested to ensure adequate time for completion.`
  };
}
