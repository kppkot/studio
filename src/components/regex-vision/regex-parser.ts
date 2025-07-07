
import regexpTree from 'regexp-tree';
import type { Block, CharacterClassSettings, LiteralSettings, QuantifierSettings, AnchorSettings, LookaroundSettings, BackreferenceSettings, GroupSettings, ConditionalSettings } from './types';
import { BlockType } from './types';
import { generateId } from './utils';

// Main exported function
export function parseRegexWithLibrary(regexString: string): Block[] {
  try {
    // To pass the regex string to the parser (which expects a /.../ literal),
    // we must escape any / characters within the string itself.
    // The logic is:
    // 1. Temporarily replace already escaped slashes \/ with a placeholder.
    // 2. Escape all remaining, unescaped slashes /.
    // 3. Restore the original escaped slashes from the placeholder.
    // This prevents turning \/ into an invalid \\/.
    const placeholder = '\uE000'; // A character from the Private Use Area
    const escapedRegexString = regexString
      .replace(/\\\//g, placeholder)
      .replace(/\//g, '\\/')
      .replace(new RegExp(placeholder, 'g'), '\\/');

    // The `u` flag is important for regexp-tree to correctly parse complex patterns like unicode properties `\p{L}`
    const ast = regexpTree.parse(`/${escapedRegexString}/u`, { allowGroupNameDuplicates: true });
    
    if (ast.body) {
      return transformNodeToBlocks(ast.body);
    }
    return [];
  } catch (error) {
    if (error instanceof Error) {
      // Provide more specific, user-friendly error messages.
      if (error.message.includes('Unexpected quantifier')) {
        throw new Error('Синтаксическая ошибка: квантификатор (например, *, +, ?) оказался в неожиданном месте, ему нечего повторять.');
      }
      if (error.message.includes('Unmatched left parenthesis')) {
        throw new Error('Синтаксическая ошибка: есть незакрытая открывающая скобка `(`.');
      }
      if (error.message.includes('Unmatched right parenthesis')) {
        throw new Error('Синтаксическая ошибка: найдена лишняя закрывающая скобка `)`.');
      }
       if (error.message.includes('Invalid group')) {
        throw new Error('Синтаксическая ошибка: неверная или неполная группа.');
      }
      if (error.message.includes('Invalid character class')) {
        throw new Error('Синтаксическая ошибка: неверно сформирован символьный класс (выражение в квадратных скобках `[]`).');
      }
      if (error.message.includes('Trailing backslash')) {
        throw new Error('Синтаксическая ошибка: выражение не может заканчиваться одиночным обратным слэшем `\\`.');
      }
      // Fallback for other syntax errors from regexp-tree
      throw new Error(`Ошибка синтаксиса в выражении. ${error.message}`);
    }
    // Fallback for non-Error objects thrown
    throw new Error('Произошла неизвестная ошибка при разборе выражения.');
  }
}

// Returns an array of blocks. A simple node returns a single-element array.
// A repetition node returns [subject, quantifier]. An Alternative returns a flat list of its children's blocks.
function transformNodeToBlocks(node: any): Block[] {
  if (!node) return [];

  const newId = generateId();

  switch (node.type) {
    case 'Alternative': {
        const rawBlocks = node.expressions.flatMap((expr: any) => transformNodeToBlocks(expr));
        
        // Fuse consecutive literal blocks to simplify the tree
        const fusedBlocks: Block[] = [];
        let currentLiteralText = '';

        for (const block of rawBlocks) {
            // Only fuse non-raw literals. Raw regex should stay as is.
            if (block.type === BlockType.LITERAL && !(block.settings as LiteralSettings).isRawRegex) {
                currentLiteralText += (block.settings as LiteralSettings).text;
            } else {
                if (currentLiteralText) {
                    fusedBlocks.push({
                        id: generateId(),
                        type: BlockType.LITERAL,
                        settings: { text: currentLiteralText, isRawRegex: false } as LiteralSettings,
                        children: [],
                    });
                    currentLiteralText = '';
                }
                fusedBlocks.push(block);
            }
        }

        // Add any remaining literal text at the end
        if (currentLiteralText) {
             fusedBlocks.push({
                id: generateId(),
                type: BlockType.LITERAL,
                settings: { text: currentLiteralText, isRawRegex: false } as LiteralSettings,
                children: [],
            });
        }
        
        return fusedBlocks;
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
                mode: q.greedy ? 'greedy' : 'lazy',
            } as QuantifierSettings,
            children: [],
            isExpanded: false,
        };
        
        return [...subjectBlocks, quantifierBlock];
    }

    case 'Char': {
        const value = node.value;

        // Meta characters like '.', '\d', '\w', '\s'
        if (node.kind === 'meta') {
            const charClassBlock: Block = {
                id: newId,
                type: BlockType.CHARACTER_CLASS,
                settings: { pattern: value, negated: false } as CharacterClassSettings,
                children: [],
            };
            return [charClassBlock];
        }

        // Unicode property escapes like \p{L}
        if (node.kind === 'unicode-property') {
            const charClassBlock: Block = {
                id: newId,
                type: BlockType.CHARACTER_CLASS,
                // node.raw will be something like `\p{L}`
                settings: { pattern: node.raw, negated: false } as CharacterClassSettings,
                children: [],
            };
            return [charClassBlock];
        }

        // A simple literal character like 'a', or an escaped one like '\.'
        // For both, `node.value` is the character itself. For `\\`, it's `\`.
        const literalBlock: Block = {
            id: newId,
            type: BlockType.LITERAL,
            settings: { text: node.value, isRawRegex: false } as LiteralSettings,
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
      
      const expression = node.expression || { type: 'Alternative', expressions: [] };
      const children = transformNodeToBlocks(expression);
      
      const groupBlock: Block = {
        id: newId,
        type: BlockType.GROUP,
        settings: { type: groupType, name } as GroupSettings,
        children: children,
        isExpanded: true,
      };
      
      return [groupBlock];
    }

    case 'Disjunction': {
        const collectAlternatives = (n: any): any[] => {
            if (n && n.type === 'Disjunction') {
                return [...collectAlternatives(n.left), ...collectAlternatives(n.right)];
            }
            return [n];
        };
        
        const alternativesAstNodes = collectAlternatives(node);
        
        const alternativeBlocks = alternativesAstNodes.map(altNode => {
            if (!altNode) return null;
            const blocks = transformNodeToBlocks(altNode);

            // If an alternative consists of more than one block (e.g., a literal and a quantifier), 
            // it must be wrapped in a group to maintain correct precedence over the `|` operator.
            if (blocks.length > 1) {
                return { 
                    id: generateId(), 
                    type: BlockType.GROUP, 
                    settings: { type: 'non-capturing' } as GroupSettings, 
                    children: blocks, 
                    isExpanded: true 
                };
            }
            // If the alternative is just a single block, no wrapper group is needed.
            return blocks.length === 1 ? blocks[0] : null;
        }).filter((b): b is Block => b !== null);

        const alternationBlock: Block = {
            id: newId,
            type: BlockType.ALTERNATION,
            settings: {},
            children: alternativeBlocks,
            isExpanded: true,
        };
        
        return [alternationBlock];
    }

    case 'Assertion': {
      let blockType: BlockType | null = null;
      let settings: any = {};
      let children: Block[] = [];
      let isExpanded = false;

      // Refactored from if/else to a single switch for clarity and robustness
      switch(node.kind) {
        case 'Lookahead':
        case 'Lookbehind':
          blockType = BlockType.LOOKAROUND;
          const prefix = node.negative ? 'negative' : 'positive';
          settings.type = `${prefix}-${node.kind.toLowerCase()}`;
          children = node.assertion ? transformNodeToBlocks(node.assertion) : [];
          isExpanded = true;
          break;

        case '^':
        case 'Start':
        case 'StartOfLine':
          blockType = BlockType.ANCHOR;
          settings.type = '^';
          break;

        case '$':
        case 'End':
        case 'EndOfLine':
          blockType = BlockType.ANCHOR;
          settings.type = '$';
          break;

        case 'WordBoundary':
          blockType = BlockType.ANCHOR;
          // The string MUST be '\\b' or '\\B' to represent the two characters, not the backspace control character.
          settings.type = node.negative === true ? '\\B' : '\\b';
          break;

        default:
          // If we don't know the assertion type, we can't create a block for it.
          return []; 
      }

      if (blockType) {
        const assertionBlock: Block = {
          id: newId,
          type: blockType,
          settings: settings,
          children: children,
          isExpanded: isExpanded,
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
