
'use server';
/**
 * @fileOverview An AI agent that attempts to fix a broken regular expression based on the user's original query and test data.
 *
 * - fixRegex - A function that provides a corrected regex and its block structure.
 * - FixRegexInput - The input type.
 * - FixRegexOutput - The output type.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { type NaturalLanguageRegexOutput, NaturalLanguageRegexOutputSchema } from './schemas';
import { processAiBlocks, isRegexValid, generateRegexStringAndGroupInfo, createLiteral, generateId, correctAndSanitizeAiBlocks, breakdownComplexCharClasses } from '@/components/regex-vision/utils';
import type { Block, LiteralSettings } from '@/components/regex-vision/types';
import { BlockType } from '@/components/regex-vision/types';

// Reuse the input from analyze-regex-flow
const FixRegexInputSchema = z.object({
  originalQuery: z.string().describe('The original natural language query from the user.'),
  faultyRegex: z.string().describe('The regular expression that was generated, which is incorrect.'),
  testText: z.string().describe('The text the user is trying to match against.'),
  errorContext: z.string().optional().describe('Any error message that was produced by the regex engine.'),
});
export type FixRegexInput = z.infer<typeof FixRegexInputSchema>;

// Reuse the output from natural-language-regex-flow
export type FixRegexOutput = NaturalLanguageRegexOutput;

export async function fixRegex(input: FixRegexInput): Promise<FixRegexOutput> {
  return fixRegexFlow(input);
}

const prompt = ai.definePrompt({
  name: 'fixRegexPrompt',
  input: {schema: FixRegexInputSchema},
  output: {schema: NaturalLanguageRegexOutputSchema}, // Use the same output schema as the main generator
  prompt: `You are a world-class regular expression debugging expert and fixer. A user is trying to build a regex, and it's not working. Your task is to analyze the situation and provide a corrected, working regular expression.

You will be given the user's original goal, the faulty regex, the text they are testing against, and any errors the regex engine produced.

**Your Goal:** Generate a new, corrected regex that achieves the user's original goal and works for the provided test text.

**Analysis of the problem:**
1.  **User's Goal:** \`{{{originalQuery}}}\`
2.  **Faulty Regex:** \`{{{faultyRegex}}}\`
3.  **Test Text:** \`{{{testText}}}\`
4.  **Error (if any):** \`{{{errorContext}}}\`

**Instructions:**
1.  **Understand the Goal:** First, fully understand what the user was trying to accomplish from \`originalQuery\`.
2.  **Diagnose the Faulty Regex:** Identify why the \`faultyRegex\` fails. Is it a syntax error? A logical error? Does it not account for edge cases in the \`testText\`?
3.  **Construct the Fix:** Create a new, correct regular expression.
4.  **Provide a Clear Explanation (in Russian):** Your explanation should briefly state what was wrong with the old regex and how the new one solves the problem.
5.  **Generate Blocks:** Provide a structured representation of the new, corrected regex as an array of 'parsedBlocks', following the same format as the main regex generator. This is crucial.
6.  **Provide Flags:** If necessary (e.g., for case-insensitivity), include them in the 'recommendedFlags' field. Do not include the 'g' flag.

Your output MUST be in the specified JSON format with fields: "regex", "explanation", "parsedBlocks", "exampleTestText" (can be the original testText), and "recommendedFlags".
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

const fixRegexFlow = ai.defineFlow(
  {
    name: 'fixRegexFlow',
    inputSchema: FixRegexInputSchema,
    outputSchema: NaturalLanguageRegexOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    if (!output || !isRegexValid(output.regex)) {
        return {
            regex: input.faultyRegex, // Return original faulty one on failure
            explanation: "AI не смог исправить это выражение. Пожалуйста, попробуйте перефразировать первоначальный запрос или построить выражение вручную.",
            parsedBlocks: [],
            exampleTestText: input.testText,
        };
    }

    if (output.recommendedFlags) {
      const validFlags = new Set(['g', 'i', 'm', 's', 'u', 'y']);
      output.recommendedFlags = Array.from(new Set(output.recommendedFlags.split('')))
          .filter(flag => validFlags.has(flag))
          .join('');
    }

    let processedBlocks: Block[] = [];
    if (output.parsedBlocks && output.parsedBlocks.length > 0) {
      const sanitizedBlocksWithIds = processAiBlocks(output.parsedBlocks);
      if (sanitizedBlocksWithIds.length > 0) {
        const correctedBlocks = correctAndSanitizeAiBlocks(sanitizedBlocksWithIds);
        processedBlocks = breakdownComplexCharClasses(correctedBlocks);
      }
    }
    
    if (processedBlocks.length === 0 && output.regex) {
      processedBlocks = [{
        id: generateId(),
        type: BlockType.LITERAL,
        settings: { text: output.regex, isRawRegex: true } as LiteralSettings,
        children: [],
        isExpanded: false
      }];
    }

    const { regexString: finalRegex } = generateRegexStringAndGroupInfo(processedBlocks);

    return {
        regex: finalRegex,
        explanation: output.explanation,
        parsedBlocks: processedBlocks,
        exampleTestText: output.exampleTestText || input.testText,
        recommendedFlags: output.recommendedFlags,
    };
  }
);
