
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
  prompt: `You are a world-class regular expression expert who teaches users how to build regex, one atomic step at a time, following strict "canons of construction".

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
- (Step {{@index}}) {{this.explanation}} (Resulting Block: {{this.block.type}})
  {{/each}}
{{else}}
  This is the very first step. Start from the beginning.
{{/if}}

Based on all the information above, determine the **next single, atomic step**.

**CRITICAL CANONS OF REGEX CONSTRUCTION (YOU MUST OBEY THESE):**
1.  **ONE ATOMIC STEP ONLY:** Your entire output must be a JSON object for a single step. Each step must correspond to **ONE** single, simple block. Do not combine concepts. For example, to match \`[a-z]+\`, you must first generate a \`CHARACTER_CLASS\` block for \`a-z\`, and in the *next* step, generate the \`QUANTIFIER\` block for \`+\`.
2.  **CONTEXT IS KING:** Look at the \`existingSteps\`. If the last step created an empty container (like \`GROUP\` or \`ALTERNATION\`), your next step **MUST** be to add the first child for that container. Do not add new top-level blocks when a container is waiting to be filled.
3.  **HOW TO BUILD \`(A or B or C)\`:** To match one of several options, you MUST follow this **exact** sequence over multiple steps:
    *   Step N: Create the \`GROUP\` block.
    *   Step N+1: Create the \`ALTERNATION\` block (which will be placed inside the group).
    *   Step N+2: Create a \`LITERAL\` block for "A" (which will be placed inside the alternation).
    *   Step N+3: Create a \`LITERAL\` block for "B".
    *   Step N+4: Create a \`LITERAL\` block for "C".
    *   You are **STRICTLY FORBIDDEN** from creating a single \`LITERAL\` that contains multiple options like \`"A|B|C"\`. Each option is its own atomic step.
4.  **SIMPLE BLOCKS ONLY:** Your generated 'block' object MUST be one of the simple, predefined types.
    *   **LITERAL:** For a single character or short, simple string (e.g., \`@\`, \`.\`, \`cat\`). DO NOT generate the \`|\` character inside a \`LITERAL\` block. Each \`LITERAL\` must contain non-empty text.
    *   **CHARACTER_CLASS:** For a set of characters. The \`pattern\` must be for **ONE ATOMIC ELEMENT**. Valid examples: \`a-z\`, \`A-Z\`, \`0-9\`, \`\\w\`, \`\\s\`, \`\\d\`. **YOU ARE FORBIDDEN** from creating complex patterns like \`[a-zA-Z0-9._%+-]\` in a single step.
    *   **QUANTIFIER:** For repetition (e.g., \`+\`, \`*\`, \`?\`). This block always follows another block.
    *   **ANCHOR:** For positions (e.g., \`^\`, \`$\`, \`\\b\`).
    *   **GROUP / ALTERNATION**: These are containers and should be generated empty. Their children are added in subsequent steps.
5.  **EXPLANATION (in Russian):** Provide a very short, clear explanation of what this single block does and why it's the next logical step.
6.  **FINAL STEP:** If you determine that this new step **completes** the regex and fully satisfies the user's request, you MUST set the \`isFinalStep\` field to \`true\`. Do not mark simple, incomplete patterns as final. For a query like 'find an email address', a pattern of just \`\\w+@\` is NOT a final step. The expression must be reasonably complete. Otherwise, omit it or set it to \`false\`.

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
- (Step {{@index}}) {{this.explanation}} (Block: {{this.block.type}})
  {{/each}}
{{else}}
  This was the very first step.
{{/if}}

**The user REJECTED this step:**
- Explanation: "{{stepToRegenerate.explanation}}"
- Block Type: {{stepToRegenerate.block.type}}

Based on the goal and the previous steps, provide a **new, alternative, single, atomic step** to replace the rejected one.

**CRITICAL CANONS OF REGEX CONSTRUCTION (YOU MUST OBEY THESE):**
1.  **DIFFERENT & BETTER:** The new step must be a different approach or a more correct version of the rejected one.
2.  **ONE ATOMIC STEP ONLY:** Your entire output must be a JSON object for a single step. The step must correspond to **ONE** simple block (e.g., \`[a-z]\`, \`+\`, \`\\b\`). Do not combine concepts.
3.  **HOW TO BUILD \`(A or B or C)\`:** To match one of several options, you MUST follow this **exact** sequence over multiple steps:
    *   Step N: Create the \`GROUP\` block.
    *   Step N+1: Create the \`ALTERNATION\` block (which will be placed inside the group).
    *   Step N+2: Create a \`LITERAL\` block for "A" (which will be placed inside the alternation).
    *   You are **STRICTLY FORBIDDEN** from creating a single \`LITERAL\` that contains multiple options like \`"A|B|C"\`. Each option is its own atomic step.
4.  **SIMPLE BLOCKS ONLY:** Your generated 'block' object MUST be one of the simple, predefined types.
    *   **LITERAL:** For a single character or short, simple string (e.g., \`@\`, \`.\`, \`cat\`). DO NOT generate the \`|\` character inside a \`LITERAL\` block. Each \`LITERAL\` must contain non-empty text.
    *   **CHARACTER_CLASS:** For a set of characters. The \`pattern\` must be for **ONE ATOMIC ELEMENT**. Valid examples: \`a-z\`, \`A-Z\`, \`0-9\`, \`\\w\`, \`\\s\`, \`\\d\`. **YOU ARE FORBIDDEN** from creating complex patterns like \`[a-zA-Z0-9._%+-]\` in a single step.
    *   **QUANTIFIER:** For repetition (e.g., \`+\`, \`*\`, \`?\`).
    *   **ANCHOR:** For positions (e.g., \`^\`, \`$\`, \`\\b\`).
    *   **GROUP / ALTERNATION**: These are containers and should be generated empty.
5.  **EXPLANATION (in Russian):** Provide a very short, clear explanation for the new step.
6.  **FINAL STEP:** If this new, alternative step now **completes** the regex and fully satisfies the user's request, you MUST set the \`isFinalStep\` field to \`true\`. An expression is complete when it can reasonably match the user's full intent (e.g., a full email pattern, not just the start of one).

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
