
'use server';
import regexpTree from 'regexp-tree';
import type { Block, CharacterClassSettings, GroupSettings, LiteralSettings, QuantifierSettings, AnchorSettings, LookaroundSettings, BackreferenceSettings } from './types';
import { BlockType } from './types';
import { generateId } from './utils';

// Main exported function
export function parseRegexWithLibrary(regexString: string): Block[] {
  try {
    const ast = regexpTree.parse(`/${regexString}/`, { allowGroupNameDuplicates: true });
    
    const transformAndFlatten = (node: any): Block[] => {
      const block = transformNodeToBlock(node);
      if (!block) return [];
      
      const quantifier = (block as any)._quantifier;
      if (quantifier) {
        delete (block as any)._quantifier;
        return [block, quantifier];
      }

      if (block.type === BlockType.ALTERNATION && block.children) {
          const newChildren = block.children.flatMap(child => {
            if (child.type === BlockType.ALTERNATION && child.children) {
              return child.children;
            }
            return child;
          });
          block.children = newChildren;
      }
      
      if (block.type === BlockType.GROUP && block.children?.length === 1 && block.children[0].type === BlockType.ALTERNATION) {
          block.children = block.children[0].children;
          block.type = BlockType.ALTERNATION; // Promote group to alternation
          delete (block.settings as GroupSettings).type; // remove group settings
      }

      return [block];
    };

    if (ast.body && ast.body.type === 'Alternative') {
      return (ast.body as any).expressions.flatMap(transformAndFlatten);
    } else if (ast.body) {
      return transformAndFlatten(ast.body);
    }
    return [];
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Ошибка синтаксиса: ${error.message}`);
    }
    throw new Error('Неизвестная ошибка при разборе выражения.');
  }
}

// Recursive transformer function
function transformNodeToBlock(node: any): Block | null {
  if (!node) return null;
  const newId = generateId();

  switch (node.type) {
    case 'CharacterClass':
      const classRanges = node.expressions.map((expr: any) => {
        if (expr.type === 'ClassRange') {
          return `${expr.from.value}-${expr.to.value}`;
        }
        return expr.value;
      }).join('');
      return {
        id: newId,
        type: BlockType.CHARACTER_CLASS,
        settings: {
          pattern: classRanges || node.value || '',
          negated: node.negative || false,
        } as CharacterClassSettings,
        children: [],
        isExpanded: false
      };
    
    case 'Char':
      let text = '';
      if (node.kind === 'meta') {
        text = node.raw; // Use raw to preserve escaping like \.
      } else if (node.kind === 'simple' && node.value) {
        text = node.value;
      } else {
        text = node.raw;
      }
      return {
        id: newId,
        type: BlockType.LITERAL,
        settings: { text } as LiteralSettings,
        children: [],
        isExpanded: false
      };

    case 'Alternative':
      return {
        id: newId,
        type: BlockType.ALTERNATION,
        settings: {},
        children: node.expressions.map((expr: any) => transformNodeToBlock(expr)).filter(Boolean) as Block[],
        isExpanded: true
      };
      
    case 'Group':
      const expression = node.expression ? transformNodeToBlock(node.expression) : null;
      let children: Block[] = [];
      if (expression) {
          if (expression.type === BlockType.ALTERNATION) {
              children = expression.children;
          } else {
              children = [expression];
          }
      }

      if (node.capturing) {
        return {
          id: newId,
          type: BlockType.GROUP,
          settings: {
            type: node.name ? 'named' : 'capturing',
            name: node.name,
          } as GroupSettings,
          children,
          isExpanded: true
        };
      } else { // Non-capturing or Lookaround
        return {
          id: newId,
          type: BlockType.GROUP,
          settings: {
            type: 'non-capturing'
          } as GroupSettings,
          children,
          isExpanded: true
        };
      }

    case 'Assertion':
      if (node.kind === 'Lookahead' || node.kind === 'Lookbehind') {
        const lookaroundType: LookaroundSettings['type'] = `${node.negative ? 'negative' : 'positive'}-${node.kind.toLowerCase()}` as any;
        const assertionChildren = node.assertion ? transformNodeToBlock(node.assertion) : null;
        let finalChildren: Block[] = [];
        if(assertionChildren) {
          if (assertionChildren.type === BlockType.ALTERNATION) {
            finalChildren = assertionChildren.children;
          } else {
            finalChildren = [assertionChildren];
          }
        }
        
        return {
          id: newId,
          type: BlockType.LOOKAROUND,
          settings: { type: lookaroundType } as LookaroundSettings,
          children: finalChildren,
          isExpanded: true
        };
      } else { // Anchor
        return {
          id: newId,
          type: BlockType.ANCHOR,
          settings: { type: node.value } as AnchorSettings,
          children: [],
          isExpanded: false
        };
      }
      
    case 'Quantifier':
      const subject = transformNodeToBlock(node.expression);
      if (!subject) return null;

      let type: QuantifierSettings['type'] = node.kind;
      let min, max;
      if (node.range) {
          min = node.range.from;
          max = node.range.to;
          if (min !== undefined && max === undefined) type = '{n,}';
          else if (min !== undefined && max !== undefined && min === max) type = '{n}';
          else if (min !== undefined && max !== undefined) type = '{n,m}';
      }

      const quantifierBlock: Block = {
        id: newId,
        type: BlockType.QUANTIFIER,
        settings: {
          type,
          min: min,
          max: max,
          mode: node.greedy ? 'greedy' : (node.lazy ? 'lazy' : 'possessive'),
        } as QuantifierSettings,
        children: [],
        isExpanded: false,
      };

      return {
        ...subject,
        _quantifier: quantifierBlock
      } as any;

    case 'Backreference':
      return {
        id: newId,
        type: BlockType.BACKREFERENCE,
        settings: {
          ref: node.reference
        } as BackreferenceSettings,
        children: [],
        isExpanded: false
      };

    default:
      console.warn('Неизвестный тип узла AST:', node.type, node);
      return {
        id: newId,
        type: BlockType.LITERAL,
        settings: {
          text: node.raw || node.value || '',
          isRawRegex: true
        } as LiteralSettings,
        children: [],
        isExpanded: false
      };
  }
}
