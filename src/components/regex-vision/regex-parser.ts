
import regexpTree from 'regexp-tree';
import type { Block, CharacterClassSettings, LiteralSettings, QuantifierSettings, AnchorSettings, LookaroundSettings, BackreferenceSettings, GroupSettings, ConditionalSettings } from './types';
import { BlockType } from './types';
import { generateId, createLiteral } from './utils';

// Main exported function
export function parseRegexWithLibrary(regexString: string): Block[] {
  try {
    console.log('--- DEBUG: STEP 1: Input to parseRegexWithLibrary ---');
    console.log('Regex String:', regexString);

    const placeholder = '\uE000';
    const escapedRegexString = regexString
      .replace(/\\\//g, placeholder)
      .replace(/\//g, '\\/')
      .replace(new RegExp(placeholder, 'g'), '\\/');

    const ast = regexpTree.parse(`/${escapedRegexString}/u`, { allowGroupNameDuplicates: true });
    
    console.log('--- DEBUG: STEP 2: Parsed AST from regexp-tree ---');
    console.log(JSON.parse(JSON.stringify(ast.body)));

    if (ast.body) {
      const resultBlocks = transformNodeToBlocks(ast.body);
      console.log('--- DEBUG: STEP 4: Final blocks returned from parser ---');
      console.log(JSON.parse(JSON.stringify(resultBlocks)));
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

function transformNodeToBlocks(node: any): Block[] {
  if (!node) return [];

  const newId = generateId();

  switch (node.type) {
    case 'Alternative': {
        const expressions = node.expressions;
        console.log('--- DEBUG: ALTERNATIVE: Processing expressions:', JSON.parse(JSON.stringify(expressions)));
        
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
        
        console.log('--- DEBUG: ALTERNATIVE: Produced blocks:', JSON.parse(JSON.stringify(fusedBlocks)));

        // Previous broken logic was here. Now it's just returning the blocks.
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
        console.log('--- DEBUG: DISJUNCTION: Processing AST alternatives:', JSON.parse(JSON.stringify(alternativesAstNodes)));
        
        const childrenBlockArrays = alternativesAstNodes.map(altNode => {
            if (!altNode) return [];
            return transformNodeToBlocks(altNode);
        });

        console.log('--- DEBUG: DISJUNCTION: Processed alternatives into block arrays:', JSON.parse(JSON.stringify(childrenBlockArrays)));

        const children = childrenBlockArrays.map(blockArray => {
            if (blockArray.length > 1) {
                const wrapperGroup: Block = {
                    id: generateId(),
                    type: BlockType.GROUP,
                    settings: { type: 'non-capturing' } as GroupSettings,
                    children: blockArray,
                    isExpanded: true
                };
                console.log('--- DEBUG: DISJUNCTION: Wrapping multi-block alternative in a group:', JSON.parse(JSON.stringify(wrapperGroup)));
                return wrapperGroup;
            }
            return blockArray[0];
        }).filter(Boolean);

        console.log('--- DEBUG: DISJUNCTION: Final children for ALTERNATION block:', JSON.parse(JSON.stringify(children)));

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
        console.log('--- DEBUG: STEP 3: Processing Assertion node ---', { kind: node.kind, negative: node.negative });
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
