
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
    throw new Error("Произошла ошибка при генерации следующего шага. AI сервис может быть временно недоступен.");
  }
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
2.  **LEFT-TO-RIGHT CONSTRUCTION:** Your primary strategy should be to build the expression sequentially, matching the user's textual goal from left to right. For "find an email address," start with the username, then '@', then the domain. Do not start in the middle.
3.  **CONTEXT IS KING:** Look at the \`existingSteps\`. If the last step created an empty container (like \`GROUP\` or \`ALTERNATION\`), your next step **MUST** be to add the first child for that container. Do not add new top-level blocks when a container is waiting to be filled.
4.  **HOW TO BUILD AND EXPLAIN \`(A or B or C)\`:** To match one of several options, you MUST follow this **exact** sequence over multiple steps. Your explanations must also follow a clear logic:
    *   Step N: Create the \`GROUP\` block. **Explanation:** Explain this as creating a 'container' for the options. DO NOT mention 'OR' in this step.
    *   Step N+1: Create the \`ALTERNATION\` block (which will be placed inside the group). **Explanation:** Explain that this block *activates* the 'OR' logic for the items inside the container.
    *   Step N+2: Create a \`LITERAL\` block for option "A". **Explanation:** Explain that you are adding the first option to the list.
    *   Step N+3: Create a \`LITERAL\` block for option "B". **Explanation:** Explain that you are adding the next option.
    *   You are **STRICTLY FORBIDDEN** from creating a single \`LITERAL\` that contains multiple options like \`"A|B|C"\`.
5.  **SIMPLE BLOCKS ONLY:** Your generated 'block' object MUST be one of the simple, predefined types.
    *   **LITERAL:** For a short, contiguous string of plain text characters (e.g., \`@\`, \`http://\`, \`PO-\`). If the user wants to match a specific word or prefix like "PO", you **MUST** create a single \`LITERAL\` block for the entire string "PO". **DO NOT** break it down into separate atomic blocks for "P" and then "O". That is incorrect and inefficient. Only use multiple blocks for concepts that are logically separate. The \`|\` character is forbidden in a \`LITERAL\` block. Each \`LITERAL\` must contain non-empty text.
    *   **CHARACTER_CLASS:** For a set of characters. The \`pattern\` must be for **ONE ATOMIC ELEMENT**. Valid examples: \`a-z\`, \`A-Z\`, \`0-9\`, \`\\w\`, \`\\s\`, \`\\d\`. **YOU ARE FORBIDDEN** from creating complex patterns like \`[a-zA-Z0-9._%+-]\` in a single step.
    *   **QUANTIFIER:** For repetition (e.g., \`+\`, \`*\`, \`?\`). This block always follows another block.
    *   **ANCHOR:** For positions (e.g., \`^\`, \`$\`, \`\\b\`).
    *   **GROUP / ALTERNATION**: These are containers and should be generated empty. Their children are added in subsequent steps.
6.  **EXPLANATION (in Russian):** Provide a very short, clear explanation of what this single block does and why it's the next logical step.
7.  **FINAL STEP:** Your most important task is to correctly determine if the plan is complete. Set \`isFinalStep: true\` ONLY if this new step genuinely completes a regex that can fully solve the user's query.
    *   **DO NOT** mark the plan as final if the regex is obviously incomplete.
    *   **Bad example:** For a query like "find a purchase order number like PO nn-nnnnn", generating a single \`LITERAL\` for "PO" is NOT a final step. The full pattern is required.
    *   **Bad example:** For a query like "find an email address", a pattern of just \`\\w+@\` is NOT a final step.
    *   When in doubt, it is better to set \`isFinalStep: false\` and continue building. Only mark as final when the regex is robust and complete. Otherwise, omit the field or set it to \`false\`.


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
    throw new Error("Произошла ошибка при перегенерации шага. AI сервис может быть временно недоступен.");
  }
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
2.  **LEFT-TO-RIGHT CONSTRUCTION:** Your primary strategy should be to build the expression sequentially, matching the user's textual goal from left to right. A regenerated step should still logically follow the sequence built so far.
3.  **ONE ATOMIC STEP ONLY:** Your entire output must be a JSON object for a single step. The step must correspond to **ONE** simple block (e.g., \`[a-z]\`, \`+\`, \`\\b\`). Do not combine concepts.
4.  **HOW TO BUILD AND EXPLAIN \`(A or B or C)\`:** To match one of several options, you MUST follow this **exact** sequence over multiple steps. Your explanations must also follow a clear logic:
    *   Step N: Create the \`GROUP\` block. **Explanation:** Explain this as creating a 'container' for the options. DO NOT mention 'OR' in this step.
    *   Step N+1: Create the \`ALTERNATION\` block (which will be placed inside the group). **Explanation:** Explain that this block *activates* the 'OR' logic for the items inside the container.
    *   Step N+2: Create a \`LITERAL\` block for option "A". **Explanation:** Explain that you are adding the first option to the list.
    *   You are **STRICTLY FORBIDDEN** from creating a single \`LITERAL\` that contains multiple options like \`"A|B|C"\`. Each option is its own atomic step.
5.  **SIMPLE BLOCKS ONLY:** Your generated 'block' object MUST be one of the simple, predefined types.
    *   **LITERAL:** For a short, contiguous string of plain text characters (e.g., \`@\`, \`http://\`, \`PO-\`). If the user wants to match a specific word or prefix like "PO", you **MUST** create a single \`LITERAL\` block for the entire string "PO". **DO NOT** break it down into separate atomic blocks for "P" and then "O". That is incorrect and inefficient. Only use multiple blocks for concepts that are logically separate. The \`|\` character is forbidden in a \`LITERAL\` block. Each \`LITERAL\` must contain non-empty text.
    *   **CHARACTER_CLASS:** For a set of characters. The \`pattern\` must be for **ONE ATOMIC ELEMENT**. Valid examples: \`a-z\`, \`A-Z\`, \`0-9\`, \`\\w\`, \`\\s\`, \`\\d\`. **YOU ARE FORBIDDEN** from creating complex patterns like \`[a-zA-Z0-9._%+-]\` in a single step.
    *   **QUANTIFIER:** For repetition (e.g., \`+\`, \`*\`, \`?\`).
    *   **ANCHOR:** For positions (e.g., \`^\`, \`$\`, \`\\b\`).
    *   **GROUP / ALTERNATION**: These are containers and should be generated empty.
6.  **EXPLANATION (in Russian):** Provide a very short, clear explanation for the new step.
7.  **FINAL STEP:** Your most important task is to correctly determine if the plan is complete. Set \`isFinalStep: true\` ONLY if this new step genuinely completes a regex that can fully solve the user's query.
    *   **DO NOT** mark the plan as final if the regex is obviously incomplete.
    *   **Bad example:** For a query like "find a purchase order number like PO nn-nnnnn", generating a single \`LITERAL\` for "PO" is NOT a final step. The full pattern is required.
    *   When in doubt, it is better to set \`isFinalStep: false\` and continue building. Only mark as final when the regex is robust and complete.

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
