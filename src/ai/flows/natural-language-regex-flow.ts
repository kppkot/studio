
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
// The smart dispatch logic has been disabled as per request. Codeword: ОПТИМИЗАЦИЯ
export async function generateRegexFromNaturalLanguage(input: NaturalLanguageRegexInput): Promise<NaturalLanguageRegexOutput> {
  // Always use the general-purpose generator directly.
  return generalPurposeRegexGenerator(input);
}


const generalPurposeGeneratorPrompt = ai.definePrompt({
  name: 'naturalLanguageRegexPrompt',
  input: {schema: NaturalLanguageRegexInputSchema},
  output: {schema: NaturalLanguageRegexOutputSchema},
  prompt: `You are a programmatic Regular Expression to JSON AST converter. Your SOLE TASK is to convert a user's regex string into a structured JSON array of 'parsedBlocks' without any modification, simplification, or explanation beyond what's required.

Follow this two-step process meticulously:
Step 1: Tokenize the input regex. Mentally break it down into its fundamental components (e.g., \`\\b\`, \`[\`, \`A-Za-z0-9._%+- \`, \`]\`, \`+\`, \`@\`, \`(?:\`, \`yahoo\`, \`|\`, \`hotmail\`, \`|\`, \`gmail\`, \`)\`, \`\\.\`, \`com\`, \`\\b\`).
Step 2: Convert the token stream into a nested JSON structure of 'parsedBlocks'. Be extremely literal.

**CRITICAL RULES:**
1.  **ABSOLUTE FIDELITY:** The generated block structure MUST be able to reconstruct the original regex string PERFECTLY. No changes, no simplifications.
2.  **STRUCTURE IS SACRED:** A sequence like \`(?:yahoo|hotmail|gmail)\` MUST be a \`GROUP\` (non-capturing) containing an \`ALTERNATION\` which itself contains three \`LITERAL\` blocks for "yahoo", "hotmail", and "gmail". Do not collapse this.
3.  **CHARACTER CLASSES ARE LITERAL:** A class like \`[A-Za-z0-9._%+-]\` is ONE \`CHARACTER_CLASS\` block. Its 'pattern' setting MUST be the string \`A-Za-z0-9._%+- \`. DO NOT break it down into smaller parts.
4.  **OUTPUT FORMAT:** Your response must be ONLY the JSON object with fields: "regex", "parsedBlocks", "explanation", "exampleTestText", "recommendedFlags".
    *   \`regex\`: An EXACT copy of the user's input string.
    *   \`parsedBlocks\`: The JSON structure you built.
    *   \`explanation\`: "Регулярное выражение успешно разобрано."
    *   \`exampleTestText\`: An empty string.
    *   \`recommendedFlags\`: An empty string.

**Example:**
*   Input: \`\\b[A-Za-z0-9._%+-]+@(?:yahoo|hotmail|gmail)\\.com\\b\`
*   Your output \`parsedBlocks\` must represent this exact structure.

Now, parse the following regex: \`{{{query}}}\`
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
            throw new Error("AI failed to generate a valid or parsable block structure.");
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
        // If not, the AI's parsing was flawed. Abort.
        if (reconstructedRegex !== input.query) {
          throw new Error("AI parsing resulted in a mismatched reconstruction. Aborting to prevent corruption.");
        }

        // Construct the final object. The regex string is now ALWAYS the original input.
        return {
            regex: input.query,
            explanation: output.explanation || "Регулярное выражение успешно разобрано.",
            parsedBlocks: processedBlocks,
            exampleTestText: output.exampleTestText || "",
            recommendedFlags: output.recommendedFlags,
        };
    } catch (error) {
        console.error("Error in generalPurposeRegexGenerator flow:", error);
        
        const errorMessage = error instanceof Error ? error.message : "AI сервис вернул неожиданный ответ.";
        
        let friendlyMessage = "Произошла ошибка при разборе выражения. ";
        if (errorMessage.includes("mismatched reconstruction")) {
            friendlyMessage += "AI не смог точно воссоздать структуру. Пожалуйста, попробуйте немного упростить выражение или проверьте его синтаксис.";
        } else if (errorMessage.includes("parsable block structure")) {
            friendlyMessage += "AI вернул некорректную структуру блоков. Пожалуйста, проверьте синтаксис выражения.";
        } else {
            friendlyMessage += "AI сервис мог вернуть некорректный ответ или быть временно недоступен.";
        }
        
        throw new Error(friendlyMessage);
    }
  }
);
