import regexpTree from 'regexp-tree';
import type { Block, CharacterClassSettings, LiteralSettings, QuantifierSettings, AnchorSettings, LookaroundSettings, BackreferenceSettings, GroupSettings, ConditionalSettings } from './types';
import { BlockType } from './types';
import { generateId } from './utils';

// Main exported function
export function parseRegexWithLibrary(regexString: string): Block[] {
  try {
    // The `u` flag is important for regexp-tree to correctly parse complex patterns like unicode properties `\p{L}`
    const ast = regexpTree.parse(`/${regexString}/u`, { allowGroupNameDuplicates: true });
    
    if (ast.body) {
      return transformNodeToBlocks(ast.body);
    }
    return [];
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Unexpected quantifier')) {
        throw new Error('Синтаксическая ошибка: квантификатор (например, *, +, ?) без элемента для повторения.');
      }
       if (error.message.includes('Unmatched left parenthesis')) {
        throw new Error('Синтаксическая ошибка: незакрытая открывающая скобка `(`.');
      }
      if (error.message.includes('Unmatched right parenthesis')) {
        throw new Error('Синтаксическая ошибка: лишняя закрывающая скобка `)`.');
      }
       if (error.message.includes('Invalid group')) {
        throw new Error('Синтаксическая ошибка: неверная или неполная группа.');
      }
      throw new Error(`Ошибка синтаксиса: ${error.message}`);
    }
    throw new Error('Неизвестная ошибка при разборе выражения.');
  }
}

