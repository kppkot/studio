
'use server';
/**
 * @fileOverview An AI agent that generates regular expressions from natural language.
 *
 * - generateRegexFromNaturalLanguage - A function that handles regex generation.
 * - NaturalLanguageRegexInput - The input type.
 * - NaturalLanguageRegexOutput - The output type.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import type { Block } from '@/components/regex-vision/types';
import { generateRegexStringAndGroupInfo, processAiBlocks, isRegexValid } from '@/components/regex-vision/utils';
import { NaturalLanguageRegexOutputSchema, type NaturalLanguageRegexOutput } from './schemas';

const NaturalLanguageRegexInputSchema = z.object({
  query: z.string().describe('The natural language query or a complete regex string to be parsed.'),
});
export type NaturalLanguageRegexInput = z.infer<typeof NaturalLanguageRegexInputSchema>;


// The main flow that orchestrates everything.
export async function generateRegexFromNaturalLanguage(input: NaturalLanguageRegexInput): Promise<NaturalLanguageRegexOutput> {
  // Always use the general-purpose generator directly.
  return generalPurposeRegexGenerator(input);
}


const generalPurposeGeneratorPrompt = ai.definePrompt({
  name: 'naturalLanguageRegexPrompt',
  input: {schema: NaturalLanguageRegexInputSchema},
  output: {schema: NaturalLanguageRegexOutputSchema},
  prompt: `You are a REGEX to JSON AST parser.
YOUR ONLY TASK is to convert the user's regex string into a structured JSON array of 'parsedBlocks'.
DO NOT MODIFY, SIMPLIFY, OR EXPLAIN ANYTHING.
BE EXTREMELY LITERAL.

PROCESS:
1.  TOKENIZE: Mentally break the input regex into its smallest fundamental components.
    - Example Input: \`\\b[A-Za-z0-9._%+-]+@(?:yahoo|hotmail)\\.com\\b\`
    - Example Tokens: \`\\b\`, \`[A-Za-z0-9._%+-]\`, \`+\`, \`@\`, \`(?:\`, \`yahoo\`, \`|\`, \`hotmail\`, \`)\`, \`\\.\`, \`com\`, \`\\b\`
2.  CONVERT TO JSON: Convert the token stream into the nested JSON 'parsedBlocks' structure.
    - A sequence like \`(?:yahoo|hotmail)\` MUST be a \`GROUP\` (non-capturing) containing an \`ALTERNATION\`, which itself contains two \`LITERAL\` blocks for "yahoo" and "hotmail". DO NOT COLLAPSE THIS.
    - A class like \`[A-Za-z0-9._%+-]\` is ONE \`CHARACTER_CLASS\` block. Its 'pattern' setting MUST be the string \`A-Za-z0-9._%+- \`. DO NOT DECOMPOSE IT.

OUTPUT FORMAT:
Your response MUST be ONLY the JSON object with fields: "regex", "parsedBlocks", "explanation", "exampleTestText", "recommendedFlags".
- \`regex\`: An EXACT copy of the user's input string.
- \`parsedBlocks\`: The JSON structure you built.
- \`explanation\`: "Регулярное выражение успешно разобрано."
- \`exampleTestText\`: An empty string.
- \`recommendedFlags\`: An empty string.

Now, parse the following regex: \`{{{query}}}\`
`,
  config: {
    model: 'googleai/gemini-1.5-pro-latest', // Using a more powerful model for this complex parsing task.
    safetySettings: [
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_LOW_AND_ABOVE'},
    ],
  },
});

// This flow is now the primary generator.
const generalPurposeRegexGenerator = ai.defineFlow(
  {
    name: 'generalPurposeRegexGenerator',
    inputSchema: NaturalLanguageRegexInputSchema,
    outputSchema: NaturalLanguageRegexOutputSchema,
  },
  async (input) => {
    try {
        const {output} = await generalPurposeGeneratorPrompt(input);
        
        if (!output || !isRegexValid(output.regex) || !output.parsedBlocks) {
            return {
                regex: input.query,
                explanation: "Ошибка разбора: AI вернул некорректную или невалидную структуру блоков.",
                parsedBlocks: [],
                exampleTestText: "",
                recommendedFlags: "",
            };
        }
        
        if (output.recommendedFlags) {
          const validFlags = new Set(['g', 'i', 'm', 's', 'u', 'y']);
          output.recommendedFlags = Array.from(new Set(output.recommendedFlags.split('')))
              .filter(flag => validFlags.has(flag))
              .join('');
        }

        let processedBlocks: Block[] = processAiBlocks(output.parsedBlocks);
        
        // Reconstruct regex from the blocks the AI provided for verification.
        const { regexString: reconstructedRegex } = generateRegexStringAndGroupInfo(processedBlocks);

        // CRITICAL CHECK: Does the reconstructed regex match the original input?
        if (reconstructedRegex !== input.query) {
          console.error("AI parsing resulted in a mismatched reconstruction. Original:", input.query, "Reconstructed:", reconstructedRegex);
          return {
              regex: input.query,
              explanation: "Ошибка разбора: AI не смог точно воссоздать структуру. Пожалуйста, проверьте синтаксис или попробуйте немного упростить выражение.",
              parsedBlocks: [],
              exampleTestText: "",
              recommendedFlags: output.recommendedFlags,
          };
        }

        // Success case
        return {
            regex: input.query,
            explanation: output.explanation || "Регулярное выражение успешно разобрано.",
            parsedBlocks: processedBlocks,
            exampleTestText: output.exampleTestText || "",
            recommendedFlags: output.recommendedFlags,
        };
    } catch (error) {
        console.error("Critical error in generalPurposeRegexGenerator flow:", error);
        return {
            regex: input.query,
            explanation: "Критическая ошибка: не удалось связаться с сервисом AI для разбора выражения. Пожалуйста, попробуйте еще раз позже.",
            parsedBlocks: [],
            exampleTestText: "",
            recommendedFlags: "",
        };
    }
  }
);
