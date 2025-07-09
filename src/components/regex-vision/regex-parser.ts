import regexpTree from 'regexp-tree';
import type { Block, CharacterClassSettings, LiteralSettings, QuantifierSettings, AnchorSettings, LookaroundSettings, BackreferenceSettings, GroupSettings, ConditionalSettings } from './types';
import { BlockType } from './types';
import { generateId, createLiteral } from './utils';

// Main exported function
export function parseRegexWithLibrary(regexString: string): Block[] {
  try {
    console.log('--- DEBUG: STEP 1: Input to parseRegexWithLibrary ---');
    console.log('Regex String:', regexString);

    // The 'u' flag is essential for regexp-tree to correctly parse Unicode and other modern features.
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

// Simplified function to handle lists of expressions by fusing simple characters.
function transformExpressionList(expressions: any[]): Block[] {
    const fusedBlocks: Block[] = [];
    let currentLiteralText = '';

    const pushCurrentLiteral = () => {
        if (currentLiteralText) {
            fusedBlocks.push(createLiteral(currentLiteralText));
            currentLiteralText = '';
        }
    };

    for (const expr of expressions) {
        // We only fuse simple, non-escaped characters.
        if (expr.type === 'Char' && expr.kind === 'simple' && !expr.escaped) {
            currentLiteralText += expr.value;
        } else {
            pushCurrentLiteral(); // Push any accumulated literal first
            fusedBlocks.push(...transformNodeToBlocks(expr)); // Then handle the complex node
        }
    }
    pushCurrentLiteral(); // Push any remaining literal at the end

    return fusedBlocks;
}


// Main transformation logic. This is a recursive function.
function transformNodeToBlocks(node: any): Block[] {
  if (!node) return [];

  const newId = generateId();

  switch (node.type) {
    case 'Alternative':
        // An Alternative is a sequence of expressions.
        return transformExpressionList(node.expressions || []);

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
                // regexp-tree uses undefined for unbounded max, not Infinity
                max = q.to === undefined ? null : q.to;
                if (min !== undefined && max === null) type = '{n,}';
                else if (min !== undefined && max !== undefined && min === max) type = '{n}';
                else if (min !== undefined && max !== undefined) type = '{n,m}';
                break;
        }

        if (type === null) return subjectBlocks; // Should not happen with valid regex

        const quantifierBlock: Block = {
            id: generateId(),
            type: BlockType.QUANTIFIER,
            settings: {
                type,
                min: min,
                max: max,
                mode: q.greedy ? 'greedy' : (q.greedy === false ? 'lazy' : 'greedy'), // Handle explicit non-greedy
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
      // Use regexp-tree's generator to get the inner pattern string.
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

    case 'Disjunction': { // This is the "OR" operator |
        const left = node.left ? transformNodeToBlocks(node.left) : [];
        const right = node.right ? transformNodeToBlocks(node.right) : [];

        // If the left side is already an alternation, flatten it to avoid deep nesting.
        if (left.length === 1 && left[0].type === BlockType.ALTERNATION) {
             return [{
                ...left[0],
                children: [...left[0].children, ...right]
             }];
        }
        
        return [{
            id: newId,
            type: BlockType.ALTERNATION,
            settings: {},
            children: [...left, ...right],
            isExpanded: true,
        }];
    }
    
    case 'Assertion': {
        console.log('--- DEBUG: STEP 3: Processing Assertion node ---', JSON.stringify({kind: node.kind}));
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
        // Fallback for any unhandled node types.
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