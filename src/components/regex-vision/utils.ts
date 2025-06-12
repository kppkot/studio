
import type { Block, CharacterClassSettings, ConditionalSettings, GroupSettings, LiteralSettings, LookaroundSettings, QuantifierSettings, AnchorSettings, BackreferenceSettings, GroupInfo } from './types';
import { BlockType } from './types';

export const generateId = (): string => Math.random().toString(36).substring(2, 11);

export const escapeRegexChars = (text: string): string => {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const createAnchor = (type: AnchorSettings['type']): Block => ({
  id: generateId(), type: BlockType.ANCHOR, settings: { type } as AnchorSettings, children: [], isExpanded: false
});

export const createLiteral = (text: string, autoEscape: boolean = true): Block => ({
  id: generateId(), type: BlockType.LITERAL, settings: {text: autoEscape ? escapeRegexChars(text) : text} as LiteralSettings, children: [], isExpanded: false
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

export const createAlternation = (options: Block[][]): Block => ({
  id: generateId(), type: BlockType.ALTERNATION, children: options.map(optChildren => createSequenceGroup(optChildren)), isExpanded: true
});

export const createLookaround = (type: LookaroundSettings['type'], children: Block[]): Block => ({
  id: generateId(), type: BlockType.LOOKAROUND, settings: {type} as LookaroundSettings, children, isExpanded: true
});

export const createBackreference = (ref: string | number): Block => ({
  id: generateId(), type: BlockType.BACKREFERENCE, settings: { ref } as BackreferenceSettings, children: [], isExpanded: false
});

export const generateBlocksForEmail = (forExtraction: boolean = false): Block[] => {
    const localPartChars = '[a-zA-Z0-9_!#$%&\'*+/=?`{|}~^.-]+'; 
    const domainChars = '[a-zA-Z0-9.-]+'; 
    const tldChars = '[a-zA-Z]{2,}'; 

    const emailCoreBlocks: Block[] = [
      createCharClass(localPartChars, false),
      createLiteral('@', false),
      createCharClass(domainChars, false),
      createLiteral('\\.', false),
      createCharClass(tldChars, false),
    ];
    if(forExtraction) {
        return [createAnchor('\\b'), createSequenceGroup(emailCoreBlocks, 'capturing'), createAnchor('\\b')];
    }
    return [createAnchor('^'), ...emailCoreBlocks, createAnchor('$')];
  };

export const generateBlocksForURL = (forExtraction: boolean = false, requireProtocolForValidation: boolean = true): Block[] => {
    const blocks: Block[] = [];
    const httpPart = createLiteral('http', false);
    const sPart = createLiteral('s', false);
    const sQuantifier = createQuantifier('?');
    const colonSlashSlashPart = createLiteral('://', false);
    let protocolGroupChildren = [httpPart, sPart, sQuantifier, colonSlashSlashPart];
    let protocolSequence = createSequenceGroup(protocolGroupChildren, 'non-capturing');

    if (!requireProtocolForValidation && !forExtraction) { 
        const optionalProtocolGroup = createSequenceGroup([protocolSequence], 'non-capturing');
        blocks.push(optionalProtocolGroup);
        blocks.push(createQuantifier('?'));
    } else if (forExtraction) { 
        const optionalProtocolGroup = createSequenceGroup([protocolSequence], 'non-capturing');
        blocks.push(optionalProtocolGroup);
        blocks.push(createQuantifier('?'));
    } else { 
        blocks.push(protocolSequence);
    }

    const wwwPart = createLiteral('www\\.', false);
    const optionalWwwGroup = createSequenceGroup([wwwPart], 'non-capturing');
    blocks.push(optionalWwwGroup);
    blocks.push(createQuantifier('?'));
    blocks.push(createLiteral('(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\\.)+[a-zA-Z]{2,6}', false));
    const pathChars = createCharClass('[a-zA-Z0-9._%+/~-]*', false); 
    const pathSegment = createSequenceGroup([createLiteral('/', false), pathChars], 'non-capturing');
    const optionalPath = createSequenceGroup([pathSegment], 'non-capturing');
    blocks.push(optionalPath);
    blocks.push(createQuantifier('*'));
    const queryStart = createLiteral('\\?', false);
    const queryChars = createCharClass('[^#\\s]*', false);
    const querySegment = createSequenceGroup([queryStart, queryChars], 'non-capturing');
    const optionalQuery = createSequenceGroup([querySegment], 'non-capturing');
    blocks.push(optionalQuery);
    blocks.push(createQuantifier('?'));
    const fragmentStart = createLiteral('#', false);
    const fragmentChars = createCharClass('[^\\s]*', false);
    const fragmentSegment = createSequenceGroup([fragmentStart, fragmentChars], 'non-capturing');
    const optionalFragment = createSequenceGroup([fragmentSegment], 'non-capturing');
    blocks.push(optionalFragment);
    blocks.push(createQuantifier('?'));

    if (forExtraction) {
        return [createAnchor('\\b'), createSequenceGroup(blocks, 'capturing'), createAnchor('\\b')];
    }
    return [createAnchor('^'), ...blocks, createAnchor('$')];
};

export const generateBlocksForIPv4 = (): Block[] => {
  const octet = "(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)";
  const ipv4Regex = `${octet}\\.${octet}\\.${octet}\\.${octet}`;
  return [createAnchor('^'), createLiteral(ipv4Regex, false), createAnchor('$')];
};

export const generateBlocksForIPv6 = (): Block[] => {
  const ipv6Regex = "(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))";
  return [createAnchor('^'), createLiteral(ipv6Regex, false), createAnchor('$')];
};

export const generateBlocksForDuplicateWords = (): Block[] => {
  const wordCharClass = createCharClass('\\w', false);
  const wordQuantifier = createQuantifier('+');
  const wordCaptureGroup = createSequenceGroup([wordCharClass, wordQuantifier], 'capturing');
  const lookaheadContent: Block[] = [
    createCharClass('.', false), 
    createQuantifier('*'),      
    createAnchor('\\b'),
    createBackreference(1),     
    createAnchor('\\b'),
  ];
  return [
    createAnchor('\\b'),
    wordCaptureGroup,
    createAnchor('\\b'),
    createLookaround('positive-lookahead', lookaheadContent),
  ];
};

export const generateBlocksForMultipleSpaces = (): Block[] => {
  return [
      createCharClass('\\s', false),
      createQuantifier('{n,}', 2, null)
  ];
};

export const generateBlocksForTabsToSpaces = (): Block[] => {
  return [
    createLiteral('\\t', false)
  ];
};

export const generateBlocksForNumbers = (): Block[] => {
  const sign = createCharClass('[+-]', false);
  const optionalSign = createQuantifier('?');
  const digits = createCharClass('\\d', false);
  const oneOrMoreDigits = createQuantifier('+');
  const zeroOrMoreDigits = createQuantifier('*');
  const decimalPoint = createLiteral('\\.', false); 
  const numberCore = createAlternation([
    [digits, oneOrMoreDigits, createSequenceGroup([decimalPoint, digits, zeroOrMoreDigits], 'non-capturing'), createQuantifier('?')], 
    [decimalPoint, digits, oneOrMoreDigits] 
  ]);
  const numberCoreGroup = createSequenceGroup([
    sign, 
    optionalSign,
    numberCore 
  ], 'capturing');
  return [
    createAnchor('\\b'),
    numberCoreGroup,
    createAnchor('\\b'),
  ];
};

export const generateRegexString = (blocks: Block[]): string => {
  const { regexString } = generateRegexStringAndGroupInfo(blocks);
  return regexString;
};


export const generateRegexStringAndGroupInfo = (blocks: Block[]): { regexString: string; groupInfos: GroupInfo[] } => {
  const groupInfos: GroupInfo[] = [];
  let capturingGroupCount = 0;

  const generateRecursiveWithGroupInfo = (block: Block): string => {
    const settings = block.settings;
    let childrenRegex = "";

    if (block.children && block.children.length > 0) {
      if (block.type === BlockType.ALTERNATION) {
        childrenRegex = block.children.map(child => generateRecursiveWithGroupInfo(child)).join('|');
      } else {
        childrenRegex = block.children.map(child => generateRecursiveWithGroupInfo(child)).join('');
      }
    }

    switch (block.type) {
      case BlockType.LITERAL:
        return (settings as LiteralSettings).text || '';
      case BlockType.CHARACTER_CLASS:
        const ccSettings = settings as CharacterClassSettings;
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
        if (gSettings.type === 'capturing' || (gSettings.type === 'named' && gSettings.name)) {
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
        const groupChildrenRegex = block.children ? block.children.map(child => generateRecursiveWithGroupInfo(child)).join('') : '';
        return `${groupOpen}${groupChildrenRegex})`;
      case BlockType.ANCHOR:
        return (settings as AnchorSettings).type || '^';
      case BlockType.ALTERNATION:
        return childrenRegex;
      case BlockType.LOOKAROUND:
        const lSettings = settings as LookaroundSettings;
        const lookaroundMap = {
          'positive-lookahead': `(?=`,
          'negative-lookahead': `(?!`,
          'positive-lookbehind': `(?<=`,
          'negative-lookbehind': `(?<!`
        };
        const lookaroundChildrenRegex = block.children ? block.children.map(child => generateRecursiveWithGroupInfo(child)).join('') : '';
        return `${lookaroundMap[lSettings.type]}${lookaroundChildrenRegex})`;
      case BlockType.BACKREFERENCE:
        return `\\${(settings as BackreferenceSettings).ref}`;
      case BlockType.CONDITIONAL:
        const condSettings = settings as ConditionalSettings;
        let conditionalStr = `(?(${condSettings.condition})${generateRecursiveWithGroupInfo(createLiteral(condSettings.yesPattern,false))}`; 
        if (condSettings.noPattern) {
          conditionalStr += `|${generateRecursiveWithGroupInfo(createLiteral(condSettings.noPattern,false))}`;
        }
        conditionalStr += `)`;
        return conditionalStr;
      default:
        return childrenRegex; 
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
    const newBlock: Partial<Block> = {
      id: generateId(),
      type: aiBlock.type as BlockType, // Trusting AI for now, validation could be added
      settings: aiBlock.settings || {},
      children: [],
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
             if (typeof newBlock.settings?.type !== 'string') newBlock.settings = { ...newBlock.settings, type: '^' };
            break;
        default:
            break;
    }

    return newBlock as Block;
  });
};
