
'use server';
/**
 * @fileOverview An AI agent that generates a regex step-by-step, one step at a time.
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
}

const nextStepPrompt = ai.definePrompt({
  name: 'nextGuidedStepPrompt',
  input: {schema: NextGuidedStepInputSchema},
  output: {schema: GuidedRegexStepSchema},
  prompt: `You are a world-class regular expression expert who teaches users how to build regex, one atomic step at a time. Your responses must follow the "canons of regex construction" - one symbol, one rule at a time.

Your task is to take a user's query, an example text, and the steps already created, and determine the **single next logical step**.

**User's Ultimate Goal:**
"{{{query}}}"

**Example Text for Context:**
\`\`\`
{{{exampleTestText}}}
\`\`\`

**Steps Already Created:**
{{#if existingSteps.length}}
  This is the sequence of what has been built so far:
  {{#each existingSteps}}
- Step {{add @index 1}}: {{this.explanation}} (Resulting Block: {{this.block.type}})
  {{/each}}
{{else}}
  This is the very first step. Start from the beginning.
{{/if}}

Based on all the information above, determine the **next single, atomic step**.

**CRITICAL CANONS OF REGEX CONSTRUCTION (YOU MUST OBEY THESE):**
1.  **ONE ATOMIC STEP ONLY:** Your entire output must be a JSON object for a single step. Do NOT create a list or an array of steps.
2.  **ATOMICITY IS LAW:** Each step must correspond to **ONE** single, simple block. Do not combine concepts. For example, instead of a single block for \`[a-z]+\`, you must first generate the block for \`[a-z]\`, and in the *next* step, generate the \`+\` quantifier. A word boundary \`\\b\` is a separate step. A literal \`cat\` is a separate step.
3.  **EXPLANATION:** Provide a very short, clear explanation in Russian of what this block does and why it's the next logical step in building the regex.
4.  **CORRECT BLOCK STRUCTURE:** The 'block' object must be a valid JSON object matching the Block schema.

Generate the JSON for the next single step, adhering strictly to the canons.
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
}

const regenerateStepPrompt = ai.definePrompt({
  name: 'regenerateGuidedStepPrompt',
  input: {schema: RegenerateGuidedStepInputSchema},
  output: {schema: GuidedRegexStepSchema},
  prompt: `You are a world-class regular expression expert who teaches users how to build regex, one atomic step at a time, following strict "canons of construction".

A user is building a regex and was not satisfied with the last step you provided. Your task is to provide a different, better alternative for that step.

**User's Ultimate Goal:**
"{{{query}}}"

**Example Text for Context:**
\`\`\`
{{{exampleTestText}}}
\`\`\`

**Steps created before the problematic one:**
{{#if stepsSoFar.length}}
  {{#each stepsSoFar}}
- Step {{add @index 1}}: {{this.explanation}} (Block: {{this.block.type}})
  {{/each}}
{{else}}
  This was the very first step.
{{/if}}

**The user REJECTED this step:**
- Explanation: "{{stepToRegenerate.explanation}}"
- Block Type: {{stepToRegenerate.block.type}}

Based on the goal and the previous steps, provide a **new, alternative, single, atomic step** to replace the rejected one.

**CRITICAL CANONS OF REGEX CONSTRUCTION (YOU MUST OBEY THESE):**
1.  **DIFFERENT & BETTER:** The new step should be a different approach or a more correct version of the rejected one.
2.  **ONE ATOMIC STEP ONLY:** Your entire output must be a JSON object for a single step. Do NOT create a list.
3.  **ATOMICITY IS LAW:** The step must correspond to **ONE** simple block (e.g., \`[a-z]\`, \`+\`, \`\\b\`).
4.  **EXPLANATION:** Provide a very short, clear explanation in Russian for the new step.
5.  **CORRECT BLOCK STRUCTURE:** The 'block' object must be a valid JSON object.

Generate the JSON for the new alternative single step, adhering strictly to the canons.
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
