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
      // The root is often an Alternative (sequence). The new transformer handles this correctly.
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
// A quantified node returns [subject, quantifier]. An Alternative returns a flat list.
function transformNodeToBlocks(node: any): Block[] {
  if (!node) return [];

  // Handle quantifiers first. They modify the result of their subject.
  if (node.quantifier) {
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
    
    return [...subjectBlocks, quantifierBlock];
  }

  // --- Base cases (no quantifier) ---
  const newId = generateId();

  switch (node.type) {
    case 'Alternative': {
        // Use flatMap to flatten the results of all child expressions into a single array
        return node.expressions.flatMap((expr: any) => transformNodeToBlocks(expr));
    }
    
    case 'Disjunction': {
        const children: Block[] = [];
        // Recursively collect all parts of a disjunction tree (e.g., a|b|c) into a flat list of children for the Alternation block.
        const collectAlternatives = (disjunctionNode: any) => {
            if (disjunctionNode.type === 'Disjunction') {
                collectAlternatives(disjunctionNode.left);
                collectAlternatives(disjunctionNode.right);
            } else {
                children.push(...transformNodeToBlocks(disjunctionNode));
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
        if (node.kind === 'meta' && !node.expressions) {
            patternContent = node.raw;
        } else {
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
        } else { // Anchor
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
        console.warn('Неизвестный тип узла AST:', node.type, node);
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
