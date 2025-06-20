
'use server';
/**
 * @fileOverview An AI agent that generates regular expressions from natural language
 * and attempts to parse it into a structured block format.
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

const BlockSchema: z.ZodTypeAny = z.lazy(() =>
  z.object({
    type: z.string().describe('The type of the block (e.g., "LITERAL", "CHARACTER_CLASS", "GROUP", "QUANTIFIER", "ANCHOR", "ALTERNATION", "LOOKAROUND", "BACKREFERENCE", "CONDITIONAL").'),
    settings: z.any().describe('An object containing settings specific to the block type. Examples: LITERAL: {"text": "abc"}, CHARACTER_CLASS: {"pattern": "[a-z]", "negated": false}, QUANTIFIER: {"type": "*", "mode": "greedy"}, GROUP: {"type": "capturing", "name": "myGroup"}.'),
    children: z.array(BlockSchema).optional().describe('An array of child block objects, used for container types like GROUP, ALTERNATION, LOOKAROUND, CONDITIONAL.'),
  })
);

const NaturalLanguageRegexOutputSchema = z.object({
  regex: z.string().describe('The generated regular expression string.'),
  explanation: z.string().describe('A concise explanation of how the generated regex works.'),
  parsedBlocks: z.array(BlockSchema).optional().describe('An array of block objects representing the parsed regex structure. If parsing is not possible, this can be empty or omitted.'),
  exampleTestText: z.string().optional().describe('An example text string that would match the generated regex or be relevant for testing it.'),
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
Provide the regex string itself, a concise explanation of how it works, and if possible, a structured representation of the regex as an array of 'parsedBlocks'.
Additionally, provide an 'exampleTestText' field containing a short, relevant example string that would be suitable for testing the generated regex. This text should ideally contain at least one match for the regex, but also some non-matching parts if appropriate for context.

User Query: {{{query}}}

The 'parsedBlocks' structure should be an array of objects. Each object must have:
1.  "type": A string indicating the block type. Valid types are: "LITERAL", "CHARACTER_CLASS", "GROUP", "QUANTIFIER", "ANCHOR", "ALTERNATION", "LOOKAROUND", "BACKREFERENCE", "CONDITIONAL".
2.  "settings": An object with settings specific to the type. Examples:
    *   For "LITERAL": \`{"text": "your_literal_text"}\` (Note: do not escape regex special characters here, use raw text. E.g. for '\\d+' use text: '\\d+')
    *   For "CHARACTER_CLASS": \`{"pattern": "a-zA-Z0-9", "negated": false}\` or \`{"pattern": "\\\\d", "negated": false}\` (use double backslash for predefined classes like \\d, \\s, \\w).
    *   For "QUANTIFIER": \`{"type": "*", "mode": "greedy"}\` (type can be '*', '+', '?', '{n}', '{n,}', '{n,m}'). If type is '{n}', '{n,}', or '{n,m}', include "min" and "max" (if applicable) in settings, e.g., \`{"type": "{n,m}", "min": 1, "max": 5, "mode": "greedy"}\`.
    *   For "GROUP": \`{"type": "capturing"}\`, \`{"type": "non-capturing"}\`, or \`{"type": "named", "name": "groupName"}\`.
    *   For "ANCHOR": \`{"type": "^"}\` (type can be '^', '$', '\\b', '\\B'). Use double backslash for \\b and \\B.
    *   For "LOOKAROUND": \`{"type": "positive-lookahead"}\` (types: 'positive-lookahead', 'negative-lookahead', 'positive-lookbehind', 'negative-lookbehind').
    *   For "BACKREFERENCE": \`{"ref": "1"}\` or \`{"ref": "groupName"}\`.
    *   For "CONDITIONAL": \`{"condition": "groupName_or_lookaround", "yesPattern": "regex_if_true", "noPattern": "regex_if_false"}\`. (Keep yesPattern/noPattern as simple regex strings for now)
3.  "children": An array of block objects, ONLY for container types ("GROUP", "ALTERNATION", "LOOKAROUND", "CONDITIONAL"). For other types, "children" should be an empty array or omitted. For "ALTERNATION", each child in "children" represents one alternative path, typically a "GROUP" or "LITERAL".

Example for "abc\\d+":
"parsedBlocks": [
  { "type": "LITERAL", "settings": { "text": "abc" } },
  { "type": "CHARACTER_CLASS", "settings": { "pattern": "\\\\d", "negated": false } },
  { "type": "QUANTIFIER", "settings": { "type": "+", "mode": "greedy" } }
],
"exampleTestText": "Some text abc123 and more text."

Example for "(cat|dog)":
"parsedBlocks": [
 {
    "type": "GROUP",
    "settings": {"type": "capturing"},
    "children": [
      {
        "type": "ALTERNATION",
        "settings": {},
        "children": [
          {"type": "LITERAL", "settings": {"text": "cat"}},
          {"type": "LITERAL", "settings": {"text": "dog"}}
        ]
      }
    ]
 }
],
"exampleTestText": "My pet is a cat."

Ensure the output is in the specified JSON format with "regex", "explanation", "exampleTestText", and optionally "parsedBlocks" fields.
If the query is too vague or cannot be reasonably translated into a regex, or if parsing into blocks is too complex, please indicate that in the explanation, provide an empty or generic regex (like ".*"), an empty or generic 'exampleTestText', and omit 'parsedBlocks' or provide an empty array for it.
Always try to provide the "regex", "explanation", and "exampleTestText".
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
        return {
            regex: ".*",
            explanation: "AI could not generate a specific regex for this query. Please try rephrasing or being more specific.",
            parsedBlocks: [],
            exampleTestText: "Some example text to test with."
        };
    }
    // Ensure parsedBlocks is at least an empty array if missing
    // Ensure exampleTestText has a default if missing
    return {
        ...output,
        parsedBlocks: output.parsedBlocks || [],
        exampleTestText: output.exampleTestText || "Example text was not provided by AI."
    };
  }
);

    