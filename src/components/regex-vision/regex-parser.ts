import regexpTree from 'regexp-tree';
import type { Block, CharacterClassSettings, LiteralSettings, QuantifierSettings, AnchorSettings, LookaroundSettings, BackreferenceSettings, GroupSettings } from './types';
import { BlockType } from './types';
import { generateId } from './utils';

// Main exported function
export function parseRegexWithLibrary(regexString: string): Block[] {
  try {
    // The `u` flag is important for regexp-tree to correctly parse complex patterns like unicode properties `\p{L}`
    const ast = regexpTree.parse(`/${regexString}/u`, { allowGroupNameDuplicates: true });
    
    if (ast.body) {
      // The root is often an Alternative (sequence of blocks).
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
// A quantified node returns [subject, quantifier]. An Alternative returns a flat list of its children's blocks.
function transformNodeToBlocks(node: any): Block[] {
  if (!node) return [];

  // Handle quantifiers first. They modify the result of their subject expression.
  if (node.quantifier) {
    // Call transform on the node *without* the quantifier to get the subject block(s).
    const subjectBlocks = transformNodeToBlocks({ ...node, quantifier: null });
    
    // This should not happen for valid regex, but as a safeguard:
    if (subjectBlocks.length === 0) return [];

    const q = node.quantifier;
    let type: QuantifierSettings['type'] = q.kind;
    let min, max;

    if (q.kind === '{' && q.range) {
        min = q.range.from;
        max = q.range.to; // This can be undefined
        if (min !== undefined && max === undefined) type = '{n,}';
        else if (min !== undefined && max !== undefined && min === max) type = '{n}';
        else if (min !== undefined && max !== undefined) type = '{n,m}';
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
    
    // The result is the subject's blocks followed by the new quantifier block.
    return [...subjectBlocks, quantifierBlock];
  }

  // --- Base cases (without a quantifier) ---
  const newId = generateId();

  switch (node.type) {
    case 'Alternative': {
        // An Alternative is a sequence of expressions. We process each one and flatten the results.
        return node.expressions.flatMap((expr: any) => transformNodeToBlocks(expr));
    }

    case 'Char': {
        if (node.kind === 'meta') { // For \d, \w, \s, etc.
            const charClassBlock: Block = {
                id: newId,
                type: BlockType.CHARACTER_CLASS,
                settings: { pattern: node.value, negated: false } as CharacterClassSettings,
                children: [],
            };
            return [charClassBlock];
        }
        // For simple literals like 'a', '-', etc.
        const literalBlock: Block = {
            id: newId,
            type: BlockType.LITERAL,
            settings: { text: node.value, isRawRegex: false } as LiteralSettings,
            children: [],
        };
        return [literalBlock];
    }
    
    // --- Future cases to be added here ---

    default:
        console.warn('Unknown AST node type:', node.type, node);
        // Fallback for unknown nodes: if they have a raw representation, treat as a raw literal.
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