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

const NaturalLanguageRegexInputSchema = z.object({
  query: z.string().describe('The natural language query describing the desired regex.'),
});
export type NaturalLanguageRegexInput = z.infer<typeof NaturalLanguageRegexInputSchema>;

const NaturalLanguageRegexOutputSchema = z.object({
  regex: z.string().describe('The generated regular expression string.'),
  explanation: z.string().describe('A concise explanation of how the generated regex works.'),
});
export type NaturalLanguageRegexOutput = z.infer<typeof NaturalLanguageRegexOutputSchema>;

export async function generateRegexFromNaturalLanguage(input: NaturalLanguageRegexInput): Promise<NaturalLanguageRegexOutput> {
  return naturalLanguageRegexFlow(input);
}

const prompt = ai.definePrompt({
  name: 'naturalLanguageRegexPrompt',
  input: {schema: NaturalLanguageRegexInputSchema},
  output: {schema: NaturalLanguageRegexOutputSchema},
  prompt: `You are an expert Regex assistant. Based on the user's natural language query, generate an optimal and correct regular expression.
Provide the regex string itself and a concise explanation of how the generated regex works, detailing its components and logic.

User Query: {{{query}}}

Ensure the output is in the specified JSON format with "regex" and "explanation" fields.
If the query is too vague or cannot be reasonably translated into a regex, please indicate that in the explanation and provide an empty regex string or a very generic one like ".*".
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
    const {output} = await prompt(input);
    if (!output) {
        // Fallback or error handling if AI provides no output
        return {
            regex: ".*", // Default or error regex
            explanation: "AI could not generate a specific regex for this query. Please try rephrasing or being more specific."
        };
    }
    return output;
  }
);
