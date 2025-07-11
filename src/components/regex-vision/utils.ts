
import type { Block, RegexStringPart, GroupInfo } from './types';
import { BlockType } from './types';
import type { CharacterClassSettings, LiteralSettings, QuantifierSettings, AnchorSettings, LookaroundSettings, BackreferenceSettings, ConditionalSettings, GroupSettings } from './types';

export const generateId = (): string => `id-${Math.random().toString(36).substring(2, 11)}`;

// This function takes the final block structure and generates the string from it.
// It ensures the visual representation is the source of truth for the output string.
export const generateRegexStringAndGroupInfo = (blocks: Block[]): { 
    regexString: string;
    groupInfos: GroupInfo[];
    stringParts: RegexStringPart[];
} => {
  const groupInfos: GroupInfo[] = [];
  const stringParts: RegexStringPart[] = [];
  let capturingGroupCount = 0;

  const escapeRegexCharsForGenerator = (text: string): string => {
    return text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  }

  const generateRecursive = (block: Block) => {
    const settings = block.settings;

    const processChildren = (b: Block) => {
      if (!b.children) return;
      b.children.forEach(child => generateRecursive(child));
    };

    switch (block.type) {
      case BlockType.LITERAL:
        const litSettings = settings as LiteralSettings;
        const text = litSettings.isRawRegex ? litSettings.text || '' : escapeRegexCharsForGenerator(litSettings.text || '');
        if (text) stringParts.push({ text, blockId: block.id, blockType: block.type });
        break;
      case BlockType.CHARACTER_CLASS:
        const ccSettings = settings as CharacterClassSettings;
        const pattern = ccSettings.pattern;
        
        if (['.', '\\d', '\\D', '\\w', '\\W', '\\s', '\\S', '\\p{L}'].includes(pattern)) {
             stringParts.push({ text: pattern, blockId: block.id, blockType: block.type });
        } else {
             const content = ccSettings.pattern || '';
             const fullPattern = `[${ccSettings.negated ? '^' : ''}${content}]`;
             stringParts.push({ text: fullPattern, blockId: block.id, blockType: block.type });
        }
        break;
      case BlockType.QUANTIFIER: {
        const qSettings = settings as QuantifierSettings;
        let qStr = '';
        switch (qSettings.type) {
            case '*': case '+': case '?': qStr = qSettings.type; break;
            case '{n}': qStr = `{${qSettings.min ?? 0}}`; break;
            case '{n,}': qStr = `{${qSettings.min ?? 0},}`; break;
            case '{n,m}': qStr = `{${qSettings.min ?? 0},${qSettings.max === null ? '' : qSettings.max}}`; break;
        }
        if (qStr) {
            let mode = '';
            if (qSettings.mode === 'lazy') mode = '?';
            else if (qSettings.mode === 'possessive') mode = '+';
            stringParts.push({ text: qStr + mode, blockId: block.id, blockType: block.type });
        }
        break;
      }
      case BlockType.GROUP:
        const gSettings = settings as GroupSettings;
        let groupOpen = "(";
        if (gSettings.type === 'capturing' || gSettings.type === 'named') {
          capturingGroupCount++;
          groupInfos.push({
            blockId: block.id,
            groupIndex: capturingGroupCount,
            groupName: gSettings.type === 'named' ? gSettings.name : undefined,
          });
          if (gSettings.type === 'named' && gSettings.name) {
            groupOpen = `(?<${gSettings.name}>`;
          }
        } else if (gSettings.type === 'non-capturing') {
          groupOpen = "(?:";
        }
        stringParts.push({ text: groupOpen, blockId: block.id, blockType: block.type });
        processChildren(block);
        stringParts.push({ text: ')', blockId: block.id, blockType: block.type });
        break;
      case BlockType.ANCHOR:
        stringParts.push({ text: (settings as AnchorSettings).type, blockId: block.id, blockType: block.type });
        break;
      case BlockType.ALTERNATION:
        if (!block.children || block.children.length === 0) break;
        // This is a key change: wrap the alternation's children in a non-capturing group
        // ONLY if the alternation itself is not already inside a group.
        // For now, we simplify and let the generator reflect the blocks directly.
        block.children.forEach((child, index) => {
          generateRecursive(child);
          if (index < block.children.length - 1) {
            stringParts.push({ text: '|', blockId: block.id, blockType: block.type });
          }
        });
        break;
      case BlockType.LOOKAROUND:
        const lSettings = settings as LookaroundSettings;
        const lookaroundMap = {
          'positive-lookahead': `(?=`, 'negative-lookahead': `(?!`,
          'positive-lookbehind': `(?<=`, 'negative-lookbehind': `(?<!`
        };
        stringParts.push({ text: lookaroundMap[lSettings.type], blockId: block.id, blockType: block.type });
        processChildren(block);
        stringParts.push({ text: ')', blockId: block.id, blockType: block.type });
        break;
      case BlockType.BACKREFERENCE:
        const ref = (settings as BackreferenceSettings).ref;
        const backrefText = isNaN(Number(ref)) ? `\\k<${ref}>` : `\\${ref}`;
        stringParts.push({ text: backrefText, blockId: block.id, blockType: block.type });
        break;
      case BlockType.CONDITIONAL:
         const condSettings = settings as ConditionalSettings;
         const { condition, yesPattern, noPattern } = condSettings;
         stringParts.push({ text: `(?(${condition})`, blockId: block.id, blockType: block.type });
         stringParts.push({ text: yesPattern, blockId: block.id, blockType: block.type });
         if (noPattern) {
           stringParts.push({ text: `|`, blockId: block.id, blockType: block.type });
           stringParts.push({ text: noPattern, blockId: block.id, blockType: block.type });
         }
         stringParts.push({ text: `)`, blockId: block.id, blockType: block.type });
         break;
      default:
        processChildren(block);
    }
  };

  blocks.forEach(block => generateRecursive(block));

  const regexString = stringParts.map(part => part.text).join('');
  return { regexString, groupInfos, stringParts };
};

