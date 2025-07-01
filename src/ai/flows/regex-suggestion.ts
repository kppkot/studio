
// regex-suggestion.ts
'use server';

/**
 * @fileOverview An AI agent that provides regular expression suggestions.
 *
 * - getRegexSuggestion - A function that generates regex suggestions based on a user query.
 * - RegexSuggestionInput - The input type for the getRegexSuggestion function.
 * - RegexSuggestionOutput - The return type for the getRegexSuggestion function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const RegexSuggestionInputSchema = z.object({
  query: z.string().describe('The user query to generate regex suggestions for.'),
});
export type RegexSuggestionInput = z.infer<typeof RegexSuggestionInputSchema>;

const RegexSuggestionOutputSchema = z.object({
  suggestions: z.array(z.string()).describe('An array of regex suggestions based on the query.'),
});
export type RegexSuggestionOutput = z.infer<typeof RegexSuggestionOutputSchema>;

export async function getRegexSuggestion(input: RegexSuggestionInput): Promise<RegexSuggestionOutput> {
  return regexSuggestionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'regexSuggestionPrompt',
  input: {schema: RegexSuggestionInputSchema},
  output: {schema: RegexSuggestionOutputSchema},
  prompt: `You are an AI expert in regular expressions. A developer is using RegexForge, and has entered a "/" command to request your assistance in creating a regular expression.
  The developer's query is: {{{query}}}

  Generate an array of regex suggestions that are relevant to the query. The suggestions should be simple, and consist of only a single block regex building block.
  The suggestions should be suitable for insertion directly into a regular expression.
  If the query is not related to regular expressions, respond with an empty array.
  `, config: {
    safetySettings: [
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_ONLY_HIGH',
      },
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_LOW_AND_ABOVE',
      },
    ],
  }
});

const regexSuggestionFlow = ai.defineFlow(
  {
    name: 'regexSuggestionFlow',
    inputSchema: RegexSuggestionInputSchema,
    outputSchema: RegexSuggestionOutputSchema,
  },
  async input => {
    try {
      const {output} = await prompt(input);
      if (!output) {
        return { suggestions: [] };
      }
      return output;
    } catch (error) {
      console.error("Error in regexSuggestionFlow:", error);
      // Silently fail and return empty suggestions, as this is not a critical path
      return { suggestions: [] };
    }
  }
);
