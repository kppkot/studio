
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
                regex: input.query,
                explanation: "AI не смог обработать этот запрос. Выражение загружено как единый блок.",
                parsedBlocks: [{
                    id: generateId(),
                    type: BlockType.LITERAL,
                    settings: { text: input.query, isRawRegex: true } as LiteralSettings,
                    children: [],
                    isExpanded: false
                }],
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
        
        // Reconstruct regex from the blocks the AI provided.
        const { regexString: reconstructedRegex } = generateRegexStringAndGroupInfo(processedBlocks);
        let finalExplanation = output.explanation;

        // CRITICAL CHECK: Does the reconstructed regex match the original input?
        // If not, the AI's parsing was flawed. Discard its blocks.
        if (reconstructedRegex !== input.query) {
          // AI failed to parse correctly. Create a single fallback block.
          processedBlocks = [{
            id: generateId(),
            type: BlockType.LITERAL,
            settings: { text: input.query, isRawRegex: true } as LiteralSettings,
            children: [],
            isExpanded: false
          }];
          finalExplanation = "AI не смог полностью разобрать это выражение на части. Оно было загружено как единый блок, чтобы сохранить вашу работу. Вы можете редактировать его вручную.";
        }

        // Construct the final object. The regex string is now ALWAYS the original input.
        return {
            regex: input.query,
            explanation: finalExplanation,
            parsedBlocks: processedBlocks,
            exampleTestText: output.exampleTestText || "Пример текста не был предоставлен AI.",
            recommendedFlags: output.recommendedFlags,
        };
    } catch (error) {
        console.error("Error in generalPurposeRegexGenerator flow:", error);
        // On any other error, also fall back to a safe state that preserves the user's input.
        return {
            regex: input.query,
            explanation: "Произошла временная ошибка при обращении к AI сервису. Ваше выражение загружено как единый блок.",
            parsedBlocks: [{
                id: generateId(),
                type: BlockType.LITERAL,
                settings: { text: input.query, isRawRegex: true } as LiteralSettings,
                children: [],
                isExpanded: false
            }],
            exampleTestText: "Введите текст для тестирования."
        };
    }
  }
);
