
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
import type { Block, CharacterClassSettings, GroupSettings, LiteralSettings, AnchorSettings } from '@/components/regex-vision/types';
import { BlockType } from '@/components/regex-vision/types';
import { generateBlocksForIPv4, generateBlocksForIPv6, generateBlocksForEmail, generateBlocksForURL, generateBlocksForDuplicateWords, generateBlocksForMultipleSpaces, generateBlocksForTabsToSpaces, generateBlocksForNumbers, generateRegexStringAndGroupInfo, generateId } from '@/components/regex-vision/utils';

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
            const text = settings.text || '';

            const knownCharClasses = ['\\d', '\\D', '\\w', '\\W', '\\s', '\\S', '.'];
            if (knownCharClasses.includes(text)) {
                correctedBlock.type = BlockType.CHARACTER_CLASS;
                correctedBlock.settings = { pattern: text, negated: false } as CharacterClassSettings;
                return correctedBlock;
            }

            const knownAnchors = ['^', '$', '\\b', '\\B'];
            if (knownAnchors.includes(text)) {
                correctedBlock.type = BlockType.ANCHOR;
                correctedBlock.settings = { type: text } as AnchorSettings;
                return correctedBlock;
            }
            
            // Handle escaped literals like \. or \+
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
    forValidation: z.boolean().optional().describe("Set to true if the user wants to validate a whole string (e.g., 'is this an email?'). Set to false or omit if they want to find/extract patterns from a larger text (e.g., 'find all emails')."),
    urlRequiresProtocol: z.boolean().optional().describe("For URL patterns, set to true if the user explicitly requires http/https.")
});

