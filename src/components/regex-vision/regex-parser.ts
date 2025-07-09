
import regexpTree from 'regexp-tree';
import type { Block, CharacterClassSettings, LiteralSettings, QuantifierSettings, AnchorSettings, LookaroundSettings, BackreferenceSettings, GroupSettings, ConditionalSettings } from './types';
import { BlockType } from './types';
import { generateId, createLiteral } from './utils';

// Main exported function
export function parseRegexWithLibrary(regexString: string): Block[] {
  try {
    console.log('--- DEBUG: STEP 1: Input to parseRegexWithLibrary ---');
    console.log(`Regex String: ${regexString}`);

    const placeholder = '\uE000';
    const escapedRegexString = regexString
      .replace(/\\\//g, placeholder)
      .replace(/\//g, '\\/')
      .replace(new RegExp(placeholder, 'g'), '\\/');

    const ast = regexpTree.parse(`/${escapedRegexString}/u`, { allowGroupNameDuplicates: true });
    
    console.log('--- DEBUG: STEP 2: Parsed AST from regexp-tree ---');
    console.log(JSON.stringify(ast.body, null, 2));

    if (ast.body) {
      // The top-level `ast.body` is almost always an 'Alternative'.
      // We pass its expressions directly to `transformNodeToBlocks` which is designed
      // to handle an array of expression nodes. This prevents the top-level
      // from being wrapped in an unnecessary group.
      const expressions = (ast.body as any).expressions || [ast.body];
      const resultBlocks = transformNodeListToBlocks(expressions);
      console.log('--- DEBUG: STEP 4: Final blocks returned from parser ---');
      console.log(JSON.stringify(resultBlocks, null, 2));
      return resultBlocks;
    }
    return [];
  } catch (error) {
    if (error instanceof Error) {
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
      throw new Error(`Ошибка синтаксиса в выражении. ${error.message}`);
    }
    throw new Error('Произошла неизвестная ошибка при разборе выражения.');
  }
}

// New function to process a list of nodes
function transformNodeListToBlocks(expressions: any[]): Block[] {
    console.log(`--- DEBUG: transformNodeListToBlocks: Processing expressions:`, JSON.stringify(expressions, null, 2));
    const fusedBlocks: Block[] = [];
    let currentLiteralText = '';

    const pushLiteral = () => {
        if (currentLiteralText) {
            fusedBlocks.push(createLiteral(currentLiteralText));
            currentLiteralText = '';
        }
    };

    for (const expr of expressions) {
        if (expr.type === 'Char' && expr.kind === 'simple' && !expr.escaped) {
            currentLiteralText += expr.value;
        } else {
            pushLiteral();
            fusedBlocks.push(...transformNodeToBlocks(expr));
        }
    }
    pushLiteral();
    
    console.log(`--- DEBUG: transformNodeListToBlocks: Produced blocks:`, JSON.stringify(fusedBlocks, null, 2));
    return fusedBlocks;
}


function transformNodeToBlocks(node: any): Block[] {
  if (!node) return [];

  const newId = generateId();

  switch (node.type) {
    case 'Alternative': {
        const expressions = node.expressions || [];
        // An alternative inside another expression is just a sequence.
        // If it contains more than one logical block, it should be grouped.
        const blocks = transformNodeListToBlocks(expressions);
        if (blocks.length > 1) {
             const wrapperGroup: Block = {
                id: generateId(),
                type: BlockType.GROUP,
                settings: { type: 'non-capturing' } as GroupSettings,
                children: blocks,
                isExpanded: true
            };
            return [wrapperGroup];
        }
        return blocks;
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
            case 'Range':
                min = q.from;
                max = q.to === Infinity ? null : q.to;
                if (min !== undefined && max === undefined) type = '{n,}';
                else if (min !== undefined && max !== undefined && min === max) type = '{n}';
                else if (min !== undefined && max !== undefined) type = '{n,m}';
                break;
        }

        if (type === null) {
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

        if (node.kind === 'meta') {
            const charClassBlock: Block = {
                id: newId,
                type: BlockType.CHARACTER_CLASS,
                settings: { pattern: value, negated: false } as CharacterClassSettings,
                children: [],
            };
            return [charClassBlock];
        }

        if (node.kind === 'unicode-property') {
            const charClassBlock: Block = {
                id: newId,
                type: BlockType.CHARACTER_CLASS,
                settings: { pattern: node.raw, negated: false } as CharacterClassSettings,
                children: [],
            };
            return [charClassBlock];
        }

        const literalBlock: Block = {
            id: newId,
            type: BlockType.LITERAL,
            settings: { text: node.value, isRawRegex: false } as LiteralSettings,
            children: [],
        };
        return [literalBlock];
    }

    case 'CharacterClass': {
      const pattern = node.expressions.map((expr: any) => {
        if(expr.type === 'ClassRange') return expr.raw;
        return regexpTree.generate(expr);
      }).join('');
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
        console.log('--- DEBUG: DISJUNCTION: Processing AST alternatives:', JSON.stringify(alternativesAstNodes, null, 2));
        
        const children = alternativesAstNodes.flatMap(altNode => {
            if (!altNode) return [];
            return transformNodeToBlocks(altNode);
        });

        console.log('--- DEBUG: DISJUNCTION: Final children for ALTERNATION block:', JSON.stringify(children, null, 2));

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
        console.log('--- DEBUG: STEP 3: Processing Assertion node ---', JSON.stringify({ kind: node.kind, negative: node.negative }, null, 2));

        if (node.kind === '\\b' || node.kind === '\\B') {
            const anchorBlock: Block = {
                id: newId,
                type: BlockType.ANCHOR,
                settings: { type: node.kind } as AnchorSettings,
                children: [],
                isExpanded: false
            };
            return [anchorBlock];
        }

        let blockType: BlockType | null = null;
        let settings: any = {};
        let children: Block[] = [];
        let isExpanded = false;
        
        if (node.kind === 'Lookahead' || node.kind === 'Lookbehind') {
            blockType = BlockType.LOOKAROUND;
            const prefix = node.negative ? 'negative' : 'positive';
            settings.type = `${prefix}-${node.kind.toLowerCase()}`;
            children = node.assertion ? transformNodeToBlocks(node.assertion) : [];
            isExpanded = true;
        } else {
            blockType = BlockType.ANCHOR;
            settings.type = node.kind;
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

    