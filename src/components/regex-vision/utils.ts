import type { Block, BlockConfig, CharacterClassSettings, ConditionalSettings, GroupSettings, LiteralSettings, LookaroundSettings, QuantifierSettings, AnchorSettings, BackreferenceSettings } from './types';
import { BlockType } from './types';

export const generateId = (): string => Math.random().toString(36).substring(2, 11);

export const generateRegexString = (blocks: Block[]): string => {
  const generate = (block: Block): string => {
    const settings = block.settings;
    let childrenRegex = block.children ? block.children.map(generate).join('') : '';

    switch (block.type) {
      case BlockType.LITERAL:
        return (settings as LiteralSettings).text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') || ''; // Escape special characters
      
      case BlockType.CHARACTER_CLASS:
        const charClassSettings = settings as CharacterClassSettings;
        // Basic escaping for pattern within character class
        const escapedPattern = charClassSettings.pattern.replace(/[\]\\]/g, '\\$&');
        return `[${charClassSettings.negated ? '^' : ''}${escapedPattern || ''}]`;
      
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
        // Alternation is tricky. If it's a top-level block, its children are alternatives.
        // If it's nested, it should probably be within a group.
        // For now, assuming children are direct alternatives.
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
        // This is a simplified representation. Real conditional regex needs careful parsing for condition.
        // Assuming condition, yesPattern, noPattern are already valid regex snippets for now.
        let conditionalStr = `(?(${condSettings.condition})${condSettings.yesPattern}`;
        if (condSettings.noPattern) {
          conditionalStr += `|${condSettings.noPattern}`;
        }
        conditionalStr += `)`;
        return conditionalStr;

      default:
        // For unknown types or types that primarily group children (like a root node if used)
        return childrenRegex;
    }
  };
  // If a block is a quantifier, it should apply to the preceding block.
  // This recursive generation assumes quantifiers are standalone or wrap children,
  // which might need adjustment based on how users build.
  // A more robust approach would be a post-processing step or modifying the tree structure.
  // For now, this is a direct translation of the provided JS.
  // A common way to handle quantifiers is that they are attached *to* a block, not *containing* children.
  // The current JS `generateRegex` for quantifier seems to output only the quantifier itself.
  // This means the structure `[Literal("a"), Quantifier("*")]` would generate `a*`.
  // Let's assume this interpretation for now.
  let result = "";
  for (let i = 0; i < blocks.length; i++) {
    const currentBlock = blocks[i];
    const nextBlock = blocks[i+1];

    if (currentBlock.type === BlockType.QUANTIFIER && i > 0) {
      // This is not how the original JS code handles it.
      // The original code just concatenates.
      // If Literal("a") followed by Quantifier("*"), it generates "a" + "*" = "a*".
      // This is what I'll stick to for now as it's simpler.
    }
    result += generate(currentBlock);
  }
  return result;
};
