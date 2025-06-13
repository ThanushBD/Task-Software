
import { config } from 'dotenv';
config();

import '@/ai/flows/optimize-task-deadline.ts';
import '@/ai/flows/parse-task-from-text-flow.ts';
import '@/ai/flows/notify-overdue-task-flow.ts'; // Added new flow

