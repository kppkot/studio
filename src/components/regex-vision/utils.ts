

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
    const emailCoreBlocks: Block[] = [
      createCharClass('[a-zA-Z0-9_!#$%&\'*+/=?`{|}~^.-]+', false), 
      createLiteral('@', false),
      createCharClass('[a-zA-Z0-9.-]+', false), 
      createLiteral('\\.', false),
      createCharClass('[a-zA-Z]{2,}', false), 
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
    
    const protocolSequence = createSequenceGroup([httpPart, sPart, sQuantifier, colonSlashSlashPart], 'non-capturing');
    
    if (!forExtraction && requireProtocolForValidation) {
        blocks.push(protocolSequence);
    } else {
        // For extraction, or if protocol is not required for validation, make it optional
        const optionalProtocolGroup = createSequenceGroup([protocolSequence], 'non-capturing');
        // This structure is a bit tricky. The quantifier should apply to the protocol sequence itself.
        // A simple way is to make the group itself optional if it only contains the protocol.
        // Or, more correctly, wrap the sequence in another group and make *that* optional.
        // For now, we'll make the entire group optional if it's not required.
        // A more robust solution would be a quantifier that applies to a group block.
        // For simplicity with current block structure, let's ensure the sequence is wrapped correctly
        // and then apply a quantifier to that wrapped group if needed.
        // This might require adjustments to how quantifiers are applied to groups in generateRegexString or block structure.
        // For now, let's assume the intent is ( (?:...protocol...) ? )
        // To achieve this with current utils, we can add a quantifier after the group
        // if it's meant to be optional.
        blocks.push(optionalProtocolGroup); 
        if (forExtraction || !requireProtocolForValidation) {
             // This attempts to make the protocol group optional.
             // A proper way would be to have a parent group and quantify that.
             // For now, we'll rely on the quantifier being placed correctly or enhance createSequenceGroup.
             // Let's wrap it in an outer optional group for clarity with current tools.
             const outerOptionalProtocolGroup = createSequenceGroup([optionalProtocolGroup], 'non-capturing');
             // Add quantifier to make the outer group optional
             const optionalQuantifier = createQuantifier('?');
             // This is conceptually what we want: ( (?: ...protocol... ) )?
             // The structure needs to reflect this to be generated correctly.
             // A direct way is to ensure the quantifier is applied *after* the protocol group.
             // So, if optional: push protocolSequence, then push createQuantifier('?');
             // Re-thinking this part:
             if (blocks.length > 0 && blocks[blocks.length -1].type === BlockType.GROUP) {
                // If the last block is the protocol group, make it optional
                // This is a simplification: (protocol_group)?
                // The more general (?:https?://)?
                // This block structure assumes the quantifier applies to the immediately preceding element.
                blocks.push(createQuantifier('?'));
             }
        }
    }

    const wwwPart = createLiteral('www\\.', false);
    const optionalWwwGroup = createSequenceGroup([wwwPart], 'non-capturing');
    blocks.push(optionalWwwGroup);
    blocks.push(createQuantifier('?')); // Make www. optional

    // Domain name: alphanumeric, dot, hyphen. At least one char.
    blocks.push(createCharClass('[a-zA-Z0-9-]+', false)); 
    blocks.push(createQuantifier('+')); // Ensure domain part exists
    
    // TLD: . followed by 2 or more letters.
    blocks.push(createLiteral('\\.', false)); 
    blocks.push(createCharClass('[a-zA-Z]{2,}', false));

    // Optional path: ( / (alphanumeric, dot, hyphen, underscore, percent) * ) *
    const pathChars = createCharClass('[a-zA-Z0-9._%+/-]*', false);
    const pathSegment = createSequenceGroup([createLiteral('/', false), pathChars], 'non-capturing');
    const optionalPath = createSequenceGroup([pathSegment], 'non-capturing');
    blocks.push(optionalPath);
    blocks.push(createQuantifier('*')); // Path is optional and can repeat

    // Optional query string: ( ? (any char except newline) * )?
    const queryStart = createLiteral('\\?', false);
    const queryChars = createCharClass('[^\\s?#]*', false); // Any char except whitespace, ?, #
    const querySegment = createSequenceGroup([queryStart, queryChars], 'non-capturing');
    const optionalQuery = createSequenceGroup([querySegment], 'non-capturing');
    blocks.push(optionalQuery);
    blocks.push(createQuantifier('?'));

    // Optional fragment: ( # (any char except newline) * )?
    const fragmentStart = createLiteral('#', false);
    const fragmentChars = createCharClass('[^\\s#]*', false); // Any char except whitespace, #
    const fragmentSegment = createSequenceGroup([fragmentStart, fragmentChars], 'non-capturing');
    const optionalFragment = createSequenceGroup([fragmentSegment], 'non-capturing');
    blocks.push(optionalFragment);
    blocks.push(createQuantifier('?'));
    
    if (forExtraction) {
        return [createAnchor('\\b'), createSequenceGroup(blocks, 'capturing'), createAnchor('\\b')];
    }
    return [createAnchor('^'), ...blocks, createAnchor('$')];
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

