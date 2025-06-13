'use server';
/**
 * @fileOverview AI flow to parse structured task details from a natural language string.
 *
 * This file defines a Genkit AI flow that takes a user's textual description of a task
 * and transforms it into a structured JSON object. It is designed to extract key details
 * such as a title, description, deadline, priority, and tags.
 *
 * @see parseTaskFromText - The primary exportable function for this flow.
 * @see ParseTaskFromTextInput - The input type for the flow.
 * @see ParseTaskFromTextOutput - The return type for the flow.
 */

import { ai } from '@/ai/genkit';
import { gemini15Flash } from '@genkit-ai/googleai'; // Explicitly import a model for better control
import { z } from 'zod';

// Assuming you have a shared type definition like this somewhere in your project
// e.g., in a file like '@/types/index.ts'
export type TaskPriority = 'Low' | 'Medium' | 'High';


// The input remains the same: a single string from the user.
const ParseTaskFromTextInputSchema = z.object({
  naturalLanguageInput: z
    .string()
    .min(5, 'Please provide a more detailed task description.')
    .describe('The natural language input from a user describing a task.'),
});
export type ParseTaskFromTextInput = z.infer<typeof ParseTaskFromTextInputSchema>;

/**
 * ENHANCED OUTPUT SCHEMA:
 * - `deadlineNaturalLanguage` is added to capture the original text for the deadline.
 * This allows for deterministic parsing on the server using a date library.
 * - `tags` array is added to capture project names or labels (e.g., #website).
 */
const ParseTaskFromTextOutputSchema = z.object({
  title: z
    .string()
    .optional()
    .describe('The extracted or generated concise title for the task.'),
  description: z
    .string()
    .optional()
    .describe(
      'A more detailed description of the task, if discernible from the input.'
    ),
  deadline: z
    .string()
    .optional()
    .describe(
      'The suggested deadline in ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ), if mentioned or strongly implied.'
    ),
  deadlineNaturalLanguage: z
    .string()
    .optional()
    .describe(
      'The raw, extracted date or time phrase (e.g., "next Monday", "in 2 hours"). Useful for server-side parsing.'
    ),
  priority: z
    .enum(['Low', 'Medium', 'High'] as [TaskPriority, ...TaskPriority[]])
    .optional()
    .describe('The suggested priority if mentioned or implied by urgency.'),
  tags: z
    .array(z.string())
    .optional()
    .describe(
      'A list of tags or labels extracted from the input, often denoted with a #.'
    ),
  reasoning: z
    .string()
    .optional()
    .describe(
      'Brief reasoning if the AI had to make significant assumptions (e.g., calculating a date).'
    ),
});
export type ParseTaskFromTextOutput = z.infer<typeof ParseTaskFromTextOutputSchema>;

/**
 * Parses a natural language string into a structured task object.
 *
 * @param {ParseTaskFromTextInput} input The object containing the natural language string.
 * @returns {Promise<ParseTaskFromTextOutput>} A promise that resolves to the structured task data.
 * @example
 * const task = await parseTaskFromText({
 * naturalLanguageInput: "Remind me to deploy the #website update next Friday, it's a high priority."
 * });
 * console.log(task);
 * // Expected output (assuming today is around June 13, 2025):
 * // {
 * //   title: "Deploy website update",
 * //   description: "Deploy the website update.",
 * //   deadline: "2025-06-20T23:59:59.000Z",
 * //   deadlineNaturalLanguage: "next Friday",
 * //   priority: "High",
 * //   tags: ["website"],
 * //   reasoning: "Assumed 'next Friday' refers to the upcoming Friday relative to the current date. Set default time to end-of-day."
 * // }
 */
export async function parseTaskFromText(
  input: ParseTaskFromTextInput
): Promise<ParseTaskFromTextOutput> {
  // The Genkit flow handles the core logic.
  // You could add pre-processing or post-processing steps here if needed.
  // For example, using a library like `date-fns` to parse the `deadlineNaturalLanguage`
  // field from the output would be more robust than relying solely on the AI's date calculation.
  return parseTaskFromTextFlow(input);
}

const parseTaskPrompt = ai.definePrompt({
  name: 'parseTaskFromTextPrompt',
  input: { schema: ParseTaskFromTextInputSchema },
  output: { schema: ParseTaskFromTextOutputSchema },

  // ENHANCED PROMPT:
  // - Added a few-shot example to improve reliability.
  // - Instructions updated for the new `tags` and `deadlineNaturalLanguage` fields.
  // - Explicitly specifying the model and a low temperature for more deterministic results.
  model: gemini15Flash,
  config: {
    temperature: 0.1, // Low temperature for parsing tasks makes the output more predictable.
  },
  prompt: `You are an intelligent assistant that helps parse natural language into structured task information. Your goal is to extract key details from the user's input.
Today's date is ${new Date().toISOString()}. Use this to calculate relative dates.

Extract the following information:
- title: A concise title for the task. If not explicitly stated, create a short summary.
- description: A more detailed description. If the input is short, this can be the same as the title or a slightly expanded version.
- deadlineNaturalLanguage: Extract the verbatim phrase related to the deadline (e.g., "tomorrow", "in 3 days", "next Monday").
- deadline: If a date or time is mentioned, convert it to an ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ). Use the current date for calculations. If no time is specified, default to the end of that day (23:59:59).
- priority: Suggest 'Low', 'Medium', or 'High' if mentioned or implied by urgency.
- tags: Extract any tags or project names, which are often prefixed with a '#'.
- reasoning: If you make significant assumptions (e.g., calculating a date), briefly state them.

If the input is too vague to be a task, return a title like "Vague task input" and a description asking for more details. Focus on extracting information and do not invent details.

Example Input:
"I need to finish the Q2 report for the #finance project by next Wednesday. It's very urgent."

Example Output:
{
  "title": "Finish Q2 report for finance project",
  "description": "Finish the Q2 report for the #finance project by next Wednesday.",
  "deadlineNaturalLanguage": "next Wednesday",
  "deadline": "2025-06-18T23:59:59.000Z",
  "priority": "High",
  "tags": ["finance"],
  "reasoning": "Inferred 'High' priority from the phrase 'very urgent'. Calculated 'next Wednesday' based on the current date of June 13, 2025. Defaulted time to the end of the day."
}

---
User input: {{{naturalLanguageInput}}}
`,
});

const parseTaskFromTextFlow = ai.defineFlow(
  {
    name: 'parseTaskFromTextFlow',
    inputSchema: ParseTaskFromTextInputSchema,
    outputSchema: ParseTaskFromTextOutputSchema,
  },
  /**
   * The core logic for the flow.
   * It calls the AI prompt and handles the response.
   */
  async (input): Promise<ParseTaskFromTextOutput> => {
    const { output } = await parseTaskPrompt(input);

    // FIX: The output from a prompt can be null if the model fails to respond.
    // We must handle this case to satisfy the flow's output schema, which does not allow null.
    // Throwing an error is the cleanest way to signal a failure.
    if (!output) {
      throw new Error('The AI model failed to produce a valid output for the task.');
    }

    // Now TypeScript knows that `output` is not null and matches ParseTaskFromTextOutput.
    return output;
  }
);