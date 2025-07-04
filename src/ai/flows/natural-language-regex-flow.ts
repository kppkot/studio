
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
import type { Block, LiteralSettings } from '@/components/regex-vision/types';
import { BlockType } from '@/components/regex-vision/types';
import { generateRegexStringAndGroupInfo, generateId, processAiBlocks, isRegexValid } from '@/components/regex-vision/utils';
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
  prompt: `You are an expert Regex parser. Your one and only task is to take a user's regular expression string and convert it into a structured JSON array of 'parsedBlocks'.

User's Regex to Parse: \`{{{query}}}\`

**CRITICAL INSTRUCTIONS:**
1.  **PARSE, DO NOT CHANGE:** Your only goal is to represent the *exact* input regex as blocks. Do NOT simplify it, modify it, or "fix" it. Your output must perfectly reconstruct the user's input.
2.  **PRESERVE STRUCTURE:** For complex parts like \`(?:yahoo|hotmail|gmail)\`, you must create a non-capturing group containing an alternation block, which in turn contains three literal blocks for "yahoo", "hotmail", and "gmail". Do not lose this structure.
3.  **HANDLE CHARACTER CLASSES CORRECTLY:** A character class like \`[A-Za-z0-9._%+-]\` should be a SINGLE \`CHARACTER_CLASS\` block with its 'pattern' setting as \`A-Za-z0-9._%+-]\`. Do not break it apart.
4.  **OUTPUT JSON ONLY:** Your entire output must be a single JSON object with the following fields:
    *   \`regex\`: This MUST be an EXACT, UNMODIFIED copy of the user's input regex from the query.
    *   \`parsedBlocks\`: The array of block objects representing the regex.
    *   \`explanation\`: A simple confirmation, in Russian, like "Регулярное выражение разобрано в визуальное дерево."
    *   \`exampleTestText\`: An empty string.
    *   \`recommendedFlags\`: An empty string unless the user's query included flags like \`(?i)\`. If so, extract 'i' into this field.

**Example for your reference:**
*   **User's Regex:** \`\\b[A-Za-z0-9._%+-]+@(?:yahoo|hotmail|gmail)\\.com\\b\`
*   **Your \`parsedBlocks\` output should represent this structure perfectly, not a simplified or broken version.**

Generate the JSON output now.
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
        
        if (!output || !isRegexValid(output.regex)) {
            return {
                regex: ".*",
                explanation: "AI не смог сгенерировать корректное регулярное выражение для этого запроса. Пожалуйста, попробуйте перефразировать или быть более конкретным.",
                parsedBlocks: [],
                exampleTestText: "Введите текст для тестирования."
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
          processedBlocks = processAiBlocks(output.parsedBlocks);
        }
        
        // Fallback: If block processing failed or was never attempted, but we have a valid regex string.
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

        // Construct the final object from trusted sources to ensure consistency.
        return {
            regex: finalRegex,
            explanation: output.explanation,
            parsedBlocks: processedBlocks,
            exampleTestText: output.exampleTestText || "Пример текста не был предоставлен AI.",
            recommendedFlags: output.recommendedFlags,
        };
    } catch (error) {
        console.error("Error in generalPurposeRegexGenerator flow:", error);
        return {
            regex: ".*",
            explanation: "Произошла временная ошибка при обращении к AI сервису (модель может быть перегружена). Пожалуйста, попробуйте еще раз через несколько секунд.",
            parsedBlocks: [],
            exampleTestText: "Введите текст для тестирования."
        };
    }
  }
);

    