// Returns an array of blocks. A simple node returns a single-element array.
// A repetition node returns [subject, quantifier]. An Alternative returns a flat list of its children's blocks.
function transformNodeToBlocks(node: any): Block[] {
  if (!node) return [];

  const newId = generateId();

  switch (node.type) {
    case 'Alternative': {
        // A smarter parser for a common but naive HTML tag pattern.
        // It checks if the whole expression is exactly <[^>]+>
        if (
            node.expressions.length === 3 &&
            node.expressions[0].type === 'Char' && node.expressions[0].value === '<' &&
            node.expressions[2].type === 'Char' && node.expressions[2].value === '>' &&
            node.expressions[1].type === 'Repetition' && node.expressions[1].quantifier.kind === '+' &&
            node.expressions[1].expression.type === 'CharacterClass' &&
            node.expressions[1].expression.negative === true &&
            node.expressions[1].expression.expressions.length === 1 &&
            node.expressions[1].expression.expressions[0].value === '>'
        ) {
            // This is the <[^>]+> pattern. Let's upgrade it to something safer and more intentional.
            const tagContentPattern = 'a-zA-Z0-9_\\s/\\-="\'#.'; // More specific characters allowed in a tag
            const blocks: Block[] = [
                { id: generateId(), type: BlockType.LITERAL, settings: { text: '<' } as LiteralSettings, children: [], isExpanded: false },
                { id: generateId(), type: BlockType.CHARACTER_CLASS, settings: { pattern: tagContentPattern, negated: false } as CharacterClassSettings, children: [], isExpanded: false },
                { id: generateId(), type: BlockType.QUANTIFIER, settings: { type: '+', mode: 'greedy' } as QuantifierSettings, children: [], isExpanded: false },
                { id: generateId(), type: BlockType.LITERAL, settings: { text: '>' } as LiteralSettings, children: [], isExpanded: false },
            ];
            return blocks;
        }

        // Default behavior for other alternatives
        return node.expressions.flatMap((expr: any) => transformNodeToBlocks(expr));
    }

    case 'Repetition': {
        const subjectBlocks = transformNodeToBlocks(node.expression);
        const q = node.quantifier;
        let type: QuantifierSettings['type'] | null = null;
        let min, max;

        switch (q.kind) {
            case '*': type = '*'; break;
            case '+': type = '+'; break;
            case '?': type = '?'; break;
            case 'Range': // Correctly handle quantifiers like {n}, {n,m}, {n,}
                min = q.from;
                max = q.to === Infinity ? null : q.to;
                if (min !== undefined && max === undefined) type = '{n,}';
                else if (min !== undefined && max !== undefined && min === max) type = '{n}';
                else if (min !== undefined && max !== undefined) type = '{n,m}';
                break;
        }

        if (type === null) {
            // If quantifier is unknown, don't create a block for it, return only the subject.
            return subjectBlocks;
        }

        const quantifierBlock: Block = {
            id: generateId(),
            type: BlockType.QUANTIFIER,
            settings: {
                type,
                min: min,
                max: max,
                mode: q.greedy ? 'greedy' : (q.lazy ? 'lazy' : 'possessive'),
            } as QuantifierSettings,
            children: [],
            isExpanded: false,
        };
        
        return [...subjectBlocks, quantifierBlock];
    }

    case 'Char': {
        const value = node.value;
        // A meta character like '.', '\d', '\w', '\s'
        if (node.kind === 'meta') { 
            const charClassBlock: Block = {
                id: newId,
                type: BlockType.CHARACTER_CLASS,
                settings: { pattern: value, negated: false } as CharacterClassSettings,
                children: [],
            };
            return [charClassBlock];
        }
        // A simple literal character like 'a', or an escaped one like '\.'
        const literalBlock: Block = {
            id: newId,
            type: BlockType.LITERAL,
            settings: { text: value, isRawRegex: false } as LiteralSettings,
            children: [],
        };
        return [literalBlock];
    }

    case 'CharacterClass': {
      const pattern = node.expressions.map((expr: any) => regexpTree.generate(expr)).join('');
      const charClassBlock: Block = {
          id: newId,
          type: BlockType.CHARACTER_CLASS,
          settings: { pattern: pattern, negated: node.negative } as CharacterClassSettings,
          children: [],
      };
      return [charClassBlock];
    }

    case 'Group': {
      let groupType: GroupSettings['type'] = 'capturing';
      let name: string | undefined = undefined;
      if (node.capturing === false) {
        groupType = 'non-capturing';
      } else if (typeof node.name === 'string') {
        groupType = 'named';
        name = node.name;
      }
      
      const isAlternation = node.expression && node.expression.type === 'Disjunction';
      const type = isAlternation ? BlockType.ALTERNATION : BlockType.GROUP;
      
      const settings = type === BlockType.GROUP ? { type: groupType, name } : {};

      const collectAlternationChildren = (disNode: any): Block[] => {
          if (disNode.type !== 'Disjunction') return transformNodeToBlocks(disNode);
          return [
              ...collectAlternationChildren(disNode.left),
              ...collectAlternationChildren(disNode.right)
          ];
      };

      let children: Block[];
      if(isAlternation) {
        children = collectAlternationChildren(node.expression);
      } else {
        children = transformNodeToBlocks(node.expression);
      }
      
      const groupBlock: Block = {
        id: newId,
        type: type,
        settings: settings,
        children: children,
        isExpanded: true,
      };
      
      return [groupBlock];
    }

    case 'Disjunction': {
      // This handles top-level alternations `a|b` not in a group
      const collectAlternationChildren = (disNode: any): Block[] => {
          if (disNode.type !== 'Disjunction') {
            const transformedBlocks = transformNodeToBlocks(disNode);
            // Wrap sequences in a non-capturing group to keep them together
            if (transformedBlocks.length > 1) {
              return [{id: generateId(), type: BlockType.GROUP, settings: {type: 'non-capturing'}, children: transformedBlocks, isExpanded: true}];
            }
            return transformedBlocks;
          }
          return [
              ...collectAlternationChildren(disNode.left),
              ...collectAlternationChildren(disNode.right)
          ];
      };
      const children = collectAlternationChildren(node);
      const alternationBlock: Block = {
          id: newId,
          type: BlockType.ALTERNATION,
          settings: {},
          children: children,
          isExpanded: true,
      };
      return [alternationBlock];
    }

    case 'Assertion': {
      let blockType: BlockType | null = null;
      let settings: any = {};

      if (node.kind === 'Lookahead' || node.kind === 'Lookbehind') {
        blockType = BlockType.LOOKAROUND;
        let prefix = node.negative ? 'negative' : 'positive';
        settings.type = `${prefix}-${node.kind.toLowerCase()}`;
      } else {
        blockType = BlockType.ANCHOR;
        switch(node.kind) {
            case 'StartOfLine':
                settings.type = '^';
                break;
            case 'EndOfLine':
                settings.type = '$';
                break;
            case 'WordBoundary':
                settings.type = node.negative ? '\\B' : '\\b';
                break;
            default:
                // If we don't know the anchor type, we can't create a block for it.
                return []; 
        }
      }

      if (blockType) {
        const assertionBlock: Block = {
          id: newId,
          type: blockType,
          settings: settings,
          children: node.assertion ? transformNodeToBlocks(node.assertion) : [],
          isExpanded: blockType === BlockType.LOOKAROUND,
        };
        return [assertionBlock];
      }
      return [];
    }

    case 'Backreference': {
       const backrefBlock: Block = {
          id: newId,
          type: BlockType.BACKREFERENCE,
          settings: { ref: node.reference } as BackreferenceSettings,
          children: [],
      };
      return [backrefBlock];
    }

    default:
        if (node.raw) {
             const fallbackBlock: Block = {
                id: newId,
                type: BlockType.LITERAL,
                settings: { text: node.raw, isRawRegex: true } as LiteralSettings,
                children: [], isExpanded: false
            };
            return [fallbackBlock];
        }
        return [];
  }
}
