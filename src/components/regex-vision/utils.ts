

import type { Block, BlockConfig, CharacterClassSettings, ConditionalSettings, GroupSettings, LiteralSettings, LookaroundSettings, QuantifierSettings, AnchorSettings, BackreferenceSettings } from './types';
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
    // More precise character classes for email parts
    const localPartChars = '[a-zA-Z0-9_!#$%&\'*+/=?`{|}~^.-]+'; // Common local part characters
    const domainChars = '[a-zA-Z0-9.-]+'; // Domain characters
    const tldChars = '[a-zA-Z]{2,}'; // TLD

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


    if (!requireProtocolForValidation && !forExtraction) { // Protocol optional for validation
        const optionalProtocolGroup = createSequenceGroup([protocolSequence], 'non-capturing');
        blocks.push(optionalProtocolGroup);
        blocks.push(createQuantifier('?'));
    } else if (forExtraction) { // Protocol optional for extraction
        const optionalProtocolGroup = createSequenceGroup([protocolSequence], 'non-capturing');
        blocks.push(optionalProtocolGroup);
        blocks.push(createQuantifier('?'));
    }
     else { // Protocol required for validation
        blocks.push(protocolSequence); 
    }

    const wwwPart = createLiteral('www\\.', false); 
    const optionalWwwGroup = createSequenceGroup([wwwPart], 'non-capturing');
    blocks.push(optionalWwwGroup);
    blocks.push(createQuantifier('?')); 

    // Domain name and TLD: (?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,6}
    // This is complex to build with basic blocks directly, so using a literal for it.
    blocks.push(createLiteral('(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\\.)+[a-zA-Z]{2,6}', false));


    // Path: (?:/[a-zA-Z0-9._%+-]*)*
    const pathChars = createCharClass('[a-zA-Z0-9._%+/~-]*', false); // Updated path chars
    const pathSegment = createSequenceGroup([createLiteral('/', false), pathChars], 'non-capturing');
    const optionalPath = createSequenceGroup([pathSegment], 'non-capturing');
    blocks.push(optionalPath);
    blocks.push(createQuantifier('*'));


    // Query string: (?:\?[^#\s]*)?
    const queryStart = createLiteral('\\?', false); 
    const queryChars = createCharClass('[^#\\s]*', false); 
    const querySegment = createSequenceGroup([queryStart, queryChars], 'non-capturing');
    const optionalQuery = createSequenceGroup([querySegment], 'non-capturing');
    blocks.push(optionalQuery);
    blocks.push(createQuantifier('?'));

    // Fragment: (?:#[^\s]*)?
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
    createCharClass('.', false), // Any character
    createQuantifier('*'),      // Zero or more times
    createAnchor('\\b'),
    createBackreference(1),     // Backreference to the first captured group
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
        return block.children ? block.children.map(generate).join('|') : '';
      
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

