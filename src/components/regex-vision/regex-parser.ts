import regexpTree from 'regexp-tree';
import type { Block, CharacterClassSettings, LiteralSettings, QuantifierSettings, AnchorSettings, LookaroundSettings, BackreferenceSettings, GroupSettings, ConditionalSettings } from './types';
import { BlockType } from './types';
import { generateId, createLiteral } from './utils';

// Main exported function
export function parseRegexWithLibrary(regexString: string): Block[] {
  try {
    console.log('--- DEBUG: STEP 1: Input to parseRegexWithLibrary ---');
    console.log('Regex String:', regexString);

    const ast = regexpTree.parse(`/${regexString}/u`, { allowGroupNameDuplicates: true });
    
    console.log('--- DEBUG: STEP 2: Parsed AST from regexp-tree ---');
    console.log(JSON.stringify(ast.body, null, 2));

    const resultBlocks = transformNodeToBlocks(ast.body);
    
    console.log('--- DEBUG: STEP 4: Final blocks returned from parser ---');
    console.log(JSON.stringify(resultBlocks, null, 2));
    return resultBlocks;

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

function transformNodeListToBlocks(expressions: any[]): Block[] {
    console.log('--- DEBUG: transformNodeListToBlocks: Processing expressions:', JSON.stringify(expressions, null, 2));
    const fusedBlocks: Block[] = [];
    let currentLiteralText = '';

    const pushCurrentLiteral = () => {
        if (currentLiteralText) {
            fusedBlocks.push(createLiteral(currentLiteralText));
            currentLiteralText = '';
        }
    };

    for (const expr of expressions) {
        if (expr.type === 'Char' && expr.kind === 'simple' && !expr.escaped) {
            currentLiteralText += expr.value;
        } else {
            pushCurrentLiteral();
            fusedBlocks.push(...transformNodeToBlocks(expr));
        }
    }
    pushCurrentLiteral();
    console.log('--- DEBUG: transformNodeListToBlocks: Produced blocks:', JSON.stringify(fusedBlocks, null, 2));
    return fusedBlocks;
}

function transformNodeToBlocks(node: any): Block[] {
  if (!node) return [];

  const newId = generateId();

  switch (node.type) {
    case 'Alternative':
      return transformNodeListToBlocks(node.expressions || []);

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
                max = q.to === undefined ? null : q.to;
                if (min !== undefined && max === null) type = '{n,}';
                else if (min !== undefined && max !== undefined && min === max) type = '{n}';
                else if (min !== undefined && max !== undefined) type = '{n,m}';
                break;
        }

        if (type === null) return subjectBlocks;

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
        };
        
        return [...subjectBlocks, quantifierBlock];
    }

    case 'Char': {
        const value = node.value;
        if (node.kind === 'meta' || (node.escaped && !/[0-9]/.test(node.value))) {
            const pattern = (node.escaped ? '\\' : '') + value;
            return [{
                id: newId,
                type: BlockType.CHARACTER_CLASS,
                settings: { pattern, negated: false } as CharacterClassSettings,
                children: [],
            }];
        }
        return [createLiteral(value)];
    }

    case 'CharacterClass': {
      const pattern = node.expressions.map((expr: any) => regexpTree.generate(expr)).join('');
      return [{
          id: newId,
          type: BlockType.CHARACTER_CLASS,
          settings: { pattern, negated: node.negative } as CharacterClassSettings,
          children: [],
      }];
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
      
      const children = node.expression ? transformNodeToBlocks(node.expression) : [];
      
      return [{
        id: newId,
        type: BlockType.GROUP,
        settings: { type: groupType, name } as GroupSettings,
        children: children,
        isExpanded: true,
      }];
    }

    case 'Disjunction': {
        const alternatives = [node.left, node.right];
        // This is a simplification; a real Disjunction can be a tree.
        // regexp-tree seems to represent it as a linked list via `left` and `right`.
        let current = node;
        const expressions = [];
        while (current && current.type === 'Disjunction') {
          expressions.unshift(current.right);
          current = current.left;
        }
        if (current) {
          expressions.unshift(current);
        }

        console.log('--- DEBUG: DISJUNCTION: Processing AST alternatives:', JSON.stringify(expressions, null, 2));

        const processedAlternatives = expressions.map(expr => {
            const blocks = transformNodeToBlocks(expr);
            // If an alternative consists of multiple blocks, wrap it in a non-capturing group to preserve its sequence.
            if (blocks.length > 1) {
                return [{
                    id: generateId(),
                    type: BlockType.GROUP,
                    settings: { type: 'non-capturing' } as GroupSettings,
                    children: blocks,
                    isExpanded: true,
                }];
            }
            return blocks;
        });

        const finalChildren = processedAlternatives.flat();
        console.log('--- DEBUG: DISJUNCTION: Final children for ALTERNATION block:', JSON.stringify(finalChildren, null, 2));
        
        return [{
            id: newId,
            type: BlockType.ALTERNATION,
            settings: {},
            children: finalChildren,
            isExpanded: true,
        }];
    }
    
    case 'Assertion': {
        console.log('--- DEBUG: STEP 3: Processing Assertion node ---', JSON.stringify({kind: node.kind}, null, 2));
        let blockType: BlockType | null = null;
        let settings: any = {};
        let children: Block[] = [];
        
        if (node.kind === 'Lookahead' || node.kind === 'Lookbehind') {
            blockType = BlockType.LOOKAROUND;
            const prefix = node.negative ? 'negative' : 'positive';
            settings.type = `${prefix}-${node.kind.toLowerCase()}`;
            children = node.assertion ? transformNodeToBlocks(node.assertion) : [];
        } else {
             const anchorTypeMap: { [key: string]: AnchorSettings['type'] } = {
                '^': '^',
                '$': '$',
                '\\b': '\\b',
                '\\B': '\\B'
            };
            if (Object.keys(anchorTypeMap).includes(node.kind)) {
                 blockType = BlockType.ANCHOR;
                 settings.type = anchorTypeMap[node.kind];
            }
        }

        if (blockType) {
            return [{
                id: newId,
                type: blockType,
                settings: settings,
                children: children,
                isExpanded: true,
            }];
        }
        return [];
    }

    case 'Backreference': {
       const ref = node.number ? String(node.number) : node.name;
       return [{
          id: newId,
          type: BlockType.BACKREFERENCE,
          settings: { ref } as BackreferenceSettings,
          children: [],
      }];
    }

    default:
        if (node.raw) {
             return [{
                id: newId,
                type: BlockType.LITERAL,
                settings: { text: node.raw, isRawRegex: true } as LiteralSettings,
                children: [],
            }];
        }
        console.warn(`Unhandled AST node type: ${node.type}`);
        return [];
  }
}
