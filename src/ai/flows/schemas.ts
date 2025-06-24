/**
 * @fileOverview Shared Zod schemas for AI flows.
 */
import {z} from 'genkit';
import { BlockType } from '@/components/regex-vision/types';

// This is a recursive schema, so we must use z.lazy()
const BlockSchema: z.ZodTypeAny = z.lazy(() =>
  z.object({
    type: z.nativeEnum(BlockType).describe('The type of the block.'),
    settings: z.any().describe('An object containing settings specific to the block type. Examples: LITERAL: {"text": "abc"}, CHARACTER_CLASS: {"pattern": "[a-z]", "negated": false}, QUANTIFIER: {"type": "*", "mode": "greedy"}, GROUP: {"type": "capturing", "name": "myGroup"}.'),
    children: z.array(BlockSchema).optional().describe('An array of child block objects, used for container types like GROUP, ALTERNATION, LOOKAROUND, CONDITIONAL.'),
  })
);

export const NaturalLanguageRegexOutputSchema = z.object({
  regex: z.string().describe('The generated regular expression string.'),
  explanation: z.string().describe('A concise explanation in Russian of how the generated regex works.'),
  parsedBlocks: z.array(BlockSchema).optional().describe('An array of block objects representing the parsed regex structure. If parsing is not possible, this can be empty or omitted.'),
  exampleTestText: z.string().optional().describe('An example text string that would match the generated regex or be relevant for testing it.'),
  recommendedFlags: z.string().optional().describe("A string of recommended flags based on the user's query (e.g., 'i', 'm', 's'). Only include flags if explicitly requested. Do not include 'g'."),
});

export type NaturalLanguageRegexOutput = z.infer<typeof NaturalLanguageRegexOutputSchema>;
