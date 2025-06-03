

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
      createCharClass('[\\w.%+-]+', false), // Allow common email chars, including dot, percent, plus, hyphen
      createLiteral('@', false),
      createCharClass('[A-Za-z0-9.-]+', false), // Domain name parts
      createLiteral('\\.', false),
      createCharClass('[A-Za-z]{2,}', false), // TLD, at least 2 letters
    ];
    if(forExtraction) {
        return [createAnchor('\\b'), createSequenceGroup(emailCoreBlocks, 'capturing'), createAnchor('\\b')];
    }
    return [createAnchor('^'), ...emailCoreBlocks, createAnchor('$')];
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

