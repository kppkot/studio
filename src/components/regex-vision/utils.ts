
import type { Block, CharacterClassSettings, ConditionalSettings, GroupSettings, LiteralSettings, LookaroundSettings, QuantifierSettings, AnchorSettings, BackreferenceSettings, GroupInfo, RegexStringPart } from './types';
import { BlockType } from './types';

export const generateId = (): string => Math.random().toString(36).substring(2, 11);

const escapeRegexCharsForGenerator = (text: string): string => {
  return text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
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

export const generateRegexStringAndGroupInfo = (blocks: Block[]): { 
    regexString: string;
    groupInfos: GroupInfo[];
    stringParts: RegexStringPart[];
} => {
  const groupInfos: GroupInfo[] = [];
  const stringParts: RegexStringPart[] = [];
  let capturingGroupCount = 0;

  const generateRecursive = (block: Block) => {
    console.log(`--- DEBUG: UTILS: Processing block ID ${block.id} of type ${block.type} ---`);
    console.log(`--- DEBUG: UTILS: Block settings: ${JSON.stringify(block.settings, null, 2)}`);
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
        const specialShorthands = ['\\d', '\\D', '\\w', '\\W', '\\s', '\\S', '\\p{L}'];
        if (ccSettings.pattern === '.') {
            stringParts.push({ text: '.', blockId: block.id, blockType: block.type });
            break;
        }
        let pattern;
        if (!ccSettings.negated && specialShorthands.includes(ccSettings.pattern)) {
          pattern = ccSettings.pattern;
        } else {
          const content = block.children && block.children.length > 0 ? reconstructPatternFromChildren(block.children) : ccSettings.pattern || '';
          pattern = `[${ccSettings.negated ? '^' : ''}${content}]`;
        }
        stringParts.push({ text: pattern, blockId: block.id, blockType: block.type });
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
         generateRecursive(createLiteral(yesPattern, true));
         if (noPattern) {
           stringParts.push({ text: `|`, blockId: block.id, blockType: block.type });
           generateRecursive(createLiteral(noPattern, true));
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

  Object.keys(predefinedRanges).forEach(rangeKey => {
    if (remainingPattern.includes(rangeKey)) {
      components.push({ id: generateId(), type: BlockType.CHARACTER_CLASS, settings: { pattern: rangeKey, negated: false } as CharacterClassSettings, children: [], isExpanded: false });
      remainingPattern = remainingPattern.replace(new RegExp(rangeKey.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), '');
    }
  });
  
  const specialShorthands = ['\\d', '\\D', '\\w', '\\W', '\\s', '\\S'];
  specialShorthands.forEach(shorthand => {
    const escapedShorthand = shorthand.replace('\\', '\\\\');
    if (remainingPattern.includes(shorthand)) {
      components.push({ id: generateId(), type: BlockType.CHARACTER_CLASS, settings: { pattern: shorthand, negated: false } as CharacterClassSettings, children: [], isExpanded: false });
      remainingPattern = remainingPattern.replace(new RegExp(escapedShorthand, 'g'), '');
    }
  });

  if (remainingPattern.length > 0) {
     for (const char of remainingPattern) {
       components.push({ id: generateId(), type: BlockType.LITERAL, settings: { text: char } as LiteralSettings, children: [], isExpanded: false });
    }
  }
  return components;
}

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
