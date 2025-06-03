

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
      createLiteral('@', false), // No need to escape @ if it's a literal block
      createCharClass(domainChars, false),
      createLiteral('\\.', false), // Dot needs escaping if it's a literal block content for regex string
      createCharClass(tldChars, false),
    ];
    if(forExtraction) {
        // For extraction, we typically want to capture the email, so a capturing group around core blocks
        return [createAnchor('\\b'), createSequenceGroup(emailCoreBlocks, 'capturing'), createAnchor('\\b')];
    }
    // For validation, ensure the whole string matches
    return [createAnchor('^'), ...emailCoreBlocks, createAnchor('$')];
  };

export const generateBlocksForURL = (forExtraction: boolean = false, requireProtocolForValidation: boolean = true): Block[] => {
    const blocks: Block[] = [];

    // Protocol: (?:https?://)? or https?://
    const httpPart = createLiteral('http', false);
    const sPart = createLiteral('s', false);
    const sQuantifier = createQuantifier('?'); // Makes 's' optional for http vs https
    const colonSlashSlashPart = createLiteral('://', false);
    const protocolSequence = createSequenceGroup([httpPart, sPart, sQuantifier, colonSlashSlashPart], 'non-capturing');

    if (forExtraction || !requireProtocolForValidation) {
        // For extraction, or if protocol is not required, make the whole protocol sequence optional
        const optionalProtocolGroup = createSequenceGroup([protocolSequence], 'non-capturing');
        blocks.push(optionalProtocolGroup);
        blocks.push(createQuantifier('?')); // Make the (?:https?://) group optional
    } else {
        blocks.push(protocolSequence); // Protocol is required for validation
    }

    // Optional www: (?:www\.)?
    const wwwPart = createLiteral('www\\.', false); // www. (dot escaped)
    const optionalWwwGroup = createSequenceGroup([wwwPart], 'non-capturing');
    blocks.push(optionalWwwGroup);
    blocks.push(createQuantifier('?')); // Make www. optional

    // Domain name: [a-zA-Z0-9-]+ (one or more alphanumeric or hyphen)
    // Followed by TLD: \.[a-zA-Z]{2,}
    // Combined to avoid issues with just hyphen or multiple hyphens:
    // [a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?  (for one part of domain)
    // For simplicity here:
    blocks.push(createCharClass('[a-zA-Z0-9-]+', false)); // Domain characters
    blocks.push(createQuantifier('+')); // At least one domain character part
    
    // TLD: (\.[a-zA-Z]{2,})+
    // More complex TLDs can exist (e.g. .co.uk). For simplicity, we'll use a basic TLD pattern.
    // This should be (?: \. [a-zA-Z]{2,})+ to handle subdomains correctly as well as TLDs.
    // For a simple wizard, \.[a-zA-Z]{2,} is often a starting point.
    // Let's go with a slightly more robust domain and TLD structure
    const domainPartWithSubdomains = createSequenceGroup([
        createCharClass('[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?', false), // subdomain or domain name part
        createLiteral('\\.', false), // dot
        createCharClass('[a-zA-Z]{2,6}', false) // TLD (common lengths)
    ], 'non-capturing');
    
    // Instead of the simple domain + TLD above, let's use a more common pattern for domain name
    // (?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,6}
    // This is a single complex literal block for simplicity in the wizard's block structure.
    blocks.push(createLiteral('(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\\.)+[a-zA-Z]{2,6}', false));


    // Optional path: (?:/[a-zA-Z0-9._%+-]*)*
    const pathChars = createCharClass('[a-zA-Z0-9._%+-]*', false); // Allowed path characters
    const pathSegment = createSequenceGroup([createLiteral('/', false), pathChars], 'non-capturing');
    const optionalPath = createSequenceGroup([pathSegment], 'non-capturing');
    blocks.push(optionalPath);
    blocks.push(createQuantifier('*')); // Path is optional and can have multiple segments

    // Optional query string: (?: \? [^#\s]* )? (any char except # and whitespace)
    const queryStart = createLiteral('\\?', false); // Escaped ?
    const queryChars = createCharClass('[^#\\s]*', false); // No # or whitespace
    const querySegment = createSequenceGroup([queryStart, queryChars], 'non-capturing');
    const optionalQuery = createSequenceGroup([querySegment], 'non-capturing');
    blocks.push(optionalQuery);
    blocks.push(createQuantifier('?'));

    // Optional fragment: (?: # [^\s]* )? (any char except whitespace)
    const fragmentStart = createLiteral('#', false);
    const fragmentChars = createCharClass('[^\\s]*', false); // No whitespace
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
  // This is a common, complex regex for IPv6.
  // It handles various forms including compressed notation and IPv4-mapped addresses.
  const ipv6Regex = "(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))";
  return [createAnchor('^'), createLiteral(ipv6Regex, false), createAnchor('$')];
};


export const generateRegexString = (blocks: Block[]): string => {
  const generate = (block: Block): string => {
    const settings = block.settings;
    let childrenRegex = block.children ? block.children.map(generate).join('') : '';

    switch (block.type) {
      case BlockType.LITERAL:
        // Literal text is already escaped (or not) by createLiteral
        return (settings as LiteralSettings).text || '';
      
      case BlockType.CHARACTER_CLASS:
        const charClassSettings = settings as CharacterClassSettings;
        // Pattern for char class should not be double-escaped if it contains things like \d
        // Assuming pattern is correctly formed for char class usage.
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

