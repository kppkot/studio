
import type { Block, CharacterClassSettings, ConditionalSettings, GroupSettings, LiteralSettings, LookaroundSettings, QuantifierSettings, AnchorSettings, BackreferenceSettings, GroupInfo } from './types';
import { BlockType } from './types';

export const generateId = (): string => Math.random().toString(36).substring(2, 11);

const escapeRegexCharsForGenerator = (text: string): string => {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const createLiteral = (text: string, isRawRegex = false): Block => ({
  id: generateId(), type: BlockType.LITERAL, settings: {text, isRawRegex} as LiteralSettings, children: [], isExpanded: false
});

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

export const generateRegexStringAndGroupInfo = (blocks: Block[]): { regexString: string; groupInfos: GroupInfo[] } => {
  const groupInfos: GroupInfo[] = [];
  let capturingGroupCount = 0;

  const generateRecursiveWithGroupInfo = (block: Block): string => {
    const settings = block.settings;

    const processChildren = (b: Block): string => {
      if (!b.children) return "";
      if (b.type === BlockType.ALTERNATION) {
        return b.children.map(child => generateRecursiveWithGroupInfo(child)).join('|');
      }
      return b.children.map(child => generateRecursiveWithGroupInfo(child)).join('');
    };

    switch (block.type) {
      case BlockType.LITERAL:
        const litSettings = settings as LiteralSettings;
        if (litSettings.isRawRegex) {
          return litSettings.text || '';
        }
        return escapeRegexCharsForGenerator(litSettings.text || '');
      case BlockType.CHARACTER_CLASS:
        const ccSettings = settings as CharacterClassSettings;
        const specialShorthands = ['\\d', '\\D', '\\w', '\\W', '\\s', '\\S', '.'];
        if (!ccSettings.negated && specialShorthands.includes(ccSettings.pattern)) {
          return ccSettings.pattern;
        }
        if (block.children && block.children.length > 0) {
           const content = reconstructPatternFromChildren(block.children);
           return `[${ccSettings.negated ? '^' : ''}${content}]`;
        }
        return `[${ccSettings.negated ? '^' : ''}${ccSettings.pattern || ''}]`;
      case BlockType.QUANTIFIER:
        const qSettings = settings as QuantifierSettings;
        let qStr = qSettings.type || '*';
        if (qStr.includes('{')) {
          const min = qSettings.min ?? 0;
          const max = qSettings.max;
          if (qStr === '{n}') qStr = `{${min}}`;
          else if (qStr === '{n,}') qStr = `{${min},}`;
          else if (qStr === '{n,m}') qStr = `{${min},${max ?? ''}}`;
        }
        let mode = '';
        if (qSettings.mode === 'lazy') mode = '?';
        else if (qSettings.mode === 'possessive') mode = '+';
        return qStr + mode;
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
        return `${groupOpen}${processChildren(block)})`;
      case BlockType.ANCHOR:
        return (settings as AnchorSettings).type || '^';
      case BlockType.ALTERNATION:
        return processChildren(block);
      case BlockType.LOOKAROUND:
        const lSettings = settings as LookaroundSettings;
        const lookaroundMap = {
          'positive-lookahead': `(?=`,
          'negative-lookahead': `(?!`,
          'positive-lookbehind': `(?<=`,
          'negative-lookbehind': `(?<!`
        };
        return `${lookaroundMap[lSettings.type]}${processChildren(block)})`;
      case BlockType.BACKREFERENCE:
        const ref = (settings as BackreferenceSettings).ref;
        return isNaN(Number(ref)) ? `\\k<${ref}>` : `\\${ref}`;
      case BlockType.CONDITIONAL:
         const condSettings = settings as ConditionalSettings;
         const { condition, yesPattern, noPattern } = condSettings;
         const yesStr = generateRecursiveWithGroupInfo(createLiteral(yesPattern, true));
         const noStr = noPattern ? `|${generateRecursiveWithGroupInfo(createLiteral(noPattern, true))}` : '';
         return `(?(${condition})${yesStr}${noStr})`;
      default:
        return processChildren(block);
    }
  };

  const regexString = blocks.map(block => generateRecursiveWithGroupInfo(block)).join('');
  return { regexString, groupInfos };
};

export const reconstructPatternFromChildren = (children: Block[]): string => {
  if (!children) return '';
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

export const breakdownPatternIntoChildren = (pattern: string): Block[] => {
  if (!pattern) return [];

  const components: Block[] = [];
  const predefinedRanges: { [key: string]: string } = { 'a-z': 'a-z', 'A-Z': 'A-Z', '0-9': '0-9' };
  let remainingPattern = pattern;

  // This is a simplified breakdown. A more robust solution might need a more complex parser.
  // Extract predefined ranges first
  Object.keys(predefinedRanges).forEach(rangeKey => {
    if (remainingPattern.includes(rangeKey)) {
      components.push({ id: generateId(), type: BlockType.CHARACTER_CLASS, settings: { pattern: rangeKey, negated: false } as CharacterClassSettings, children: [], isExpanded: false });
      remainingPattern = remainingPattern.replace(new RegExp(rangeKey.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), '');
    }
  });
  
  // Handle special shorthands
  const specialShorthands = ['\\d', '\\D', '\\w', '\\W', '\\s', '\\S'];
  specialShorthands.forEach(shorthand => {
    const escapedShorthand = shorthand.replace('\\', '\\\\');
    if (remainingPattern.includes(shorthand)) {
      components.push({ id: generateId(), type: BlockType.CHARACTER_CLASS, settings: { pattern: shorthand, negated: false } as CharacterClassSettings, children: [], isExpanded: false });
      remainingPattern = remainingPattern.replace(new RegExp(escapedShorthand, 'g'), '');
    }
  });

  // Treat remaining characters as individual literals
  if (remainingPattern.length > 0) {
     for (const char of remainingPattern) {
       components.push({ id: generateId(), type: BlockType.LITERAL, settings: { text: char } as LiteralSettings, children: [], isExpanded: false });
    }
  }
  return components;
}

/**
 * Recursively traverses blocks and breaks down complex character classes into child blocks.
 * e.g., a CHARACTER_CLASS with pattern `[a-z0-9]` becomes a CHARACTER_CLASS
 * with children: a CHARACTER_CLASS for `a-z` and a CHARACTER_CLASS for `0-9`.
 */
export const breakdownComplexCharClasses = (blocks: Block[]): Block[] => {
  if (!blocks) return [];
  return blocks.map(block => {
    // Recurse first to handle nested blocks
    if (block.children && block.children.length > 0) {
      block.children = breakdownComplexCharClasses(block.children);
    }

    if (block.type === BlockType.CHARACTER_CLASS && (!block.children || block.children.length === 0)) {
      const settings = block.settings as CharacterClassSettings;
      const pattern = settings.pattern;
      
      const specialShorthands = ['\\d', '\\D', '\\w', '\\W', '\\s', '\\S', '.'];
      if (pattern && !specialShorthands.includes(pattern)) {
        const newChildren = breakdownPatternIntoChildren(pattern);
        
        if (newChildren.length > 1) { 
          return {
            ...block,
            settings: { ...settings, pattern: '' }, // The pattern is now represented by children
            children: newChildren,
            isExpanded: true,
          };
        }
      }
    }
    return block;
  });
};


export const processAiBlocks = (aiBlocks: any[]): Block[] => {
  if (!aiBlocks || !Array.isArray(aiBlocks)) {
    return [];
  }

  // Filter for blocks that are objects and have a valid BlockType.
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
      BlockType.CHARACTER_CLASS, // Character class can also be a container
    ];
    if (containerTypes.includes(newBlock.type!)) {
      newBlock.isExpanded = true;
    }
    
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

export const correctAndSanitizeAiBlocks = (blocks: Block[]): Block[] => {
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
                // Unescape single characters, e.g., AI gives '\-' instead of '-'
                (correctedBlock.settings as LiteralSettings).text = text.charAt(1);
            }
        }
        
        if (correctedBlock.type === BlockType.CHARACTER_CLASS) {
            const settings = correctedBlock.settings as CharacterClassSettings;
            if (settings.pattern) {
                let pattern = settings.pattern;
                // AI sometimes mistakenly wraps the pattern in brackets. Strip them.
                if (pattern.startsWith('[') && pattern.endsWith(']')) {
                    pattern = pattern.substring(1, pattern.length - 1);
                }
                 // AI sometimes mistakenly adds a quantifier to the pattern string. Strip it.
                if (pattern.length > 1 && ['?', '*', '+'].includes(pattern.slice(-1))) {
                    pattern = pattern.slice(0, -1);
                }
                
                (correctedBlock.settings as CharacterClassSettings).pattern = pattern;
            }
        }

        if (correctedBlock.children && correctedBlock.children.length > 0) {
            correctedBlock.children = correctAndSanitizeAiBlocks(correctedBlock.children);
        }

        return correctedBlock;
    });
};
