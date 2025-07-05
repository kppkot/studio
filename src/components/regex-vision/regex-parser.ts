import regexpTree from 'regexp-tree';
import type { Block, CharacterClassSettings, GroupSettings, LiteralSettings, QuantifierSettings, AnchorSettings, LookaroundSettings, BackreferenceSettings } from './types';
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

function charToString(charNode: any): string {
    if (!charNode) return '';
    // `raw` preserves escaping (e.g., `\.` remains `\.`), which is crucial.
    return charNode.raw;
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

    if (q.range) {
        min = q.range.from;
        max = q.range.to;
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
    
    case 'Disjunction': {
        // A Disjunction is an "OR" statement (e.g., a|b|c). We represent this with a single ALTERNATION block.
        const children: Block[] = [];
        
        // Recursively collect all parts of a disjunction tree into a flat list.
        const collectAlternatives = (disjunctionNode: any) => {
            if (disjunctionNode.type === 'Disjunction') {
                collectAlternatives(disjunctionNode.left);
                collectAlternatives(disjunctionNode.right);
            } else {
                // Each alternative (like 'yahoo' or 'hotmail') is a complete expression.
                // We transform it into its own set of blocks.
                // If the alternative is a sequence (e.g., 'yahoo'), it should be grouped.
                const alternativeBlocks = transformNodeToBlocks(disjunctionNode);

                if (alternativeBlocks.length > 1) {
                    // This alternative is a sequence, wrap it in a LITERAL block using its raw text
                    // to keep it as a single unit in the alternation.
                     children.push({
                        id: generateId(),
                        type: BlockType.LITERAL,
                        settings: { text: disjunctionNode.raw, isRawRegex: true } as LiteralSettings,
                        children: [],
                    });
                } else {
                    children.push(...alternativeBlocks);
                }
            }
        };

        collectAlternatives(node);

        const alternationBlock: Block = {
            id: newId,
            type: BlockType.ALTERNATION,
            settings: {},
            children,
            isExpanded: true,
        };
        return [alternationBlock];
    }

    case 'CharacterClass': {
        let patternContent;
        // A 'meta' kind is a shorthand like \d, \w, etc.
        if (node.kind === 'meta' && !node.expressions) {
            patternContent = node.raw;
        } else {
            // Otherwise, it's a class like [abc-f]
            patternContent = (node.expressions || []).map((expr: any) => {
                if (expr.type === 'ClassRange') return `${charToString(expr.from)}-${charToString(expr.to)}`;
                return charToString(expr);
            }).join('');
        }
        const charClassBlock: Block = {
            id: newId,
            type: BlockType.CHARACTER_CLASS,
            settings: { pattern: patternContent, negated: node.negative || false } as CharacterClassSettings,
            children: [], isExpanded: false
        };
        return [charClassBlock];
    }
    
    case 'Char': {
        const literalBlock: Block = {
            id: newId,
            type: BlockType.LITERAL,
            // Use 'raw' to preserve escaping, critical for characters like '.' -> '\.'
            settings: { text: node.raw, isRawRegex: true } as LiteralSettings,
            children: [], isExpanded: false
        };
        return [literalBlock];
    }
      
    case 'Group': {
        const children = node.expression ? transformNodeToBlocks(node.expression) : [];
        const groupBlock: Block = {
            id: newId,
            type: BlockType.GROUP,
            settings: {
                type: node.capturing ? (node.name ? 'named' : 'capturing') : 'non-capturing',
                name: node.name,
            } as GroupSettings,
            children,
            isExpanded: true,
        };
        return [groupBlock];
    }

    case 'Assertion': {
        // Assertions can be Lookarounds or Anchors.
        if (node.kind === 'Lookahead' || node.kind === 'Lookbehind') {
            const lookaroundType: LookaroundSettings['type'] = `${node.negative ? 'negative' : 'positive'}-${node.kind.toLowerCase()}` as any;
            const assertionChild = node.assertion ? transformNodeToBlocks(node.assertion) : [];
            const lookaroundBlock: Block = {
                id: newId,
                type: BlockType.LOOKAROUND,
                settings: { type: lookaroundType } as LookaroundSettings,
                children: assertionChild,
                isExpanded: true
            };
            return [lookaroundBlock];
        } else { // It's an anchor like ^, $, \b
            const anchorType = (node.kind === 'b' || node.kind === 'B') ? `\\${node.kind}` : node.kind;
            const anchorBlock: Block = {
                id: newId,
                type: BlockType.ANCHOR,
                settings: { type: anchorType as AnchorSettings['type'] } as AnchorSettings,
                children: [],
                isExpanded: false
            };
            return [anchorBlock];
        }
    }
      
    case 'Backreference': {
        const backrefBlock: Block = {
            id: newId,
            type: BlockType.BACKREFERENCE,
            settings: { ref: node.reference } as BackreferenceSettings,
            children: [],
            isExpanded: false
        };
        return [backrefBlock];
    }

    default:
        console.warn('Unknown AST node type:', node.type, node);
        // Fallback for unknown nodes: if they have a raw representation, treat as a literal.
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
