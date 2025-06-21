
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
import type { Block, CharacterClassSettings, GroupSettings, AlternationSettings, LiteralSettings, AnchorSettings } from '@/components/regex-vision/types';
import { BlockType } from '@/components/regex-vision/types';

const NaturalLanguageRegexInputSchema = z.object({
  query: z.string().describe('The natural language query describing the desired regex.'),
});
export type NaturalLanguageRegexInput = z.infer<typeof NaturalLanguageRegexInputSchema>;

const BlockSchema: z.ZodTypeAny = z.lazy(() =>
  z.object({
    type: z.nativeEnum(BlockType).describe('The type of the block.'),
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

const createCharClass = (pattern: string, negated = false): Block => ({
  id: "temp", type: BlockType.CHARACTER_CLASS, settings: {pattern, negated} as CharacterClassSettings, children: [], isExpanded: false
});
const createLiteral = (text: string): Block => ({
  id: "temp", type: BlockType.LITERAL, settings: {text} as LiteralSettings, children: [], isExpanded: false
});
const createAlternation = (children: Block[]): Block => ({
  id: "temp", type: BlockType.ALTERNATION, settings: {} as AlternationSettings, children, isExpanded: true
});
const createSequenceGroup = (children: Block[], type: GroupSettings['type'] = 'non-capturing', name?:string): Block => ({
  id: "temp", type: BlockType.GROUP, settings: {type, name} as GroupSettings, children, isExpanded: true
});

const breakdownComplexCharClasses = (blocks: Block[]): Block[] => {
  return blocks.flatMap(block => {
    if (block.type === BlockType.CHARACTER_CLASS) {
      const settings = block.settings as CharacterClassSettings;
      const pattern = settings.pattern;
      
      // Skip breakdown for negated classes or already simple/special classes
      if (settings.negated || !pattern || pattern.length <= 1 || pattern.startsWith('\\')) {
         if (block.children && block.children.length > 0) {
            return { ...block, children: breakdownComplexCharClasses(block.children) };
         }
        return block;
      }
      
      const components: (Block)[] = [];
      const predefinedRanges = ['a-z', 'A-Z', '0-9'];
      let remainingPattern = pattern;

      // Extract predefined ranges
      predefinedRanges.forEach(range => {
        if (remainingPattern.includes(range)) {
          components.push(createCharClass(range, false));
          remainingPattern = remainingPattern.replace(new RegExp(range.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), '');
        }
      });
      
      // Treat remaining characters as individual literals inside the alternation
      if (remainingPattern.length > 0) {
        for (const char of remainingPattern) {
           components.push(createLiteral(char));
        }
      }
      
      if (components.length > 1) {
        // If we have multiple components, wrap them in an alternation inside a non-capturing group
        return createSequenceGroup([createAlternation(components)], 'non-capturing');
      }
    }

    if (block.children && block.children.length > 0) {
      return { ...block, children: breakdownComplexCharClasses(block.children) };
    }
    return block;
  });
};

const correctAndSanitizeAiBlocks = (blocks: Block[]): Block[] => {
    if (!blocks) return [];
    return blocks.map(block => {
        let correctedBlock = { ...block };

        // Rule: AI often misuses LITERAL for special regex tokens. Convert them.
        if (correctedBlock.type === BlockType.LITERAL) {
            const settings = correctedBlock.settings as LiteralSettings;
            const text = settings.text || '';

            const knownCharClasses = ['\\d', '\\D', '\\w', '\\W', '\\s', '\\S', '.'];
            if (knownCharClasses.includes(text)) {
                correctedBlock.type = BlockType.CHARACTER_CLASS;
                correctedBlock.settings = { pattern: text, negated: false } as CharacterClassSettings;
            }

            const knownAnchors = ['^', '$', '\\b', '\\B'];
            if (knownAnchors.includes(text)) {
                correctedBlock.type = BlockType.ANCHOR;
                correctedBlock.settings = { type: text } as AnchorSettings;
            }
            
            // Rule: AI might escape things that shouldn't be. Un-escape them for our model.
            // Our model expects plain characters in LITERALs; the generator will escape them.
            if (text.startsWith('\\') && text.length === 2 && !knownCharClasses.includes(text) && !knownAnchors.includes(text)) {
                (correctedBlock.settings as LiteralSettings).text = text.charAt(1);
            }
        }
        
        if (correctedBlock.children && correctedBlock.children.length > 0) {
            correctedBlock.children = correctAndSanitizeAiBlocks(correctedBlock.children);
        }

        return correctedBlock;
    });
};

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
1.  "type": A string enum indicating the block type from this list: ${Object.values(BlockType).join(', ')}.
2.  "settings": An object with settings specific to the type. Examples:
    *   For "LITERAL": \`{"text": "your_literal_text"}\`. IMPORTANT: For special regex characters that should be treated as plain text (e.g., a literal dot '.'), represent it as a LITERAL with the character itself, like \`{"text": "."}\`. My backend will handle escaping.
    *   For "CHARACTER_CLASS": \`{"pattern": "a-zA-Z0-9", "negated": false}\`. For shorthands like "any digit", use \`{"pattern": "\\\\d"}\`.
    *   For "QUANTIFIER": \`{"type": "*", "mode": "greedy"}\` (type can be '*', '+', '?', '{n}', '{n,}', '{n,m}'). If type is '{n}', '{n,}', or '{n,m}', include "min" and "max" (if applicable) in settings, e.g., \`{"type": "{n,m}", "min": 1, "max": 5, "mode": "greedy"}\`.
    *   For "GROUP": \`{"type": "capturing"}\`, \`{"type": "non-capturing"}\`, or \`{"type": "named", "name": "groupName"}\`.
    *   For "ANCHOR": \`{"type": "^"}\` (type can be '^', '$', '\\b', '\\B').
    *   For "LOOKAROUND": \`{"type": "positive-lookahead"}\` (types: 'positive-lookahead', 'negative-lookahead', 'positive-lookbehind', 'negative-lookbehind').
    *   For "BACKREFERENCE": \`{"ref": "1"}\` or \`{"ref": "groupName"}\`.
3.  "children": An array of block objects, ONLY for container types ("GROUP", "ALTERNATION", "LOOKAROUND", "CONDITIONAL"). For other types, "children" should be an empty array or omitted.

Example for "a date like 12.31.2024":
"parsedBlocks": [
  { "type": "CHARACTER_CLASS", "settings": { "pattern": "\\\\d" } },
  { "type": "QUANTIFIER", "settings": { "type": "{n}", "min": 2 } },
  { "type": "LITERAL", "settings": { "text": "." } },
  { "type": "CHARACTER_CLASS", "settings": { "pattern": "\\\\d" } },
  { "type": "QUANTIFIER", "settings": { "type": "{n}", "min": 2 } },
  { "type": "LITERAL", "settings": { "text": "." } },
  { "type": "CHARACTER_CLASS", "settings": { "pattern": "\\\\d" } },
  { "type": "QUANTIFIER", "settings": { "type": "{n}", "min": 4 } }
]

Ensure the output is in the specified JSON format with "regex", "explanation", "exampleTestText", and optionally "parsedBlocks" fields.
If the query is too vague or cannot be reasonably translated, please indicate that in the explanation, provide a generic regex (like ".*"), an empty 'exampleTestText', and omit 'parsedBlocks'. Always try to provide "regex", "explanation", and "exampleTestText".
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
    
    let processedBlocks: Block[] = [];
    if (output.parsedBlocks) {
      const correctedBlocks = correctAndSanitizeAiBlocks(output.parsedBlocks);
      processedBlocks = breakdownComplexCharClasses(correctedBlocks);
    }

    return {
        ...output,
        parsedBlocks: processedBlocks,
        exampleTestText: output.exampleTestText || "Example text was not provided by AI."
    };
  }
);
