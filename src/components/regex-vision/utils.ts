
import type { Block, CharacterClassSettings, ConditionalSettings, GroupSettings, LiteralSettings, LookaroundSettings, QuantifierSettings, AnchorSettings, BackreferenceSettings, GroupInfo } from './types';
import { BlockType } from './types';

export const generateId = (): string => Math.random().toString(36).substring(2, 11);

const escapeRegexCharsForGenerator = (text: string): string => {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const createAnchor = (type: AnchorSettings['type']): Block => ({
  id: generateId(), type: BlockType.ANCHOR, settings: { type } as AnchorSettings, children: [], isExpanded: false
});

export const createLiteral = (text: string): Block => ({
  id: generateId(), type: BlockType.LITERAL, settings: {text} as LiteralSettings, children: [], isExpanded: false
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

export const createAlternation = (options: Block[]): Block => ({
    id: generateId(),
    type: BlockType.ALTERNATION,
    children: options,
    isExpanded: true
});

export const createLookaround = (type: LookaroundSettings['type'], children: Block[]): Block => ({
  id: generateId(), type: BlockType.LOOKAROUND, settings: {type} as LookaroundSettings, children, isExpanded: true
});

export const createBackreference = (ref: string | number): Block => ({
  id: generateId(), type: BlockType.BACKREFERENCE, settings: { ref } as BackreferenceSettings, children: [], isExpanded: false
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
        return [createAnchor('\\b'), createSequenceGroup(emailCoreBlocks, 'capturing'), createAnchor('\\b')];
    }
    return [createAnchor('^'), ...emailCoreBlocks, createAnchor('$')];
};

export const generateBlocksForURL = (forExtraction: boolean = false, requireProtocol: boolean = true): Block[] => {
    const protocolHttp = createLiteral('http');
    const optionalS = createSequenceGroup([createLiteral('s')], 'non-capturing');
    optionalS.children.push(createQuantifier('?'));
    const colonSlashSlash = createLiteral('://');
    const protocolGroup = createSequenceGroup([protocolHttp, optionalS, colonSlashSlash], 'non-capturing');
    
    if (!requireProtocol) {
      protocolGroup.children.push(createQuantifier('?'));
    }

    const domainChars = createCharClass('a-zA-Z0-9.-', false);
    const domainQuant = createQuantifier('+');
    
    const pathChars = createCharClass('/a-zA-Z0-9._~:/?#\\[\\]@!$&\'()*+,;=-', false);
    const pathQuant = createQuantifier('*');
    
    const urlCore = [protocolGroup, domainChars, domainQuant, pathChars, pathQuant];
    
    if (forExtraction) {
        return [createAnchor('\\b'), createSequenceGroup(urlCore, 'capturing'), createAnchor('\\b')];
    }
    return [createAnchor('^'), ...urlCore, createAnchor('$')];
};

export const generateBlocksForIPv4 = (forValidation: boolean = true): Block[] => {
  // Provides a simpler, more readable, but less strict pattern.
  // Good for a wizard's starting point.
  const octet = createCharClass('\\d', false);
  const octetQuantifier = createQuantifier('{n,m}', 1, 3);
  const dot = createLiteral('.');
  
  const ipCore = [
    octet, octetQuantifier, dot,
    octet, octetQuantifier, dot,
    octet, octetQuantifier, dot,
    octet, octetQuantifier
  ];
  
  if (forValidation) {
    return [createAnchor('^'), ...ipCore, createAnchor('$')];
  }
  return [createAnchor('\\b'), ...ipCore, createAnchor('\\b')];
};

export const generateBlocksForIPv6 = (forValidation: boolean = true): Block[] => {
  // IPv6 is too complex for readable block generation. We'll provide it as a single, complex literal.
  const ipv6Regex = "(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))";
  const ipCore = [createLiteral(ipv6Regex)];
  if(forValidation) {
     return [createAnchor('^'), ...ipCore, createAnchor('$')];
  }
  return ipCore;
};

export const generateBlocksForDuplicateWords = (): Block[] => {
  const wordBoundary = createAnchor('\\b');
  const wordChars = createCharClass('\\w+', false);
  const wordGroup = createSequenceGroup([wordChars], 'capturing');
  const spaceChars = createCharClass('\\s+', false);
  const backreference = createBackreference(1);
  return [wordBoundary, wordGroup, spaceChars, backreference, wordBoundary];
};

export const generateBlocksForMultipleSpaces = (): Block[] => {
  return [createCharClass('\\s', false), createQuantifier('{n,}', 2)];
};

export const generateBlocksForTabsToSpaces = (): Block[] => {
  return [createCharClass('\\t', false)];
};

export const generateBlocksForNumbers = (): Block[] => {
    const sign = createCharClass('+-', false);
    const optionalSign = createSequenceGroup([sign, createQuantifier('?')]);
    
    const digits = createCharClass('\\d+', false);
    const decimalPart = createSequenceGroup([createLiteral('.'), createCharClass('\\d+')], 'non-capturing');
    const optionalDecimal = createSequenceGroup([decimalPart, createQuantifier('?')]);
    
    const numberCore = [optionalSign, digits, optionalDecimal];
    
    return [createAnchor('\\b'), ...numberCore, createAnchor('\\b')];
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
        return escapeRegexCharsForGenerator((settings as LiteralSettings).text || '');
      case BlockType.CHARACTER_CLASS:
        const ccSettings = settings as CharacterClassSettings;
        const specialShorthands = ['\\d', '\\D', '\\w', '\\W', '\\s', '\\S', '.'];
        if (!ccSettings.negated && specialShorthands.includes(ccSettings.pattern)) {
          return ccSettings.pattern;
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
         const yesStr = generateRecursiveWithGroupInfo(createLiteral(yesPattern));
         const noStr = noPattern ? `|${generateRecursiveWithGroupInfo(createLiteral(noPattern))}` : '';
         return `(?(${condition})${yesStr}${noStr})`;
      default:
        return processChildren(block);
    }
  };

  const regexString = blocks.map(block => generateRecursiveWithGroupInfo(block)).join('');
  return { regexString, groupInfos };
};


export const processAiBlocks = (aiBlocks: any[]): Block[] => {
  if (!aiBlocks || !Array.isArray(aiBlocks)) {
    return [];
  }
  return aiBlocks.map((aiBlock: any): Block => {
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
