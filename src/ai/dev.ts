import { config } from 'dotenv';
config();

import '@/ai/flows/regex-suggestion.ts';
import '@/ai/flows/natural-language-regex-flow.ts';
import '@/ai/flows/analyze-regex-flow.ts';
import '@/ai/flows/fix-regex-flow.ts';
import '@/ai/flows/guided-regex-flow.ts';
