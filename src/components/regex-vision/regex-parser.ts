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
      const rootBlock = transformNodeToBlock(ast.body);
      // The root is often an Alternative (sequence). If our transformer wrapped it in a helper group,
      // we unwrap it here for a cleaner top-level tree in the UI.
      if (rootBlock && rootBlock.type === BlockType.GROUP && (rootBlock.settings as any).isSequenceWrapper) {
          return rootBlock.children || [];
      }
      return rootBlock ? [rootBlock] : [];
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

// Recursive transformer function
function transformNodeToBlock(node: any): Block | null {
  if (!node) return null;
  const newId = generateId();

  // Handle quantifiers first, as they wrap other nodes in the AST.
  if (node.quantifier) {
      // Recursively transform the node that is being quantified.
      const subject = transformNodeToBlock({ ...node, quantifier: null });
      if (!subject) return null;

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

      // Since a quantified item is a sequence of [subject, quantifier], we wrap it in a group.
      // This group is a helper for our block structure and can be unwrapped at the top level.
      return {
          id: newId,
          type: BlockType.GROUP,
          settings: { type: 'non-capturing', isSequenceWrapper: true } as any,
          children: [subject, quantifierBlock],
          isExpanded: true
      };
  }

  switch (node.type) {
    case 'Alternative': {
        const children: Block[] = [];
        let currentLiteral = '';

        const flushLiteral = () => {
            if (currentLiteral) {
                children.push({
                    id: generateId(),
                    type: BlockType.LITERAL,
                    settings: { text: currentLiteral } as LiteralSettings,
                    children: [], isExpanded: false
                });
                currentLiteral = '';
            }
        };

        for (const expr of node.expressions) {
            // Combine consecutive simple characters into a single LITERAL block for readability.
            if (expr.type === 'Char' && expr.kind === 'simple' && !expr.quantifier) {
                currentLiteral += expr.value;
            } else {
                flushLiteral();
                const childBlock = transformNodeToBlock(expr);
                if (childBlock) {
                    // If a child was a sequence that got wrapped in a group, flatten it into the current sequence.
                    if (childBlock.type === BlockType.GROUP && (childBlock.settings as any).isSequenceWrapper) {
                        children.push(...(childBlock.children || []));
                    } else {
                        children.push(childBlock);
                    }
                }
            }
        }
        flushLiteral();
        
        // If the entire sequence resulted in just one block, return that block directly.
        if (children.length === 1) {
            return children[0];
        }

        // A sequence of multiple blocks is represented as a helper non-capturing group.
        return {
            id: newId,
            type: BlockType.GROUP,
            settings: { type: 'non-capturing', isSequenceWrapper: true } as any,
            children: children,
            isExpanded: true,
        };
    }
    
    case 'Disjunction': {
        const children: Block[] = [];
        // Recursively collect all parts of a disjunction tree (e.g., a|b|c) into a flat list.
        const collectAlternatives = (disjunctionNode: any) => {
            if (disjunctionNode.type === 'Disjunction') {
                collectAlternatives(disjunctionNode.left);
                collectAlternatives(disjunctionNode.right);
            } else {
                const block = transformNodeToBlock(disjunctionNode);
                if (block) children.push(block);
            }
        };
        collectAlternatives(node);
        return {
            id: newId,
            type: BlockType.ALTERNATION,
            settings: {},
            children,
            isExpanded: true,
        };
    }

    case 'CharacterClass': {
        // Handles simple meta classes like `.` or `\d` when they are not inside `[...]`.
        if (node.kind === 'meta' && !node.expressions) {
            return {
                id: newId,
                type: BlockType.CHARACTER_CLASS,
                settings: { pattern: node.raw, negated: false } as CharacterClassSettings,
                children: [], isExpanded: false
            };
        }
        // Handles `[...]` character classes.
        const pattern = node.expressions.map((expr: any) => {
            if (expr.type === 'ClassRange') return `${charToString(expr.from)}-${charToString(expr.to)}`;
            return charToString(expr);
        }).join('');
        return {
            id: newId,
            type: BlockType.CHARACTER_CLASS,
            settings: { pattern: pattern, negated: node.negative || false } as CharacterClassSettings,
            children: [], isExpanded: false
        };
    }
    
    case 'Char':
        // A simple character. `raw` is used to preserve things that might need escaping.
        return {
            id: newId,
            type: BlockType.LITERAL,
            settings: { text: node.raw, isRawRegex: true } as LiteralSettings,
            children: [], isExpanded: false
        };
      
    case 'Group': {
        const expression = node.expression ? transformNodeToBlock(node.expression) : null;
        return {
            id: newId,
            type: BlockType.GROUP,
            settings: {
                type: node.capturing ? (node.name ? 'named' : 'capturing') : 'non-capturing',
                name: node.name,
            } as GroupSettings,
            children: expression ? [expression] : [],
            isExpanded: true,
        };
    }

    case 'Assertion':
        if (node.kind === 'Lookahead' || node.kind === 'Lookbehind') {
            const lookaroundType: LookaroundSettings['type'] = `${node.negative ? 'negative' : 'positive'}-${node.kind.toLowerCase()}` as any;
            const assertionChild = node.assertion ? transformNodeToBlock(node.assertion) : null;
            return {
                id: newId,
                type: BlockType.LOOKAROUND,
                settings: { type: lookaroundType } as LookaroundSettings,
                children: assertionChild ? [assertionChild] : [],
                isExpanded: true
            };
        } else { // Anchor
            return {
                id: newId,
                type: BlockType.ANCHOR,
                settings: { type: node.raw } as AnchorSettings,
                children: [],
                isExpanded: false
            };
        }
      
    case 'Backreference':
      return {
        id: newId,
        type: BlockType.BACKREFERENCE,
        settings: { ref: node.reference } as BackreferenceSettings,
        children: [],
        isExpanded: false
      };

    default:
        console.warn('Неизвестный тип узла AST:', node.type, node);
        return {
            id: newId,
            type: BlockType.LITERAL,
            settings: { text: node.raw || '', isRawRegex: true } as LiteralSettings,
            children: [], isExpanded: false
        };
  }
}
