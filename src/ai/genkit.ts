import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: process.env.GOOGLE_AI_API_KEY,
      // region: 'us-central1', // Optional, if your project requires a region
    }),
  ],
  model: process.env.GENKIT_MODEL || 'googleai/gemini-2.0-flash',
});
