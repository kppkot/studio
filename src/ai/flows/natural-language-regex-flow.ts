'use server';
/**
 * @fileOverview An AI agent that converts natural language queries into regular expressions and their visual block representation.
 *
 * - generateRegexFromNaturalLanguage - A function that handles the conversion.
 * - NaturalLanguageRegexInput - The input type.
 * - NaturalLanguageRegexOutput - The output type.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { NaturalLanguageRegexOutputSchema } from './schemas';
import type { NaturalLanguageRegexOutput } from './schemas';
import { processAiBlocks, isRegexValid, generateRegexStringAndGroupInfo, createLiteral, generateId } from '@/components/regex-vision/utils';
import type { Block, LiteralSettings } from '@/components/regex-vision/types';
import { BlockType } from '@/components/regex-vision/types';
import { parseRegexWithLibrary } from '@/components/regex-vision/regex-parser';

// Re-export the output type for consumers
export type { NaturalLanguageRegexOutput };

const NaturalLanguageRegexInputSchema = z.object({
  query: z.string().describe('The natural language query describing the desired regex.'),
});
export type NaturalLanguageRegexInput = z.infer<typeof NaturalLanguageRegexInputSchema>;

export async function generateRegexFromNaturalLanguage(input: NaturalLanguageRegexInput): Promise<NaturalLanguageRegexOutput> {
  return naturalLanguageRegexFlow(input);
}

const prompt = ai.definePrompt({
  name: 'naturalLanguageRegexPrompt',
  input: {schema: NaturalLanguageRegexInputSchema},
  output: {schema: NaturalLanguageRegexOutputSchema},
  prompt: `You are a world-class regular expression expert. Your task is to take a user's natural language query and convert it into a fully-formed, production-quality regular expression.

**User's Goal:**
"{{{query}}}"

**Instructions:**
1.  **Analyze the Goal:** Carefully read the user's query to understand the full requirement.
2.  **Construct Regex:** Create the regular expression string that achieves the user's goal.
3.  **Provide a Clear Explanation (in Russian):** Your explanation should be clear, concise, and explain how the regex works to solve the user's problem.
4.  **Generate Blocks (Optional but Recommended):** If possible, provide a structured representation of the regex as an array of 'parsedBlocks'. This is very helpful. If you cannot generate blocks, you can leave this field empty, but you MUST provide a valid "regex" string.
5.  **Provide Example Text:** Create a relevant example text string that would successfully match the generated regex. This helps the user test your solution.
6.  **Recommend Flags:** If the query implies it (e.g., "case-insensitive", "across multiple lines"), suggest appropriate flags (like 'i', 'm', 's'). Do not include the 'g' flag.

Your output MUST be in the specified JSON format with fields: "regex", "explanation", "parsedBlocks", "exampleTestText", and "recommendedFlags".
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

const naturalLanguageRegexFlow = ai.defineFlow(
  {
    name: 'naturalLanguageRegexFlow',
    inputSchema: NaturalLanguageRegexInputSchema,
    outputSchema: NaturalLanguageRegexOutputSchema,
  },
  async (input) => {
    try {
      const {output} = await prompt(input);

      if (!output || !isRegexValid(output.regex)) {
        throw new Error("AI failed to generate a valid regular expression.");
      }

      // Sanitize recommended flags
      if (output.recommendedFlags) {
        const validFlags = new Set(['i', 'm', 's', 'u', 'y']); // 'g' is handled separately by the UI
        output.recommendedFlags = Array.from(new Set(output.recommendedFlags.split('')))
            .filter(flag => validFlags.has(flag))
            .join('');
      }

      let processedBlocks: Block[] = [];
      // If AI provided blocks, process them.
      if (output.parsedBlocks && output.parsedBlocks.length > 0) {
          processedBlocks = processAiBlocks(output.parsedBlocks);
      } else {
        // If AI did not provide blocks, try to parse the generated regex string.
        try {
            processedBlocks = parseRegexWithLibrary(output.regex);
        } catch (e) {
            // If parsing fails, create a single raw literal block as a fallback.
            processedBlocks = [{
                id: generateId(),
                type: BlockType.LITERAL,
                settings: { text: output.regex, isRawRegex: true } as LiteralSettings,
                children: [],
                isExpanded: false
            }];
        }
      }
      
      // Regenerate the regex string from the (potentially parsed/sanitized) blocks to ensure consistency.
      const { regexString: finalRegex } = generateRegexStringAndGroupInfo(processedBlocks);

      return {
        regex: finalRegex,
        explanation: output.explanation,
        parsedBlocks: processedBlocks,
        exampleTestText: output.exampleTestText,
        recommendedFlags: output.recommendedFlags,
      };

    } catch (error) {
        console.error("Error in naturalLanguageRegexFlow:", error);
        throw new Error("Произошла ошибка при генерации Regex. AI сервис может быть временно недоступен.");
    }
  }
);
