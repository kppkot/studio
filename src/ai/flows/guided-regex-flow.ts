
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
  prompt: `You are a world-class regular expression expert who teaches users how to build regex, one atomic step at a time.

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

**CRITICAL THINKING FRAMEWORK (YOU MUST OBEY THIS):**
Before you propose a step, you must mentally answer these questions:
1.  **What is the single, most logical next component to add?** (e.g., a separator, a block of digits).
2.  **Is this component PRESENT in ALL of the positive examples in the \`exampleTestText\`?**
    *   If **YES**, then your step is to add that component as a mandatory block.
    *   If **NO**, then this component is OPTIONAL. Your plan MUST account for this. The correct sequence of steps is: FIRST, add the block for the component. SECOND, add a \`QUANTIFIER\` block with type \`?\` to make it optional. Your current step should be the first part of that two-step plan. **In your explanation, you MUST state that the component is optional and will be handled in the next step.**
3.  **Will my proposed step break any existing matches?** A step that reduces the number of matches is only acceptable if it's part of the two-step "optional" plan described above. Otherwise, you have failed.
4.  **Am I repeating myself?** If I'm adding a \`\\d\` after another \`\\d\`, I must use a \`QUANTIFIER\` instead. This is a failure.

**Example Scenario:**
- **Goal:** Find purchase order numbers like \`PO-123\` and \`PO123\`.
- **Existing Step:** A \`LITERAL\` block for "PO". This matches both examples.
- **Your Thought Process:**
    1.  What's next? The \`-\` separator.
    2.  Is \`-\` present in all examples? No, it's missing in \`PO123\`.
    3.  Therefore, \`-\` is optional. The correct plan is two steps: add a block for \`-\`, then add a \`?\` quantifier.
    4.  My current proposed step is: "Create a \`LITERAL\` block for the \`-\` symbol."
    5.  My explanation will be: "Добавляем дефис-разделитель. **На следующем шаге мы сделаем его необязательным**, чтобы соответствовать примерам без него."

**OTHER CANONS OF CONSTRUCTION:**
1.  **CONTEXT IS KING:** Look at the \`existingSteps\`. If the last step created an empty container (like \`GROUP\` or \`ALTERNATION\`), your next step **MUST** be to add the first child for that container. Do not add new top-level blocks when a container is waiting to be filled.
2.  **ONE ATOMIC STEP ONLY:** Your entire output must be a JSON object for a single step. Each step must correspond to **ONE** single, simple block. Do not combine concepts.
3.  **ALTERNATION (Logic for "OR"):**
    *   To match **one of several single characters** (e.g., "a" or "b" or "c"), you MUST use a single \`CHARACTER_CLASS\` block with the pattern \`abc\`. This is the most efficient method.
    *   Use \`ALTERNATION\` to match **one of several words or multi-character sequences** (e.g., "cat" or "dog"). To do this, you MUST first create a \`GROUP\` and place an \`ALTERNATION\` block inside it. Then, add the words as separate \`LITERAL\` blocks inside the \`ALTERNATION\`.
4.  **SIMPLE BLOCKS ONLY:** Your generated 'block' object MUST be one of the simple, predefined types.
    *   **LITERAL:** For a short, contiguous string of plain text characters. Use this ONLY for text that does not contain any special regex meaning. **YOU ARE FORBIDDEN from using \`|\`, \`[\`, \`]\`, \`(\`, \`)\`, \`?\`, \`*\`, \`+\`, \`.\` in a LITERAL block.** If you need one of these, use the appropriate block type (\`ALTERNATION\`, \`CHARACTER_CLASS\`, etc.). Each \`LITERAL\` must contain non-empty text. If the user wants to match a specific word or prefix like "PO", you **MUST** create a single \`LITERAL\` block for the entire string "PO".
    *   **CHARACTER_CLASS:** For matching **one character** from a set.
        *   For simple sets, provide the characters directly in the \`pattern\`. Example: to match a "#", "-", or space, create a single \`CHARACTER_CLASS\` with \`pattern: "#- "\`.
        *   For common categories, use shorthands. Example: \`\\d\` (digits), \`\\w\` (word characters), \`\\s\` (whitespace).
        *   For ranges, use a hyphen. Example: \`a-z\`.
        *   **CRITICAL:** A character class \`pattern\` **NEVER** contains quantifiers (\`?\`, \`*\`, \`+\`). To make a character optional (e.g., an optional space \`\\s?\`), you must create TWO separate steps: 1. A \`CHARACTER_CLASS\` block for \`\\s\`. 2. A \`QUANTIFIER\` block for \`?\`.
    *   **QUANTIFIER:** For repetition (e.g., \`+\`, \`*\`, \`?\`). This block always follows another block.
    *   **ANCHOR:** For positions (e.g., \`^\`, \`$\`, \`\\b\`).
    *   **GROUP / ALTERNATION**: These are containers and should be generated empty. Their children are added in subsequent steps.
5.  **EXPLANATION (in Russian):** Provide a very short, clear explanation of what this single block does and why it's the next logical step.
6.  **FINAL STEP VERIFICATION & COMPLETENESS:** Your most important task is to correctly determine if the plan is complete. Set \`isFinalStep: true\` ONLY if this new step genuinely completes a regex that can fully solve the user's entire query. Before you do, mentally construct the full regex from all steps and verify that it matches ALL positive examples in the \`exampleTestText\` and ignores any negative examples.
    *   **Bad Example:** For a query like "find a purchase order number like PO nn-nnnnn" and test text \`PO 12-34567, PO#45-67890, PO12345\`, a regex like \`/PO[ -#]?\\s?\\d{2}/\` is INCOMPLETE because it doesn't match the full number. A plan that only finds the prefix and two digits is a BAD plan. The plan is only final when ALL parts of ALL formats are covered.
    *   When in doubt, it is always better to set \`isFinalStep: false\` and continue building.


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
  prompt: `You are a world-class regular expression expert who teaches users how to build regex, one atomic step at a time.

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

