
'use server';
/**
 * @fileOverview An AI agent that generates a complete step-by-step plan for building a regex.
 *
 * - generateGuidedPlan - Generates a full sequence of steps.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { GuidedRegexInputSchema, GuidedRegexOutputSchema, type GuidedRegexInput, type GuidedRegexOutput } from './schemas';
import { processAiBlocks } from '@/components/regex-vision/utils';

export async function generateGuidedPlan(input: GuidedRegexInput): Promise<GuidedRegexOutput> {
  try {
    const {output} = await planPrompt(input);
    if (!output || !output.steps || output.steps.length === 0) {
        throw new Error("AI failed to generate a valid plan.");
    }
    // Sanitize all blocks in the plan
    const sanitizedSteps = output.steps.map(step => ({
        ...step,
        block: processAiBlocks([step.block])[0]
    })).filter(step => step.block); // Filter out any steps that became invalid after processing

    if (sanitizedSteps.length === 0) {
         throw new Error("AI generated an invalid block structure for all steps.");
    }
    
    return { steps: sanitizedSteps };
  } catch (error) {
    console.error("Error in generateGuidedPlan:", error);
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    if (message.includes("does not match the output schema")) {
        throw new Error("AI сгенерировал несовместимый ответ. Пожалуйста, попробуйте переформулировать запрос.");
    }
    throw new Error(`Произошла ошибка при генерации плана. AI сервис может быть временно недоступен. (${message})`);
  }
}

const planPrompt = ai.definePrompt({
  name: 'generateGuidedPlanPrompt',
  input: {schema: GuidedRegexInputSchema},
  output: {schema: GuidedRegexOutputSchema},
  prompt: `You are a world-class regular expression expert who teaches users how to build regex by creating a complete, step-by-step plan.

Your task is to take a user's query and an optional example text, and generate a **full, ordered list of atomic steps** to construct the required regular expression.

**User's Goal:**
"{{{query}}}"

{{#if exampleTestText}}
**Example Text for Context:**
\`\`\`
{{{exampleTestText}}}
\`\`\`
{{/if}}

**Instructions:**
1.  **Analyze the Goal:** Carefully read the user's query and any example text to understand the full requirement.
2.  **Decompose into Atomic Steps:** Break down the logic into the smallest possible, sequential steps. Each step must correspond to **one single, simple block**. Do not combine concepts.
3.  **Create a Plan:** Generate an array of 'steps'. Each object in the array must contain:
    *   'explanation': A short, clear explanation (in Russian) of what this single block does and why it's the next logical step.
    *   'block': A single, valid regex block object for this step.
4.  **Logical Order:** The steps must be in the correct order to build the regex from left to right.
5.  **Handle Optionality:** If a component is optional, your plan must include two steps: first, the block for the component itself, and second, a 'QUANTIFIER' block with type '?' to make it optional.
6.  **Handle Repetition:** Do not add the same block type twice in a row (e.g., '\\d' then '\\d'). Instead, use a 'QUANTIFIER' block (e.g., '+', '*', or '{n,m}').
7.  **Use Correct Block Types:** For matching one of several characters (e.g., "a" or "b"), use a 'CHARACTER_CLASS'. For matching one of several words (e.g., "cat" or "dog"), use a 'GROUP' containing an 'ALTERNATION'.

**Example Scenario:**
- **Goal:** "Find a 3-digit number, optionally preceded by a dollar sign."
- **Correct Plan Output (the 'steps' array):**
  \`\`\`json
  [
    {
      "explanation": "Сначала создадим необязательный символ доллара. Для этого сначала добавляем сам символ.",
      "block": { "type": "LITERAL", "settings": { "text": "$" } }
    },
    {
      "explanation": "Теперь делаем знак доллара необязательным, добавляя квантификатор 'ноль или один'.",
      "block": { "type": "QUANTIFIER", "settings": { "type": "?", "mode": "greedy" } }
    },
    {
      "explanation": "Далее, добавим требование найти одну цифру.",
      "block": { "type": "CHARACTER_CLASS", "settings": { "pattern": "\\\\d", "negated": false } }
    },
    {
      "explanation": "И укажем, что цифра должна повторяться ровно 3 раза.",
      "block": { "type": "QUANTIFIER", "settings": { "type": "{n}", "min": 3, "mode": "greedy" } }
    }
  ]
  \`\`\`

Generate the JSON for the full plan, adhering strictly to the guidelines. The output must be a single JSON object with a "steps" array.
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
