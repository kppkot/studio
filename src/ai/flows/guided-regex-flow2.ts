'use server';
/**
 * @fileOverview An AI agent that generates a regex step-by-step, one step at a time.
 * THIS IS AN EXPERIMENTAL VERSION WITH A SIMPLIFIED PROMPT.
 *
 * - generateNextGuidedStep - Generates the next single step in a sequence.
 * - regenerateGuidedStep - Regenerates a specific step in a sequence.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import {
  GuidedRegexStepSchema,
  type GuidedRegexStep,
  NextGuidedStepInputSchema,
  RegenerateGuidedStepInputSchema,
} from './schemas';
import { processAiBlocks } from '@/components/regex-vision/utils';

// --- Flow for generating the NEXT step ---

export type NextGuidedStepInput = z.infer<typeof NextGuidedStepInputSchema>;

export async function generateNextGuidedStep(input: NextGuidedStepInput): Promise<GuidedRegexStep> {
  try {
    const {output} = await nextStepPrompt(input);
    if (!output || !output.block) {
        throw new Error("AI failed to generate a valid next step.");
    }
    // Sanitize the block before returning
    const sanitizedStep = {
        ...output,
        block: processAiBlocks([output.block])[0]
    };
    if (!sanitizedStep.block) {
        throw new Error("AI generated an invalid block structure.");
    }
    return sanitizedStep;
  } catch (error) {
    console.error("Error in generateNextGuidedStep:", error);
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    if (message.includes("does not match the output schema")) {
        throw new Error("AI сгенерировал несовместимый ответ. Пожалуйста, попробуйте переформулировать запрос или перегенерировать шаг.");
    }
    throw new Error(`Произошла ошибка при генерации следующего шага. AI сервис может быть временно недоступен. (${message})`);
  }
}

const nextStepPrompt = ai.definePrompt({
  name: 'nextGuidedStepPromptSimple',
  input: {schema: NextGuidedStepInputSchema},
  output: {schema: GuidedRegexStepSchema},
  prompt: `You are a regex expert. Your task is to generate the single next atomic step to build a regular expression.
You will be given the user's goal, example text, and the steps already taken.
Your response must be a single JSON object representing the next logical step. Your explanation must be in Russian.

**User's Goal:**
"{{{query}}}"

**Example Text:**
\`\`\`
{{{exampleTestText}}}
\`\`\`

**Existing Steps:**
{{#if existingSteps.length}}
  This is the sequence of what has been built so far:
  {{#each existingSteps}}
- (Step {{@index}}) {{this.explanation}} (Resulting Block: {{this.block.type}})
  {{/each}}
{{else}}
  This is the very first step. Start from the beginning of the pattern.
{{/if}}

Generate the next single step.
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


// --- Flow for REGENERATING a step ---

export type RegenerateGuidedStepInput = z.infer<typeof RegenerateGuidedStepInputSchema>;

export async function regenerateGuidedStep(input: RegenerateGuidedStepInput): Promise<GuidedRegexStep> {
  try {
    const {output} = await regenerateStepPrompt(input);
    if (!output || !output.block) {
        throw new Error("AI failed to regenerate a valid step.");
    }
    const sanitizedStep = {
        ...output,
        block: processAiBlocks([output.block])[0]
    };
    if (!sanitizedStep.block) {
        throw new Error("AI regenerated an invalid block structure.");
    }
    return sanitizedStep;
  } catch (error) {
    console.error("Error in regenerateGuidedStep:", error);
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    if (message.includes("does not match the output schema")) {
        throw new Error("AI сгенерировал несовместимый ответ для перегенерации. Пожалуйста, попробуйте еще раз.");
    }
    throw new Error(`Произошла ошибка при перегенерации шага. AI сервис может быть временно недоступен. (${message})`);
  }
}

const regenerateStepPrompt = ai.definePrompt({
  name: 'regenerateGuidedStepPromptSimple',
  input: {schema: RegenerateGuidedStepInputSchema},
  output: {schema: GuidedRegexStepSchema},
  prompt: `You are a regex expert. A user rejected the last step you provided.
Provide a different, better alternative for that single step.
Your response must be a single JSON object representing the alternative step. Your explanation must be in Russian.

**User's Goal:**
"{{{query}}}"

**Example Text:**
\`\`\`
{{{exampleTestText}}}
\`\`\`

**Steps created before the problematic one:**
{{#if stepsSoFar.length}}
  {{#each stepsSoFar}}
- (Step {{@index}}) {{this.explanation}} (Block: {{this.block.type}})
  {{/each}}
{{else}}
  This was the very first step.
{{/if}}

**The user REJECTED this step:**
- Explanation: "{{stepToRegenerate.explanation}}"
- Block Type: {{stepToRegenerate.block.type}}

Generate a new alternative single step.
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