**CRITICAL THINKING FRAMEWORK (YOU MUST OBEY THIS):**
Before you propose a step, you must mentally answer these questions:
1.  **What is the single, most logical next component to add?** (e.g., a separator, a block of digits).
2.  **Is this component PRESENT in ALL of the positive examples in the \`exampleTestText\`?**
    *   If **YES**, then your step is to add that component as a mandatory block.
    *   If **NO**, then this component is OPTIONAL. Your plan MUST account for this. The correct sequence of steps is: FIRST, add the block for the component. SECOND, add a \`QUANTIFIER\` block with type \`?\` to make it optional. Your current step should be the first part of that two-step plan. **In your explanation, you MUST state that the component is optional and will be handled in the next step.**
3.  **Will my proposed step break any existing matches?** A step that reduces the number of matches is only acceptable if it's part of the two-step "optional" plan described above. Otherwise, you have failed.
4.  **Am I repeating myself?** If I'm adding a \`\\d\` after another \`\\d\`, I must use a \`QUANTIFIER\` instead. This is a failure.

**Example Scenario:**
- **Goal:** Find purchase order numbers like \`PO-123\` and \`PO123\`.
- **Existing Step:** A \`LITERAL\` block for "PO". This matches both examples.
- **Your Thought Process:**
    1.  What's next? The \`-\` separator.
    2.  Is \`-\` present in all examples? No, it's missing in \`PO123\`.
    3.  Therefore, \`-\` is optional. The correct plan is two steps: add a block for \`-\`, then add a \`?\` quantifier.
    4.  My current proposed step is: "Create a \`LITERAL\` block for the \`-\` symbol."
    5.  My explanation will be: "Добавляем дефис-разделитель. **На следующем шаге мы сделаем его необязательным**, чтобы соответствовать примерам без него."

**OTHER CANONS OF CONSTRUCTION:**
1.  **DIFFERENT & BETTER:** The new step must be a different approach or a more correct version of the rejected one.
2.  **ONE ATOMIC STEP ONLY:** Your entire output must be a JSON object for a single step. The step must correspond to **ONE** simple block (e.g., \`[a-z]\`, \`+\`, \`\\b\`). Do not combine concepts.
3.  **ALTERNATION (Logic for "OR"):**
    *   To match **one of several single characters** (e.g., "a" or "b" or "c"), you MUST use a single \`CHARACTER_CLASS\` block with the pattern \`abc\`. This is the most efficient method.
    *   Use \`ALTERNATION\` to match **one of several words or multi-character sequences** (e.g., "cat" or "dog"). To do this, you MUST first create a \`GROUP\` and place an \`ALTERNATION\` block inside it. Then, add the words as separate \`LITERAL\` blocks inside the \`ALTERNATION\`.
4.  **SIMPLE BLOCKS ONLY:** Your generated 'block' object MUST be one of the simple, predefined types.
    *   **LITERAL:** For a short, contiguous string of plain text characters. Use this ONLY for text that does not contain any special regex meaning. **YOU ARE FORBIDDEN from using \`|\`, \`[\`, \`]\`, \`(\`, \`)\`, \`?\`, \`*\`, \`+\`, \`.\` in a LITERAL block.** If you need one of these, use the appropriate block type (\`ALTERNATION\`, \`CHARACTER_CLASS\`, etc.). Each \`LITERAL\` must contain non-empty text. If the user wants to match a specific word or prefix like "PO", you **MUST** create a single \`LITERAL\` block for the entire string "PO".
    *   **CHARACTER_CLASS:** For matching **one character** from a set.
        *   For simple sets, provide the characters directly in the \`pattern\`. Example: to match a "#", "-", or space, create a single \`CHARACTER_CLASS\` with \`pattern: "#- "\`.
        *   For common categories, use shorthands. Example: \`\\d\` (digits), \`\\w\` (word characters), \`\\s\` (whitespace).
        *   For ranges, use a hyphen. Example: \`a-z\`.
        *   **CRITICAL:** A character class \`pattern\` **NEVER** contains quantifiers (\`?\`, \`*\`, \`+\`). To make a character optional (e.g., an optional space \`\\s?\`), you must create TWO separate steps: 1. A \`CHARACTER_CLASS\` block for \`\\s\`. 2. A \`QUANTIFIER\` block for \`?\`.
    *   **QUANTIFIER:** For repetition (e.g., \`+\`, \`*\`, \`?\`).
    *   **ANCHOR:** For positions (e.g., \`^\`, \`$\`, \`\\b\`).
    *   **GROUP / ALTERNATION**: These are containers and should be generated empty.
5.  **EXPLANATION (in Russian):** Provide a very short, clear explanation for the new step.
6.  **FINAL STEP VERIFICATION & COMPLETENESS:** Your most important task is to correctly determine if the plan is complete. Set \`isFinalStep: true\` ONLY if this new step genuinely completes a regex that can fully solve the user's entire query. Before you do, mentally construct the full regex from all steps and verify that it matches ALL positive examples in the \`exampleTestText\` and ignores any negative examples.
    *   **Bad Example:** For a query like "find a purchase order number like PO nn-nnnnn" and test text \`PO 12-34567, PO#45-67890, PO12345\`, a regex like \`/PO[ -#]?\\s?\\d{2}/\` is INCOMPLETE because it doesn't match the full number. A plan that only finds the prefix and two digits is a BAD plan. The plan is only final when ALL parts of ALL formats are covered.
    *   When in doubt, it is always better to set \`isFinalStep: false\` and continue building.

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
