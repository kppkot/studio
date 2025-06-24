
'use server';
/**
 * @fileOverview An AI agent that generates a step-by-step plan for building a regex.
 *
 * - generateGuidedRegexPlan - A function that generates the plan.
 */

import {ai} from '@/ai/genkit';
import {
  type GuidedRegexInput,
  GuidedRegexInputSchema,
  type GuidedRegexOutput,
  GuidedRegexOutputSchema,
} from './schemas';
import { processAiBlocks } from '@/components/regex-vision/utils';


export async function generateGuidedRegexPlan(input: GuidedRegexInput): Promise<GuidedRegexOutput> {
  return guidedRegexFlow(input);
}

const prompt = ai.definePrompt({
  name: 'guidedRegexPrompt',
  input: {schema: GuidedRegexInputSchema},
  output: {schema: GuidedRegexOutputSchema},
  prompt: `You are a world-class regular expression expert who teaches users how to build regex step-by-step.
Your task is to take a user's query and break it down into a logical sequence of individual, atomic regex blocks.

For each step, you must provide:
1.  A single regex block object.
2.  A very short, clear explanation in Russian of what this block does and why it's the next logical step.

**CRITICAL RULES:**
-   **Atomic Steps:** Each step should correspond to ONE block. Do not combine things. For "find the word 'cat'", you should have THREE steps: one for \`\\b\`, one for \`cat\`, one for \`\\b\`.
-   **Clear Explanations:** The explanation should be simple enough for a beginner to understand.
-   **Correct Block Structure:** The 'block' object must be a valid JSON object matching the Block schema definition.

**Example Query:** "Найти 5-значный почтовый индекс"
**Correct Output:**
\`\`\`json
{
  "steps": [
    {
      "explanation": "Сначала найдем одну любую цифру.",
      "block": {
        "type": "CHARACTER_CLASS",
        "settings": { "pattern": "\\\\d", "negated": false }
      }
    },
    {
      "explanation": "Теперь укажем, что цифра должна повторяться ровно 5 раз.",
      "block": {
        "type": "QUANTIFIER",
        "settings": { "type": "{n}", "min": 5, "mode": "greedy" }
      }
    }
  ]
}
\`\`\`

User Query: {{{query}}}

Produce the JSON output with the 'steps' array.
`,
   config: {
    safetySettings: [
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_LOW_AND_ABOVE'},
    ],
  },
});


const guidedRegexFlow = ai.defineFlow(
  {
    name: 'guidedRegexFlow',
    inputSchema: GuidedRegexInputSchema,
    outputSchema: GuidedRegexOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    if (!output || !output.steps || output.steps.length === 0) {
        return { steps: [] };
    }
    
    // Sanitize blocks before returning
    const sanitizedSteps = output.steps.map(step => ({
        ...step,
        block: processAiBlocks([step.block])[0] // processAiBlocks expects an array and returns an array
    })).filter(step => step.block); // Filter out any steps where block sanitization failed

    return { steps: sanitizedSteps };
  }
);
