
import type { Block, RegexStringPart, GroupInfo } from './types';
import { BlockType } from './types';
import type { CharacterClassSettings, LiteralSettings, QuantifierSettings, AnchorSettings, LookaroundSettings, BackreferenceSettings, ConditionalSettings, GroupSettings } from './types';

export const generateId = (): string => Math.random().toString(36).substring(2, 11);

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

export const createLiteral = (text: string, isRawRegex = false): Block => ({
  id: generateId(), type: BlockType.LITERAL, settings: {text, isRawRegex} as LiteralSettings, children: [], isExpanded: false
});

export const reconstructPatternFromChildren = (children: Block[]): string => {
  return children.map(child => {
    if (child.type === BlockType.LITERAL) {
      return (child.settings as LiteralSettings).text;
    }
    if (child.type === BlockType.CHARACTER_CLASS) {
      return (child.settings as CharacterClassSettings).pattern;
    }
    return '';
  }).join('');
};

export const processAiBlocks = (aiBlocks: any[]): Block[] => {
  if (!aiBlocks || !Array.isArray(aiBlocks)) {
    return [];
  }

  const validAiBlocks = aiBlocks.filter(b => b && typeof b === 'object' && Object.values(BlockType).includes(b.type));

  return validAiBlocks.map((aiBlock: any): Block => {
    const newBlock: Block = {
      id: generateId(),
      type: aiBlock.type as BlockType,
      settings: aiBlock.settings || {},
      children: [],
      isExpanded: false,
    };

    if (aiBlock.children && Array.isArray(aiBlock.children)) {
      newBlock.children = processAiBlocks(aiBlock.children);
    }

    const containerTypes: string[] = [ 
      BlockType.GROUP,
      BlockType.LOOKAROUND,
      BlockType.ALTERNATION,
      BlockType.CONDITIONAL,
      BlockType.CHARACTER_CLASS,
    ];
    if (containerTypes.includes(newBlock.type!)) {
      newBlock.isExpanded = true;
    }
    
    // Basic settings validation to prevent crashes
    switch (newBlock.type) {
        case BlockType.LITERAL:
            if (typeof newBlock.settings?.text !== 'string') newBlock.settings = { text: '' };
            break;
        case BlockType.CHARACTER_CLASS:
            if (typeof newBlock.settings?.pattern !== 'string') newBlock.settings = { ...newBlock.settings, pattern: '' };
            if (typeof newBlock.settings?.negated !== 'boolean') newBlock.settings = { ...newBlock.settings, negated: false };
            break;
        case BlockType.QUANTIFIER:
            if (typeof newBlock.settings?.type !== 'string') newBlock.settings = { ...newBlock.settings, type: '*' };
            if (!['greedy', 'lazy', 'possessive'].includes(newBlock.settings?.mode)) newBlock.settings = { ...newBlock.settings, mode: 'greedy' };
            if (newBlock.settings?.type?.includes('{')) {
                if (typeof newBlock.settings?.min !== 'number') newBlock.settings.min = 0;
                if (newBlock.settings?.max === undefined) newBlock.settings.max = null; 
            }
            break;
        case BlockType.GROUP:
            if (!['capturing', 'non-capturing', 'named'].includes(newBlock.settings?.type)) newBlock.settings = { ...newBlock.settings, type: 'capturing' };
            if (newBlock.settings?.type === 'named' && typeof newBlock.settings?.name !== 'string') newBlock.settings.name = '';
            break;
        case BlockType.ANCHOR:
             if (typeof newBlock.settings?.type !== 'string' || !['^', '$', '\\b', '\\B'].includes(newBlock.settings?.type)) {
                newBlock.settings = { ...newBlock.settings, type: '^' };
             }
            break;
        default:
            break;
    }

    return newBlock;
  });
};

export const isRegexValid = (regex: string): boolean => {
  if (!regex) return false;
  try {
    new RegExp(regex);
    return true;
  } catch (e) {
    return false;
  }
};

// --- These functions are intentionally left empty or simplified after refactoring ---

export const breakdownComplexCharClasses = (blocks: Block[]): Block[] => {
    return blocks;
};

export const correctAndSanitizeAiBlocks = (blocks: Block[]): Block[] => {
    return blocks;
};

// This function combines adjacent literal blocks into a single block.
export const combineLiterals = (blocks: Block[]): Block[] => {
  if (!blocks || blocks.length === 0) {
    return [];
  }

  const newBlocks: Block[] = [];
  let currentLiteral: Block | null = null;

  for (const block of blocks) {
    // If we have a non-raw literal and there's a current literal being built
    if (block.type === BlockType.LITERAL && !(block.settings as LiteralSettings).isRawRegex) {
      if (currentLiteral) {
        // Append text to the current literal
        (currentLiteral.settings as LiteralSettings).text += (block.settings as LiteralSettings).text;
      } else {
        // Start a new literal block
        currentLiteral = cloneBlockForState(block);
      }
    } else {
      // If we encounter a non-literal block, push the current literal (if it exists)
      if (currentLiteral) {
        newBlocks.push(currentLiteral);
        currentLiteral = null;
      }
      // Push the current non-literal block, and recursively combine its children
      const newBlock = { ...block };
      if (newBlock.children) {
        newBlock.children = combineLiterals(newBlock.children);
      }
      newBlocks.push(newBlock);
    }
  }

  // Push any remaining literal at the end
  if (currentLiteral) {
    newBlocks.push(currentLiteral);
  }

  return newBlocks;
};

export const findBlockAndParent = (
  nodes: Block[],
  id: string,
  parent: Block | null = null
): { block: Block | null; parent: Block | null } => {
  for (const node of nodes) {
    if (node.id === id) {
      return { block: node, parent: parent };
    }
    if (node.children) {
      const found = findBlockAndParent(node.children, id, node);
      if (found.block) {
        return found;
      }
    }
  }
  return { block: null, parent: null };
};
