'use server';
/**
 * @fileOverview An AI agent that analyzes and explains a regular expression in the context of a user's original query.
 *
 * - analyzeRegex - A function that provides an analysis of a regex.
 * - AnalyzeRegexInput - The input type.
 * - AnalyzeRegexOutput - The output type.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeRegexInputSchema = z.object({
  originalQuery: z.string().describe('The original natural language query from the user.'),
  generatedRegex: z.string().describe('The regular expression that was generated, which might be incorrect.'),
  testText: z.string().describe('The text the user is trying to match against.'),
  errorContext: z.string().optional().describe('Any error message that was produced by the regex engine.'),
});
export type AnalyzeRegexInput = z.infer<typeof AnalyzeRegexInputSchema>;

const AnalyzeRegexOutputSchema = z.object({
  analysis: z.string().describe('A detailed, step-by-step analysis in Russian explaining why the regex is wrong for the given query and test text. It should explain what the current regex *actually* does and why it fails. It should be helpful and suggest what the user should look for in a correct solution.'),
});
export type AnalyzeRegexOutput = z.infer<typeof AnalyzeRegexOutputSchema>;

export async function analyzeRegex(input: AnalyzeRegexInput): Promise<AnalyzeRegexOutput> {
  return analyzeRegexFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeRegexPrompt',
  input: {schema: AnalyzeRegexInputSchema},
  output: {schema: AnalyzeRegexOutputSchema},
  prompt: `You are a world-class regular expression debugging expert. A user is trying to build a regex and it's not working. Your task is to explain WHY it's not working, in Russian.

You will be given the user's original goal, the regex that was generated (which is likely faulty), the text they are testing against, and any errors the regex engine produced.

Your analysis must be clear, concise, and helpful. Do not just give the answer. Explain the user's mistake.

1.  **Analyze the \`generatedRegex\`:** Explain what this regex *actually* does. Break it down piece by piece. For example, if you see \`^*\`, point out that this is a syntax error because a quantifier cannot follow a start-of-line anchor.
2.  **Compare to the \`originalQuery\`:** Explain why the current regex fails to achieve the user's goal. For example, "Your goal was to find a commented cron line, but your regex is missing the '#' symbol."
3.  **Use the \`testText\` and \`errorContext\`:** Explain why there are no matches in the test text or what the error means. For example, "The regex fails because it requires the pattern to be at the start of the line (\`^\`), but in your test text, it appears in the middle."

**Original User Goal:**
"{{{originalQuery}}}"

**Generated (Faulty) Regex:**
\`\`\`
{{{generatedRegex}}}
\`\`\`

**Test Text:**
\`\`\`
{{{testText}}}
\`\`\`

**Error Message (if any):**
\`\`\`
{{{errorContext}}}
\`\`\`

Provide your analysis below in the 'analysis' field.
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

const analyzeRegexFlow = ai.defineFlow(
  {
    name: 'analyzeRegexFlow',
    inputSchema: AnalyzeRegexInputSchema,
    outputSchema: AnalyzeRegexOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    if (!output) {
      return { analysis: "Не удалось проанализировать выражение. Попробуйте еще раз." };
    }
    return output;
  }
);