// --- Other Utility Functions ---

export const cloneBlockForState = (block: Block): Block => {
  const newBlock: Block = {
    ...block,
    id: generateId(),
    settings: { ...block.settings },
    children: block.children ? block.children.map(child => cloneBlockForState(child)) : [],
    isExpanded: block.isExpanded,
  };
  if ([BlockType.GROUP, BlockType.LOOKAROUND, BlockType.ALTERNATION, BlockType.CONDITIONAL].includes(newBlock.type)) {
      newBlock.children = newBlock.children || [];
  }
  return newBlock;
};

export const isRegexValid = (regexString: string): boolean => {
  try {
    new RegExp(regexString);
    return true;
  } catch (e) {
    return false;
  }
};

/**
 * Traverses a tree of blocks from an AI response and ensures each block
 * has a unique ID and necessary default properties. This sanitizes the AI output.
 * @param blocks An array of Block objects, potentially without IDs.
 * @returns A sanitized array of Block objects with guaranteed unique IDs.
 */
export const processAiBlocks = (blocks: Block[]): Block[] => {
  const processed: Block[] = [];
  if (!Array.isArray(blocks)) {
    return processed;
  }
  for (const block of blocks) {
    // Skip invalid entries
    if (!block || !block.type) continue;

    const newBlock: Block = {
      ...block,
      id: generateId(),
      isExpanded: [BlockType.GROUP, BlockType.LOOKAROUND, BlockType.ALTERNATION, BlockType.CONDITIONAL].includes(block.type) ? true : undefined,
      settings: block.settings || {},
      children: block.children ? processAiBlocks(block.children) : [],
    };
    processed.push(newBlock);
  }
  return processed;
};

export const reconstructPatternFromChildren = (children: Block[]): string => {
  if (!children || children.length === 0) {
    return '';
  }
  
  return children.map(child => {
    switch(child.type) {
      case BlockType.LITERAL:
        return (child.settings as LiteralSettings).text || '';
      case BlockType.CHARACTER_CLASS:
        // This could be a shorthand like \d
        return (child.settings as CharacterClassSettings).pattern || '';
      // Other simple, non-container types could be added here if needed inside a character class
      default:
        return '';
    }
  }).join('');
};
