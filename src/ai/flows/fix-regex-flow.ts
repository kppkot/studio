
'use server';
/**
 * @fileOverview An AI agent that attempts to fix a broken regular expression based on the user's original query and test data.
 * This flow now uses a two-step process: first, it analyzes the faulty regex, then it uses that analysis to generate a fix.
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
import { analyzeRegex } from './analyze-regex-flow';

// Public input schema (what the client calls)
const PublicFixRegexInputSchema = z.object({
  originalQuery: z.string().describe('The original natural language query from the user.'),
  faultyRegex: z.string().describe('The regular expression that was generated, which is incorrect.'),
  testText: z.string().describe('The text the user is trying to match against.'),
  errorContext: z.string().optional().describe('Any error message that was produced by the regex engine.'),
});
export type FixRegexInput = z.infer<typeof PublicFixRegexInputSchema>;

// Internal schema for the prompt, which includes the analysis from the first step
const InternalFixRegexPromptSchema = PublicFixRegexInputSchema.extend({
  analysisContext: z.string().describe('A detailed analysis from a separate AI agent explaining what is wrong with the faulty regex. This should be trusted as the source of truth for the diagnosis.'),
});


// Reuse the output from natural-language-regex-flow
export type FixRegexOutput = NaturalLanguageRegexOutput;

export async function fixRegex(input: FixRegexInput): Promise<FixRegexOutput> {
  return fixRegexFlow(input);
}

const prompt = ai.definePrompt({
  name: 'fixRegexPrompt',
  input: {schema: InternalFixRegexPromptSchema},
  output: {schema: NaturalLanguageRegexOutputSchema}, // Use the same output schema as the main generator
  prompt: `You are a world-class regular expression construction expert. Your task is to provide a corrected, working regular expression based on a pre-flight analysis.

**A trusted AI colleague has analyzed the user's problem and concluded the following:**
--- ANALYSIS START ---
{{{analysisContext}}}
--- ANALYSIS END ---

Your primary goal is to use this analysis to construct the correct regular expression and its block structure. The analysis is your source of truth for what went wrong.

**Original problem details (for context only):**
- **User's Goal:** \`{{{originalQuery}}}\`
- **Faulty Regex:** \`{{{faultyRegex}}}\`
- **Test Text:** \`{{{testText}}}\`
- **Error (if any):** \`{{{errorContext}}}\`


**Instructions:**
1.  **Trust the Analysis:** Base your correction on the provided analysis.
2.  **Construct the Fix:** Create a new, correct regular expression.
3.  **Provide a Clear Explanation (in Russian):** Your explanation should briefly state what was wrong with the old regex and how the new one solves the problem, summarizing the key points from the analysis.
4.  **Generate Blocks:** Provide a structured representation of the new, corrected regex as an array of 'parsedBlocks'. This is crucial.
5.  **Provide Flags:** If necessary, include them in the 'recommendedFlags' field. Do not include the 'g' flag.

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
    inputSchema: PublicFixRegexInputSchema,
    outputSchema: NaturalLanguageRegexOutputSchema,
  },
  async input => {
    // Step 1: Analyze the problem to get a detailed breakdown of what's wrong.
    const analysisResult = await analyzeRegex({
      originalQuery: input.originalQuery,
      generatedRegex: input.faultyRegex,
      testText: input.testText,
      errorContext: input.errorContext || 'Нет контекста ошибки.',
    });

    // Step 2: Call the fixing prompt with the analysis as trusted context.
    const {output} = await prompt({
        ...input,
        analysisContext: analysisResult.analysis,
    });

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
