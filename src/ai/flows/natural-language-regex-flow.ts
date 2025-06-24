
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
import { generateRegexStringAndGroupInfo, generateId, processAiBlocks, breakdownComplexCharClasses, correctAndSanitizeAiBlocks, isRegexValid } from '@/components/regex-vision/utils';
import { NaturalLanguageRegexOutputSchema, type NaturalLanguageRegexOutput } from './schemas';

const NaturalLanguageRegexInputSchema = z.object({
  query: z.string().describe('The natural language query describing the desired regex.'),
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
  prompt: `You are an expert Regex assistant. Your primary task is to help a user by generating a custom regex from their natural language query. Your process MUST follow two steps:

**Step 1: Generate Example Text.**
First, analyze the user's query. Based on the query, create a short but comprehensive 'exampleTestText'. This text is crucial. It must be relevant and suitable for testing the regex you are about to create. It should ideally contain examples of what should match and what shouldn't.

**Step 2: Generate the Regex and its breakdown.**
Second, using BOTH the original user query AND the 'exampleTestText' you just created as context, generate the final regular expression.

Your output must be a single JSON object containing:
1. 'regex': The final regex string.
2. 'explanation': A concise explanation in Russian of how it works.
3. 'exampleTestText': The test text you generated in Step 1.
4. 'parsedBlocks': A structured representation of the regex as an array of 'parsedBlocks'.
5. 'recommendedFlags': Any recommended flags (e.g., 'i', 'm').

User Query: {{{query}}}

**IMPORTANT INSTRUCTIONS:**
*   **Follow the steps:** Do not skip Step 1. The 'exampleTestText' is mandatory.
*   **Flags:** Do not include inline flags in the regex string (like \`(?i)\`). Instead, use the 'recommendedFlags' field in the output JSON. If the user asks for "case-insensitive", "ignore case", etc., add 'i' to the 'recommendedFlags' string. If they ask for "multiline", add 'm'. If they ask for "dot all" or "single line", add 's'. Combine flags if needed (e.g., "im"). Do NOT include the 'g' (global) flag, as the UI handles it by default.
*   **Word Boundaries:** If the user asks to find a "word", you MUST wrap the pattern in \`\\b\` anchors. Example: for "find the word cat", generate \`\\bcat\\b\`.

The 'parsedBlocks' structure should be an array of objects. Each object must have:
1.  "type": A string enum indicating the block type from this list: ${Object.values(BlockType).join(', ')}.
2.  "settings": An object with settings specific to the type. Examples:
    *   For "LITERAL": \`{"text": "your_literal_text"}\`. IMPORTANT: For special regex characters that should be treated as plain text (e.g., a literal dot '.'), provide the literal character itself: \`{"text": "."}\`. My backend will handle escaping. For special characters like \`\\d\`, \`\\s\`, \`^\`, \`$\`, DO NOT use a LITERAL block. Use CHARACTER_CLASS or ANCHOR instead.
    *   For "CHARACTER_CLASS": The \`pattern\` must be for a SINGLE simple element. For example, for "any digit", use \`{"pattern": "\\\\d"}\`. For "lowercase letters", use \`{"pattern": "a-z"}\`. **DO NOT combine these.** To match "any word character", which includes letters, numbers, and underscore, it is almost always better to use the single shorthand \`{"pattern": "\\\\w"}\` rather than building it from parts. For a single dot matching any character, use \`{"type": "CHARACTER_CLASS", "settings": {"pattern": "."}}\`.
    *   For "QUANTIFIER": \`{"type": "*", "mode": "greedy"}\` (type can be '*', '+', '?', '{n}', '{n,}', '{n,m}'). If type is '{n}', '{n,}', or '{n,m}', include "min" and "max" (if applicable) in settings, e.g., \`{"type": "{n,m}", "min": 1, "max": 5, "mode": "greedy"}\`.
    *   For "GROUP": \`{"type": "capturing"}\`, \`{"type": "non-capturing"}\`, or \`{"type": "named", "name": "groupName"}\`.
    *   For "ANCHOR": \`{"type": "^"}\` (type can be '^', '$', '\\b', '\\B').
    *   For "ALTERNATION": This block has no settings. Its children are the different options to match. For example, to match "cat" or "dog", an ALTERNATION block would have two children: a LITERAL block for "cat" and a LITERAL block for "dog". This block is almost always placed inside a GROUP block to define its scope (e.g., to create \`(?:cat|dog)\`).
    *   For "LOOKAROUND": \`{"type": "positive-lookahead"}\` (types: 'positive-lookahead', 'negative-lookahead', 'positive-lookbehind', 'negative-lookbehind').
    *   For "BACKREFERENCE": \`{"ref": "1"}\` or \`{"ref": "groupName"}\`.
3.  "children": An array of block objects, ONLY for container types ("GROUP", "ALTERNATION", "LOOKAROUND", "CONDITIONAL"). For other types, "children" should be an empty array or omitted.

CRITICAL INSTRUCTION: Instead of creating a single large LITERAL block with regex characters inside, you MUST break it down into smaller, semantic blocks. For example, for "a number between 0 and 255", do not create a LITERAL with text "(?:25[0-5]|...))". Instead, create a non-capturing GROUP containing an ALTERNATION of smaller blocks. For "IPv4 address", generate a sequence of blocks representing each octet and dot, not one large literal.

Ensure the output is in the specified JSON format with "regex", "explanation", "exampleTestText", "recommendedFlags" (if any), and optionally "parsedBlocks" fields.
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

// This flow is now the primary generator.
const generalPurposeRegexGenerator = ai.defineFlow(
  {
    name: 'generalPurposeRegexGenerator',
    inputSchema: NaturalLanguageRegexInputSchema,
    outputSchema: NaturalLanguageRegexOutputSchema,
  },
  async (input) => {
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
      // processAiBlocks now filters invalid blocks.
      const sanitizedBlocksWithIds = processAiBlocks(output.parsedBlocks);
      
      // Only proceed if we have valid blocks after sanitization.
      if (sanitizedBlocksWithIds.length > 0) {
        const correctedBlocks = correctAndSanitizeAiBlocks(sanitizedBlocksWithIds);
        processedBlocks = breakdownComplexCharClasses(correctedBlocks);
      }
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
  }
);