const routerPrompt = ai.definePrompt({
  name: 'regexRouterPrompt',
  input: { schema: NaturalLanguageRegexInputSchema },
  output: { schema: RouterOutputSchema },
  prompt: `You are a regex query classifier. Analyze the user's query and classify it into one of the known patterns.
    
    Known Patterns:
    - email: For finding or validating email addresses.
    - url: For finding or validating URLs.
    - ipv4: For IPv4 addresses (e.g., 192.168.1.1).
    - ipv6: For IPv6 addresses.
    - duplicate_words: For finding repeated words next to each other.
    - multiple_spaces: For finding blocks of 2 or more spaces.
    - tabs_to_spaces: For finding tabs to replace them with spaces.
    - numbers: For finding integers or decimal numbers.
    
    Also determine the user's intent:
    - 'forValidation': Does the user want to check if the *entire string* matches the pattern? (e.g., "validate this string is an email", "is this an ipv4", "check if password is valid"). This usually implies using ^ and $ anchors.
    - 'extraction' (forValidation: false): Does the user want to *find all occurrences* within a larger text? (e.g., "extract all emails from this log file", "find all numbers"). This usually implies using word boundaries (\\b) or no anchors.
    
    If the query doesn't match any known pattern, classify it as 'unknown'.
    
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

    switch (route.pattern) {
      case 'ipv4':
        blocks = generateBlocksForIPv4(route.forValidation ?? false);
        explanation = "Проверяет или находит IPv4-адреса. Этот базовый шаблон проверяет структуру (4 группы цифр по 1-3 в каждой, разделенные точками), но не диапазон 0-255.";
        exampleTestText = "Valid: 192.168.1.1. Invalid: 999.0.0.256 or 127.0.0.1.3";
        break;
      case 'ipv6':
        blocks = generateBlocksForIPv6(route.forValidation ?? false);
        explanation = "Проверяет или находит IPv6-адреса. Из-за сложности IPv6, он представлен как один блок.";
        exampleTestText = "Valid: 2001:0db8:85a3:0000:0000:8a2e:0370:7334";
        break;
      case 'email':
        blocks = generateBlocksForEmail(route.forValidation === false);
        explanation = route.forValidation ? "Проверяет, является ли строка валидным email-адресом." : "Находит все email-адреса в тексте.";
        exampleTestText = "Contact us at support@example.com or info@example.org.";
        break;
      case 'url':
        blocks = generateBlocksForURL(route.forValidation === false, route.urlRequiresProtocol ?? false);
        explanation = route.forValidation ? "Проверяет, является ли строка валидным URL." : "Находит все URL-адреса в тексте.";
        exampleTestText = "Visit our site: https://www.example.com or check http://example.org";
        break;
      case 'duplicate_words':
         blocks = generateBlocksForDuplicateWords();
         explanation = "Находит слова, которые повторяются подряд (например, 'the the').";
         exampleTestText = "This is a a test of the the emergency system.";
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
          explanation = "Находит целые или десятичные числа, включая отрицательные.";
          exampleTestText = "The values are -10, 3.14, and 42.";
          break;
    }
    
    if (blocks.length > 0) {
      const { regexString } = generateRegexStringAndGroupInfo(blocks);
      const sanitizedBlocks = correctAndSanitizeAiBlocks(blocks);
      const processedBlocks = breakdownComplexCharClasses(sanitizedBlocks);
      return {
        regex: regexString,
        explanation,
        parsedBlocks: processedBlocks,
        exampleTestText,
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
Provide the regex string itself, a concise explanation of how it works, and if possible, a structured representation of the regex as an array of 'parsedBlocks'.
Additionally, provide an 'exampleTestText' field containing a short, relevant example string that would be suitable for testing the generated regex. This text should ideally contain at least one match for the regex, but also some non-matching parts if appropriate for context.

User Query: {{{query}}}

The 'parsedBlocks' structure should be an array of objects. Each object must have:
1.  "type": A string enum indicating the block type from this list: ${Object.values(BlockType).join(', ')}.
2.  "settings": An object with settings specific to the type. Examples:
    *   For "LITERAL": \`{"text": "your_literal_text"}\`. IMPORTANT: For special regex characters that should be treated as plain text (e.g., a literal dot '.'), provide the literal character itself: \`{"text": "."}\`. My backend will handle escaping. For special characters like \`\\d\`, \`\\s\`, \`^\`, \`$\`, DO NOT use a LITERAL block. Use CHARACTER_CLASS or ANCHOR instead.
    *   For "CHARACTER_CLASS": \`{"pattern": "a-zA-Z0-9", "negated": false}\`. For shorthands like "any digit", use \`{"type": "CHARACTER_CLASS", "settings": {"pattern": "\\\\d"}}\`. For a single dot matching any character, use \`{"type": "CHARACTER_CLASS", "settings": {"pattern": "."}}\`.
    *   For "QUANTIFIER": \`{"type": "*", "mode": "greedy"}\` (type can be '*', '+', '?', '{n}', '{n,}', '{n,m}'). If type is '{n}', '{n,}', or '{n,m}', include "min" and "max" (if applicable) in settings, e.g., \`{"type": "{n,m}", "min": 1, "max": 5, "mode": "greedy"}\`.
    *   For "GROUP": \`{"type": "capturing"}\`, \`{"type": "non-capturing"}\`, or \`{"type": "named", "name": "groupName"}\`.
    *   For "ANCHOR": \`{"type": "^"}\` (type can be '^', '$', '\\b', '\\B').
    *   For "LOOKAROUND": \`{"type": "positive-lookahead"}\` (types: 'positive-lookahead', 'negative-lookahead', 'positive-lookbehind', 'negative-lookbehind').
    *   For "BACKREFERENCE": \`{"ref": "1"}\` or \`{"ref": "groupName"}\`.
3.  "children": An array of block objects, ONLY for container types ("GROUP", "ALTERNATION", "LOOKAROUND", "CONDITIONAL"). For other types, "children" should be an empty array or omitted.

CRITICAL INSTRUCTION: Instead of creating a single large LITERAL block with regex characters inside, you MUST break it down into smaller, semantic blocks. For example, for "a number between 0 and 255", do not create a LITERAL with text "(?:25[0-5]|...))". Instead, create a non-capturing GROUP containing an ALTERNATION of smaller blocks. For "IPv4 address", generate a sequence of blocks representing each octet and dot, not one large literal.

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
    
    let processedBlocks: Block[] = [];
    if (output.parsedBlocks) {
      const correctedBlocks = correctAndSanitizeAiBlocks(output.parsedBlocks);
      processedBlocks = breakdownComplexCharClasses(correctedBlocks);
    }

    return {
        ...output,
        parsedBlocks: processedBlocks,
        exampleTestText: output.exampleTestText || "Пример текста не был предоставлен AI."
    };
  }
);
