
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
  const integerWithOptionalDecimalPart = createSequenceGroup([
    digits,
    oneOrMoreDigits,
    createSequenceGroup([decimalPoint, digits, zeroOrMoreDigits], 'non-capturing'),
    createQuantifier('?'), 
  ], 'non-capturing');
  const decimalOnlyPart = createSequenceGroup([
    decimalPoint,
    digits,
    oneOrMoreDigits,
  ], 'non-capturing');
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

// This is the existing function from your project code
export const generateRegexString = (blocks: Block[]): string => {
  const generate = (block: Block): string => {
    const settings = block.settings;
    let childrenRegex = block.children ? block.children.map(generate).join('') : '';

    switch (block.type) {
      case BlockType.LITERAL:
        return (settings as LiteralSettings).text || '';
      case BlockType.CHARACTER_CLASS:
        const charClassSettings = settings as CharacterClassSettings;
        return `[${charClassSettings.negated ? '^' : ''}${charClassSettings.pattern || ''}]`;
      case BlockType.QUANTIFIER:
        const qSettings = settings as QuantifierSettings;
        const baseQuantifier = qSettings.type || '*';
        let modeModifier = '';
        if (qSettings.mode === 'lazy') modeModifier = '?';
        else if (qSettings.mode === 'possessive') modeModifier = '+';
        if (baseQuantifier.includes('{')) {
          const min = qSettings.min ?? 0;
          const max = qSettings.max;
          if (baseQuantifier === '{n}') return `{${min}}${modeModifier}`;
          if (baseQuantifier === '{n,}') return `{${min},}${modeModifier}`;
          if (baseQuantifier === '{n,m}') return `{${min},${max ?? ''}}${modeModifier}`;
        }
        return baseQuantifier + modeModifier;
      case BlockType.GROUP:
        const gSettings = settings as GroupSettings;
        if (gSettings.type === 'non-capturing') return `(?:${childrenRegex})`;
        if (gSettings.type === 'named' && gSettings.name) return `(?<${gSettings.name}>${childrenRegex})`;
        return `(${childrenRegex})`;
      case BlockType.ANCHOR:
        return (settings as AnchorSettings).type || '^';
      case BlockType.ALTERNATION:
        return block.children ? block.children.map(child => generate(child)).join('|') : '';
      case BlockType.LOOKAROUND:
        const lSettings = settings as LookaroundSettings;
        const lookaroundMap = {
          'positive-lookahead': `(?=${childrenRegex})`,
          'negative-lookahead': `(?!${childrenRegex})`,
          'positive-lookbehind': `(?<=${childrenRegex})`,
          'negative-lookbehind': `(?<!${childrenRegex})`
        };
        return lookaroundMap[lSettings.type] || '';
      case BlockType.BACKREFERENCE:
        const brSettings = settings as BackreferenceSettings;
        return `\\${brSettings.ref}`;
      case BlockType.CONDITIONAL:
        const condSettings = settings as ConditionalSettings;
        let conditionalStr = `(?(${condSettings.condition})${condSettings.yesPattern}`;
        if (condSettings.noPattern) {
          conditionalStr += `|${condSettings.noPattern}`;
        }
        conditionalStr += `)`;
        return conditionalStr;
      default:
        return childrenRegex;
    }
  };

  let result = "";
  for (let i = 0; i < blocks.length; i++) {
    result += generate(blocks[i]);
  }
  return result;
};


// ---- NEW FUNCTION TO ADD ----
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
        // Process children for this group before closing
        const groupChildrenRegex = block.children ? block.children.map(child => generateRecursiveWithGroupInfo(child)).join('') : '';
        return `${groupOpen}${groupChildrenRegex})`;
      case BlockType.ANCHOR:
        return (settings as AnchorSettings).type || '^';
      case BlockType.ALTERNATION:
         // For ALTERNATION, children are direct alternatives. Their individual group counts are handled by recursive calls.
         // The `childrenRegex` variable already holds the joined string of alternatives.
        return childrenRegex;
      case BlockType.LOOKAROUND:
        const lSettings = settings as LookaroundSettings;
        const lookaroundMap = {
          'positive-lookahead': `(?=`,
          'negative-lookahead': `(?!`,
          'positive-lookbehind': `(?<=`,
          'negative-lookbehind': `(?<!`
        };
        // Important: Capturing groups inside a lookaround DO NOT count towards the main regex group indices in JavaScript.
        // To correctly handle this, the `capturingGroupCount` should NOT be passed or modified by calls
        // for children of lookaround blocks. This is a complex change.
        // For now, this implementation will incorrectly increment group counts if capturing groups are inside lookarounds.
        // A proper fix would involve a more context-aware recursive generation.
        const lookaroundChildrenRegex = block.children ? block.children.map(child => generateRecursiveWithGroupInfo(child)).join('') : '';
        return `${lookaroundMap[lSettings.type]}${lookaroundChildrenRegex})`;
      case BlockType.BACKREFERENCE:
        return `\\${(settings as BackreferenceSettings).ref}`;
      case BlockType.CONDITIONAL:
        const condSettings = settings as ConditionalSettings;
        // Similar to lookarounds, conditionals can have complex group counting implications.
        // Simplifying for now.
        let conditionalStr = `(?(${condSettings.condition})${generateRecursiveWithGroupInfo(createLiteral(condSettings.yesPattern,false))}`; // Assuming yesPattern is a regex string
        if (condSettings.noPattern) {
          conditionalStr += `|${generateRecursiveWithGroupInfo(createLiteral(condSettings.noPattern,false))}`; // Assuming noPattern is a regex string
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
