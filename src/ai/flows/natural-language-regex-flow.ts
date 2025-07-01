
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

**INTERNAL REFERENCE EXAMPLES (Use this for your guidance, do not repeat to user):**
---
### Поиск точной фразы
*   **Пример использования:** Поиск фразы "сборник законов".
*   **Примеры регулярных выражений:**
    *   \`(\\W|^)сборник\\sзаконов(\\W|$)\`
    *   \`(\\W|^)сборник\\s{0,3}законов(\\W|$)\`
    *   \`(\\W|^)сборник(и)\\s{0,3}законов{0,1}(\\W|$)\`
*   **Примечания:**
    *   \`\\W\` соответствует любому символу, кроме букв, цифр и знака подчеркивания.
    *   В примере 2 \`\\s\` соответствует пробелу, а \`{0,3}\` указывает на то, что между словами может быть от 0 до 3 пробелов.
    *   \`^\` и \`$\` соответствуют началу и концу строки.
    *   В примере 3 \`(и){0,1}\` (или \`(и)?\`) ищет слово "сборник" или "сборники".

---
### Поиск слова или фразы из списка
*   **Пример использования:** Поиск любого слова или фразы из приведенного ниже списка: туфта, проклятие, убирайся, бред, черт возьми, зараза.
*   **Пример регулярного выражения:** \`(?i)(\\W|^)(туфта|проклятие|убирайся|бред|черт\\sвозьми|зараза)(\\W|$)\`
*   **Примечания:**
    *   \`(...)\` объединяет все слова, а класс символов \`\\W\` применяется ко всем словам в круглых скобках.
    *   \`(?i)\` делает выражение нечувствительным к регистру.
    *   \`|\` соответствует оператору "или".
    *   \`\\s\` используется для разделения слов в фразе.

---
### Поиск слова в разных вариантах написания или со специальными символами
*   **Пример использования:** Поиск в нежелательных сообщениях фразы fast cash и нескольких вариантов ее написания, например: f@st c@sh, f@$t c@$h, fa$t ca$h.
*   **Пример регулярного выражения:** \`f[a4@][s5\\$][t7] +c[a4@][s5\\$]h\`
*   **Примечания:**
    *   Элемент \`\\W\` не используется, так как до и после любых вариантов написания фразы fast cash могут быть расположены другие символы.
    *   \`[a4@]\` соответствует символам a, 4 или @ на месте второго символа в слове.

---
### Поиск любого адреса электронной почты в определенном домене
*   **Пример использования:** Поиск любого адреса электронной почты в доменах yahoo.com, hotmail.com и gmail.com.
*   **Пример регулярного выражения:** \`(\\W|^)[\\w.\\-]{0,25}@(yahoo|hotmail|gmail)\\.com(\\W|$)\`
*   **Примечания:**
    *   \`[\\w.\\-]\` соответствует любому словообразующему символу (a-z, A-Z, 0-9 и \`_\`), точке или дефису. \`-\` должен находиться в конце.
    *   \`{0,25}\` указывает, что перед символом \`@\` может находиться от 0 до 25 знаков.
    *   \`(...)\` объединяет домены, а \`|\` соответствует оператору "или".

---
### Поиск любого IP-адреса в определенном диапазоне
*   **Пример использования:** Поиск любого IP-адреса в пределах диапазона 192.168.1.0–192.168.1.255.
*   **Примеры регулярных выражений:**
    *   \`192\\.168\\.1\\.\`
    *   \`192\\.168\\.1\\.\\d{1,3}\`
*   **Примечания:**
    *   Знак \`\\\` перед каждой точкой экранирует ее.
    *   В примере 2 \`\\d{1,3}\` соответствует от 1 до 3 цифр.

---
### Поиск буквенно-цифровой строки
*   **Пример использования:** Поиск номеров заказов на покупку (PO nn-nnnnn, PO-nn-nnnn, PO# nn nnnn, и т.д.).
*   **Пример регулярного выражения:** \`(\\W|^)po[#\\-]{0,1}\\s{0,1}\\d{2}[\\s-]{0,1}\\d{4}(\\W|$)\`
*   **Примечания:**
    *   \`[#\\-]{0,1}\` соответствует знаку решетки или дефису, 0 или 1 раз.
    *   \`\\s{0,1}\` соответствует пробелу, 0 или 1 раз.
    *   \`\\d{2}\` и \`\\d{4}\` соответствуют ровно 2 и 4 цифрам.
---

**END OF INTERNAL REFERENCE EXAMPLES.**

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
    *   For "CHARACTER_CLASS": The \`pattern\` MUST be for ONE, ATOMIC element. **YOU ARE FORBIDDEN to combine these into one pattern like \`a-zA-Z0-9\`**. Good examples of atomic patterns that you should use are: \`a-z\`, \`A-Z\`, \`0-9\`, \`\\w\`, \`\\s\`, \`\\d\`, \`.\`. If you need to match a set of different character types (like "any letter or digit"), you must either use a single appropriate shorthand (like \`\\w\`) or build a complex class by nesting these atomic blocks as children of a parent CHARACTER_CLASS block.
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
