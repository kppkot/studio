
/**
 * @fileOverview ARCHIVED smart dispatch logic for natural language regex generation.
 * This file contains the router-based approach that was previously used to handle
 * common regex patterns with predefined generators.
 * 
 * It is not currently active in the application but is preserved for future use.
 * To re-enable, import and use `generateRegexWithSmartDispatch` in the main flow
 * instead of the general-purpose generator.
 *
 * Codeword to reactivate: ОПТИМИЗАЦИЯ
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import type { Block, CharacterClassSettings, GroupSettings, LiteralSettings, AnchorSettings, LookaroundSettings, BackreferenceSettings, QuantifierSettings } from '@/components/regex-vision/types';
import { BlockType } from '@/components/regex-vision/types';
import { generateId, processAiBlocks, createLiteral, breakdownComplexCharClasses, correctAndSanitizeAiBlocks, isRegexValid, generateRegexStringAndGroupInfo } from '@/components/regex-vision/utils';
import type { NaturalLanguageRegexOutput } from '../schemas';

// --- Utility functions moved from utils.ts for archival ---

export const createAnchor = (type: AnchorSettings['type']): Block => ({
  id: generateId(), type: BlockType.ANCHOR, settings: { type } as AnchorSettings, children: [], isExpanded: false
});

export const createCharClass = (pattern: string, negated = false): Block => ({
  id: generateId(), type: BlockType.CHARACTER_CLASS, settings: {pattern, negated} as CharacterClassSettings, children: [], isExpanded: false
});

export const createQuantifier = (type: QuantifierSettings['type'], min?: number, max?: number | null, mode: QuantifierSettings['mode'] = 'greedy'): Block => ({
  id: generateId(), type: BlockType.QUANTIFIER, settings: {type, min, max, mode} as QuantifierSettings, children: [], isExpanded: false
});

export const createSequenceGroup = (children: Block[], type: GroupSettings['type'] = 'non-capturing', name?:string): Block => ({
  id: generateId(), type: BlockType.GROUP, settings: {type, name} as GroupSettings, children, isExpanded: true
});

export const createBackreference = (ref: string | number): Block => ({
  id: generateId(), type: BlockType.BACKREFERENCE, settings: { ref } as BackreferenceSettings, children: [], isExpanded: false
});

export const generateBlocksForEmail = (forExtraction: boolean = false): Block[] => {
    const localPart = createCharClass('a-zA-Z0-9._%+-', false);
    const localPartQuantifier = createQuantifier('+');
    const at = createLiteral('@');
    const domainPart = createCharClass('a-zA-Z0-9.-', false);
    const domainPartQuantifier = createQuantifier('+');
    const dot = createLiteral('.');
    const tldPart = createCharClass('a-zA-Z', false);
    const tldQuantifier = createQuantifier('{n,m}', 2, 6);

    const emailCoreBlocks: Block[] = [
        localPart, localPartQuantifier, at, domainPart, domainPartQuantifier, dot, tldPart, tldQuantifier
    ];
    if (forExtraction) {
        return [createAnchor('\\b'), ...emailCoreBlocks, createAnchor('\\b')];
    }
    return [createAnchor('^'), ...emailCoreBlocks, createAnchor('$')];
};

export const generateBlocksForURL = (forExtraction: boolean = false, requireProtocol: boolean = true): Block[] => {
    const protocolHttp = createLiteral('http');
    const optionalS = createQuantifier('?');
    const sWithQuantifier = createSequenceGroup([createLiteral('s'), optionalS], 'non-capturing');

    const colonSlashSlash = createLiteral('://');
    const protocolGroup = createSequenceGroup([protocolHttp, sWithQuantifier, colonSlashSlash], 'non-capturing');
    
    if (!requireProtocol) {
      protocolGroup.children.push(createQuantifier('?'));
    }

    const domainChars = createCharClass('a-zA-Z0-9.-', false);
    const domainQuant = createQuantifier('+');
    
    const pathChars = createCharClass('/a-zA-Z0-9._~:/?#\\[\\]@!$&\'()*+,;=-', false);
    const pathQuant = createQuantifier('*');
    
    const urlCore = [protocolGroup, domainChars, domainQuant, pathChars, pathQuant];
    
    if (forExtraction) {
        return [createAnchor('\\b'), ...urlCore, createAnchor('\\b')];
    }
    return [createAnchor('^'), ...urlCore, createAnchor('$')];
};

export const generateBlocksForIPv4 = (): Block[] => {
  const buildOctet = () => [
    createCharClass('\\d'),
    createQuantifier('{n,m}', 1, 3)
  ];
  
  const ipCore = [
    ...buildOctet(), createLiteral('.'),
    ...buildOctet(), createLiteral('.'),
    ...buildOctet(), createLiteral('.'),
    ...buildOctet()
  ];
  
  return [createAnchor('\\b'), ...ipCore, createAnchor('\\b')];
};

export const generateBlocksForIPv6 = (): Block[] => {
  const ipv6Regex = "(?:[0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,7}:|(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,5}(?::[0-9a-fA-F]{1,4}){1,2}|(?:[0-9a-fA-F]{1,4}:){1,4}(?::[0-9a-fA-F]{1,4}){1,3}|(?:[0-9a-fA-F]{1,4}:){1,3}(?::[0-9a-fA-F]{1,4}){1,4}|(?:[0-9a-fA-F]{1,4}:){1,2}(?::[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:(?:(?::[0-9a-fA-F]{1,4}){1,6})|:(?:(?::[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(?::[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(?:ffff(?::0{1,4}){0,1}:){0,1}(?:(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9])\\.){3,3}(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9])|(?:[0-9a-fA-F]{1,4}:){1,4}:(?:(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9])\\.){3,3}(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9])";
  const ipCore = [ { id: generateId(), type: BlockType.LITERAL, settings: { text: ipv6Regex, isRawRegex: true } as LiteralSettings, children: [], isExpanded: false } ];

  return [createAnchor('\\b'), ...ipCore, createAnchor('\\b')];
};

export const generateBlocksForDuplicateWords = (): Block[] => {
  const wordChars = createCharClass('\\w+');
  const wordGroup = createSequenceGroup([wordChars], 'capturing');
  const spaceChars = createCharClass('\\s+');
  const backreference = createBackreference(1);
  return [createAnchor('\\b'), wordGroup, spaceChars, backreference, createAnchor('\\b')];
};

export const generateBlocksForMultipleSpaces = (): Block[] => {
  return [createCharClass('\\s'), createQuantifier('{n,}', 2)];
};

export const generateBlocksForTabsToSpaces = (): Block[] => {
  return [createCharClass('\\t')];
};

export const generateBlocksForNumbers = (): Block[] => {
    const sign = createCharClass('+-');
    const optionalSign = createSequenceGroup([sign, createQuantifier('?')]);
    
    const digits = createCharClass('\\d+');
    const decimalPart = createSequenceGroup([createLiteral('.'), createCharClass('\\d+')], 'non-capturing');
    const optionalDecimal = createSequenceGroup([decimalPart, createQuantifier('?')]);
    
    const numberCore = [optionalSign, digits, optionalDecimal];
    
    return [createAnchor('\\b'), ...numberCore, createAnchor('\\b')];
};

// --- Logic moved from natural-language-regex-flow.ts ---

const NaturalLanguageRegexInputSchema = z.object({
  query: z.string().describe('The natural language query describing the desired regex.'),
});

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
export async function generateRegexWithSmartDispatch(input: z.infer<typeof NaturalLanguageRegexInputSchema>): Promise<NaturalLanguageRegexOutput> {
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
  // In a real scenario, this would call the general purpose generator.
  // This is a placeholder as this file is archived.
  console.log("Fallback to general purpose generator would happen here for query:", input.query);
  return {} as NaturalLanguageRegexOutput; // Placeholder
}
