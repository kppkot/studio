
'use server';
/**
 * @fileOverview An AI agent that generates regular expressions from natural language.
 * It uses a router to handle known patterns with predefined generators, and
 * falls back to a general-purpose AI prompt for custom requests.
 *
 * - generateRegexFromNaturalLanguage - A function that handles regex generation.
 * - NaturalLanguageRegexInput - The input type.
 * - NaturalLanguageRegexOutput - The output type.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import type { Block, CharacterClassSettings, GroupSettings, LiteralSettings, AnchorSettings, LookaroundSettings } from '@/components/regex-vision/types';
import { BlockType } from '@/components/regex-vision/types';
import { generateBlocksForIPv4, generateBlocksForIPv6, generateBlocksForEmail, generateBlocksForURL, generateBlocksForDuplicateWords, generateBlocksForMultipleSpaces, generateBlocksForTabsToSpaces, generateBlocksForNumbers, generateRegexStringAndGroupInfo, generateId, processAiBlocks, createLiteral } from '@/components/regex-vision/utils';

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
  recommendedFlags: z.string().optional().describe("A string of recommended flags based on the user's query (e.g., 'i', 'm', 's'). Only include flags if explicitly requested. Do not include 'g'."),
});
export type NaturalLanguageRegexOutput = z.infer<typeof NaturalLanguageRegexOutputSchema>;

const breakdownComplexCharClasses = (blocks: Block[]): Block[] => {
  return blocks.flatMap(block => {
    if (block.type === BlockType.CHARACTER_CLASS) {
      const settings = block.settings as CharacterClassSettings;
      const pattern = settings.pattern;
      
      // Do not break down special shorthands (\d, \w, etc.), single characters, or negated classes
      if (settings.negated || !pattern || pattern.length <= 1 || (pattern.startsWith('\\') && pattern.length === 2) || pattern === '.') {
         if (block.children && block.children.length > 0) {
            return { ...block, children: breakdownComplexCharClasses(block.children) };
         }
        return block;
      }
      
      const components: Block[] = [];
      const predefinedRanges: { [key: string]: string } = { 'a-z': 'a-z', 'A-Z': 'A-Z', '0-9': '0-9' };
      let remainingPattern = pattern;

      // Extract predefined ranges
      Object.keys(predefinedRanges).forEach(rangeKey => {
        if (remainingPattern.includes(rangeKey)) {
          components.push({ id: generateId(), type: BlockType.CHARACTER_CLASS, settings: { pattern: rangeKey, negated: false } as CharacterClassSettings, children: [], isExpanded: false });
          remainingPattern = remainingPattern.replace(new RegExp(rangeKey.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), '');
        }
      });
      
      // Treat remaining characters as individual literals
      if (remainingPattern.length > 0) {
         for (const char of remainingPattern) {
           // If the char is a special regex char that needs escaping, treat it as a literal
           components.push({ id: generateId(), type: BlockType.LITERAL, settings: { text: char } as LiteralSettings, children: [], isExpanded: false });
        }
      }
      
      if (components.length > 1) {
        // Wrap multiple components in a non-capturing group with an alternation
        return { id: generateId(), type: BlockType.CHARACTER_CLASS, settings: { pattern: '', negated: false } as CharacterClassSettings, children: components, isExpanded: true };
      } else if (components.length === 1) {
        // If only one component remains, return it directly
        return components[0];
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

        if (correctedBlock.type === BlockType.LITERAL) {
            const settings = correctedBlock.settings as LiteralSettings;
            if (settings.isRawRegex) { // Do not correct raw regex literals
                return correctedBlock;
            }
            const text = settings.text || '';
            
            const knownCharClasses = ['\\d', '\\D', '\\w', '\\W', '\\s', '\\S'];
            if (knownCharClasses.includes(text)) {
                correctedBlock.type = BlockType.CHARACTER_CLASS;
                correctedBlock.settings = { pattern: text, negated: false } as CharacterClassSettings;
                return correctedBlock;
            }
            if (text === '.') {
                correctedBlock.type = BlockType.CHARACTER_CLASS;
                correctedBlock.settings = { pattern: '.', negated: false } as CharacterClassSettings;
                return correctedBlock;
            }

            const knownAnchors = ['^', '$', '\\b', '\\B'];
            if (knownAnchors.includes(text)) {
                correctedBlock.type = BlockType.ANCHOR;
                correctedBlock.settings = { type: text } as AnchorSettings;
                return correctedBlock;
            }
            
            if (text.startsWith('\\') && text.length === 2 && !knownCharClasses.includes(text) && !knownAnchors.includes(text)) {
                 if(text !== '\\.'){
                    (correctedBlock.settings as LiteralSettings).text = text.charAt(1);
                 }
            }
        }
        
        if (correctedBlock.children && correctedBlock.children.length > 0) {
            correctedBlock.children = correctAndSanitizeAiBlocks(correctedBlock.children);
        }

        return correctedBlock;
    });
};

const isRegexValid = (regex: string): boolean => {
  if (!regex) return false;
  try {
    new RegExp(regex);
    return true;
  } catch (e) {
    return false;
  }
};


// Router prompt to classify the user's query
const KnownPatternSchema = z.enum([
    'email', 'url', 'ipv4', 'ipv6', 
    'duplicate_words', 'multiple_spaces', 'tabs_to_spaces', 'numbers',
    'unknown'
]);

const RouterOutputSchema = z.object({
    pattern: KnownPatternSchema.describe("The general category of regex the user is asking for. If it's not a standard known pattern, classify as 'unknown'."),
    urlRequiresProtocol: z.boolean().optional().describe("For URL patterns, set to true if the user explicitly requires http/https.")
});

const routerPrompt = ai.definePrompt({
  name: 'regexRouterPrompt',
  input: { schema: NaturalLanguageRegexInputSchema },
  output: { schema: RouterOutputSchema },
  prompt: `You are a regex query classifier. Analyze the user's query and classify it into one of the known patterns. Your goal is to handle simple, generic requests with predefined patterns, and pass more specific or complex requests to a more powerful AI by classifying them as 'unknown'.
    
    Known Patterns:
    - email: For finding or validating any generic email addresses.
    - url: For finding or validating any generic URLs.
    - ipv4: For IPv4 addresses (e.g., 192.168.1.1).
    - ipv6: For IPv6 addresses.
    - duplicate_words: For finding repeated words next to each other.
    - multiple_spaces: For finding blocks of 2 or more spaces.
    - tabs_to_spaces: For finding tabs to replace them with spaces.
    - numbers: For finding integers or decimal numbers.
    - unknown: For any query that is more specific than the general patterns above.
    
    **CRITICAL RULE:** If the user's query is a specific *type* of a general category, you MUST classify it as 'unknown'. The 'unknown' classification will pass the query to a more powerful, general-purpose generator that can handle the specifics. Only classify as a known pattern if the user asks for the generic, broad case.

    Examples:
    - "find an email address" -> 'email'
    - "find a gmail address" -> 'unknown' (This is a specific type of email)
    - "match a URL" -> 'url'
    - "extract a YouTube video ID from a URL" -> 'unknown' (This is a specific task related to URLs)
    - "найти ЛЮБОЙ YOUTUBE ID" -> 'unknown'
    - "find any number" -> 'numbers'
    - "find a 5-digit number" -> 'unknown' (This is a specific type of number)
    - "find duplicate words" -> 'duplicate_words'
    
    If the user asks to validate something, still classify it by the pattern type (e.g., "validate email" -> 'email'). The system will handle the generation logic.
    
    User Query: {{{query}}}
    `,
});

// The main flow that orchestrates everything
export async function generateRegexFromNaturalLanguage(input: NaturalLanguageRegexInput): Promise<NaturalLanguageRegexOutput> {
  const { output: route } = await routerPrompt(input);

  if (route && route.pattern !== 'unknown') {
    let blocks: Block[] = [];
    let explanation = "";
    let exampleTestText = "";
    let recommendedFlags = "";

    switch (route.pattern) {
      case 'ipv4':
        blocks = generateBlocksForIPv4();
        explanation = "Находит IPv4-адреса в тексте. Этот шаблон ищет адреса, окруженные границами слов (пробелы, начало/конец строки), но не проверяет, является ли вся строка IP-адресом.";
        exampleTestText = "Primary server: 192.168.1.1, backup is 10.0.0.1. Invalid: 999.999.999.999";
        break;
      case 'ipv6':
        blocks = generateBlocksForIPv6();
        explanation = "Находит IPv6-адреса в тексте. Из-за сложности IPv6, он представлен как один блок.";
        exampleTestText = "The server at 2001:0db8:85a3::8a2e:0370:7334 is the main one.";
        break;
      case 'email':
        blocks = generateBlocksForEmail(true);
        explanation = "Находит все email-адреса в тексте, используя границы слов для точности.";
        exampleTestText = "Contact us at support@example.com or info@example.org.";
        break;
      case 'url':
        blocks = generateBlocksForURL(true, route.urlRequiresProtocol ?? false);
        explanation = "Находит все URL-адреса в тексте. Может включать или не включать требование протокола http/https.";
        exampleTestText = "Visit our site: https://www.example.com or check www.anothersite.co.uk for more info.";
        break;
      case 'duplicate_words':
         blocks = generateBlocksForDuplicateWords();
         explanation = "Находит слова, которые повторяются подряд (например, 'the the').";
         exampleTestText = "This is a a test of the the emergency system.";
         recommendedFlags = "i";
         break;
      case 'multiple_spaces':
         blocks = generateBlocksForMultipleSpaces();
         explanation = "Находит два или более пробельных символа подряд.";
         exampleTestText = "Too  many   spaces here.";
         break;
      case 'tabs_to_spaces':
          blocks = generateBlocksForTabsToSpaces();
          explanation = "Находит символы табуляции.";
          exampleTestText = "Column1\tColumn2\tColumn3";
          break;
      case 'numbers':
          blocks = generateBlocksForNumbers();
          explanation = "Находит целые или десятичные числа, включая отрицательные. Использует границы слов, чтобы не совпадать с числами, являющимися частью слов.";
          exampleTestText = "The values are -10, 3.14, and 42. But not value123.";
          break;
    }
    
    if (blocks.length > 0) {
      const { regexString } = generateRegexStringAndGroupInfo(blocks);
      const sanitizedBlocks = correctAndSanitizeAiBlocks(blocks);
      const processedBlocks = breakdownComplexCharClasses(sanitizedBlocks);
      const finalBlocks = processAiBlocks(processedBlocks);
      return {
        regex: regexString,
        explanation,
        parsedBlocks: finalBlocks,
        exampleTestText,
        recommendedFlags,
      };
    }
  }

  // Fallback to the general-purpose AI generator if router fails or classifies as 'unknown'
  return generalPurposeRegexGenerator(input);
}


const generalPurposeGeneratorPrompt = ai.definePrompt({
  name: 'naturalLanguageRegexPrompt',
  input: {schema: NaturalLanguageRegexInputSchema},
  output: {schema: NaturalLanguageRegexOutputSchema},
  prompt: `You are an expert Regex assistant. The user's query did not match any standard, pre-defined patterns, so you need to generate a custom regex. Based on the user's natural language query, generate an optimal and correct regular expression.
Provide the regex string itself, a concise explanation in Russian of how it works, and if possible, a structured representation of the regex as an array of 'parsedBlocks'.
Additionally, provide an 'exampleTestText' field containing a short, relevant example string that would be suitable for testing the generated regex. This text should ideally contain at least one match for the regex, but also some non-matching parts if appropriate for context.

User Query: {{{query}}}

**IMPORTANT INSTRUCTIONS:**
*   **Flags:** Do not include inline flags in the regex string (like \`(?i)\`). Instead, use the 'recommendedFlags' field in the output JSON. If the user asks for "case-insensitive", "ignore case", etc., add 'i' to the 'recommendedFlags' string. If they ask for "multiline", add 'm'. If they ask for "dot all" or "single line", add 's'. Combine flags if needed (e.g., "im"). Do NOT include the 'g' (global) flag, as the UI handles it by default.
*   **Word Boundaries:** If the user asks to find a "word", you MUST wrap the pattern in \`\\b\` anchors. Example: for "find the word cat", generate \`\\bcat\\b\`.

The 'parsedBlocks' structure should be an array of objects. Each object must have:
1.  "type": A string enum indicating the block type from this list: ${Object.values(BlockType).join(', ')}.
2.  "settings": An object with settings specific to the type. Examples:
    *   For "LITERAL": \`{"text": "your_literal_text"}\`. IMPORTANT: For special regex characters that should be treated as plain text (e.g., a literal dot '.'), provide the literal character itself: \`{"text": "."}\`. My backend will handle escaping. For special characters like \`\\d\`, \`\\s\`, \`^\`, \`$\`, DO NOT use a LITERAL block. Use CHARACTER_CLASS or ANCHOR instead.
    *   For "CHARACTER_CLASS": \`{"pattern": "a-zA-Z0-9", "negated": false}\`. For shorthands like "any digit", use \`{"type": "CHARACTER_CLASS", "settings": {"pattern": "\\\\d"}}\`. For a single dot matching any character, use \`{"type": "CHARACTER_CLASS", "settings": {"pattern": "."}}\`.
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

// This flow is now the fallback for general-purpose requests.
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
