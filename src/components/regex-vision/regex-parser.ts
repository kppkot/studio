import regexpTree from 'regexp-tree';
import type { Block, CharacterClassSettings, LiteralSettings, QuantifierSettings, AnchorSettings, LookaroundSettings, BackreferenceSettings, GroupSettings } from './types';
import { BlockType } from './types';
import { generateId } from './utils';

// Main exported function
export function parseRegexWithLibrary(regexString: string): { blocks: Block[], ast: object } {
  console.log('--- DEBUG: STEP 1: Input to parseRegexWithLibrary ---');
  console.log('Regex String:', regexString);

  if (!regexString.trim()) {
    return { blocks: [], ast: {} };
  }
  
  try {
    const ast = regexpTree.parse(`/${regexString}/u`, { allowGroupNameDuplicates: true });
    console.log('--- DEBUG: STEP 2: Parsed AST from regexp-tree ---');
    console.log(JSON.stringify(ast.body, null, 2));
    
    const resultBlocks = transformNodeToBlocks(ast.body);

    console.log('--- DEBUG: STEP 4: Final blocks returned from parser ---');
    console.log(JSON.stringify(resultBlocks, null, 2));
    return { blocks: resultBlocks, ast: ast.body };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Неизвестная ошибка парсера.";
    let friendlyMessage = `Ошибка синтаксиса в выражении. ${errorMessage}`;
    if (errorMessage.includes('Unexpected quantifier')) {
      friendlyMessage = 'Синтаксическая ошибка: квантификатор (например, *, +, ?) оказался в неожиданном месте, ему нечего повторять.';
    }
    if (errorMessage.includes('Unmatched left parenthesis')) {
      friendlyMessage = 'Синтаксическая ошибка: есть незакрытая открывающая скобка `(`.';
    }
    if (errorMessage.includes('Unmatched right parenthesis')) {
      friendlyMessage = 'Синтаксическая ошибка: найдена лишняя закрывающая скобка `)`.';
    }
     if (errorMessage.includes('Invalid group')) {
      friendlyMessage = 'Синтаксическая ошибка: неверная или неполная группа.';
    }
    if (errorMessage.includes('Invalid character class')) {
      friendlyMessage = 'Синтаксическая ошибка: неверно сформирован символьный класс (выражение в квадратных скобках `[]`).';
    }
    if (errorMessage.includes('Trailing backslash')) {
      friendlyMessage = 'Синтаксическая ошибка: выражение не может заканчиваться одиночным обратным слэшем `\\`.';
    }
    throw new Error(friendlyMessage);
  }
}

// Simple recursive transformer. No more "smart" logic.
function transformNodeToBlocks(node: any): Block[] {
  if (!node) return [];

  // This function handles sequences of expressions like 'abc' or the content of a group.
  const transformNodeListToBlocks = (expressions: any[]): Block[] => {
    console.log('--- DEBUG: transformNodeListToBlocks: Processing expressions:', expressions);
    const blocks: Block[] = [];
    for (const expr of expressions) {
      blocks.push(...transformNodeToBlocks(expr));
    }
    
    // This is the "smart" part that was causing issues. We'll try to combine adjacent simple characters.
    const combinedBlocks: Block[] = [];
    let currentLiteral = '';

    for (const block of blocks) {
      const isSimpleLiteral = block.type === BlockType.LITERAL && !(block.settings as LiteralSettings).isRawRegex;
      
      if (isSimpleLiteral) {
        currentLiteral += (block.settings as LiteralSettings).text;
      } else {
        if (currentLiteral) {
          combinedBlocks.push({
            id: generateId(),
            type: BlockType.LITERAL,
            settings: { text: currentLiteral, isRawRegex: false } as LiteralSettings,
            children: [],
            isExpanded: false
          });
          currentLiteral = '';
        }
        combinedBlocks.push(block);
      }
    }

    if (currentLiteral) {
      combinedBlocks.push({
        id: generateId(),
        type: BlockType.LITERAL,
        settings: { text: currentLiteral, isRawRegex: false } as LiteralSettings,
        children: [],
        isExpanded: false
      });
    }

    console.log('--- DEBUG: transformNodeListToBlocks: Produced blocks:', combinedBlocks);
    return combinedBlocks;
  };

  const newId = generateId();

  switch (node.type) {
    // A sequence of expressions
    case 'Alternative':
      return transformNodeListToBlocks(node.expressions);

    // A repeating element, e.g., a* or a{1,3}
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

        if (type === null) return subjectBlocks; // Should not happen with valid regex

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

    // A single character or escape sequence
    case 'Char': {
        const value = node.value;
        // Meta characters like \d, \s, .
        if (node.kind === 'meta' && ['.', '\\d', '\\D', '\\w', '\\W', '\\s', '\\S'].includes(value)) {
             return [{
                id: newId,
                type: BlockType.CHARACTER_CLASS,
                settings: { pattern: value, negated: false } as CharacterClassSettings,
                children: [],
            }];
        }
        // Unicode properties like \p{L}
        if (node.kind === 'unicode' && (node.value === 'L' || (node.property === 'L' && node.value ==='L'))) {
             return [{
                id: newId,
                type: BlockType.CHARACTER_CLASS,
                settings: { pattern: '\\p{L}', negated: false } as CharacterClassSettings,
                children: [],
            }];
        }
        // Simple characters
        return [{
          id: newId,
          type: BlockType.LITERAL,
          settings: { text: value, isRawRegex: false } as LiteralSettings,
          children: [],
          isExpanded: false
        }];
    }

    // A character class, e.g., [a-z]
    case 'CharacterClass': {
      const pattern = node.expressions.map((expr: any) => regexpTree.generate(expr)).join('');
      return [{
          id: newId,
          type: BlockType.CHARACTER_CLASS,
          settings: { pattern, negated: node.negative } as CharacterClassSettings,
          children: [],
      }];
    }

    // A group, e.g., (...) or (?:...)
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

    // Alternation, e.g., a|b
    case 'Disjunction': {
        console.log('--- DEBUG: DISJUNCTION: Processing AST alternatives:', { left: node.left, right: node.right });
        
        // Helper to process each side of the disjunction
        const processAlternative = (altNode: any): Block[] => {
            if (!altNode) return [];
            // A Disjunction's child can be another Disjunction or an Alternative.
            if (altNode.type === 'Disjunction') {
                return transformNodeToBlocks(altNode);
            }
            return transformNodeListToBlocks(altNode.expressions);
        };
        
        let leftBlocks = processAlternative(node.left);
        let rightBlocks = processAlternative(node.right);

        // If an alternative consists of more than one block, it needs to be wrapped
        // in a non-capturing group to preserve its meaning within the alternation.
        if (leftBlocks.length > 1) {
            leftBlocks = [{
                id: generateId(),
                type: BlockType.GROUP,
                settings: { type: 'non-capturing' } as GroupSettings,
                children: leftBlocks,
                isExpanded: true,
            }];
        }
         if (rightBlocks.length > 1) {
            rightBlocks = [{
                id: generateId(),
                type: BlockType.GROUP,
                settings: { type: 'non-capturing' } as GroupSettings,
                children: rightBlocks,
                isExpanded: true,
            }];
        }

        const finalChildren = [...leftBlocks, ...rightBlocks];
        console.log('--- DEBUG: DISJUNCTION: Final children for ALTERNATION block:', JSON.stringify(finalChildren, null, 2));

        return [{
            id: newId,
            type: BlockType.ALTERNATION,
            settings: {},
            children: finalChildren,
            isExpanded: true,
        }];
    }
    
    // An assertion, e.g., ^, $, \b, (?=...)
    case 'Assertion': {
        console.log("--- DEBUG: STEP 3: Processing Assertion node ---", { kind: node.kind });
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

    // A backreference, e.g., \1 or \k<name>
    case 'Backreference': {
       const ref = node.number ? String(node.number) : node.name;
       return [{
          id: newId,
          type: BlockType.BACKREFERENCE,
          settings: { ref } as BackreferenceSettings,
          children: [],
      }];
    }

    // Default case for any unhandled node type
    default:
        console.warn(`Unhandled AST node type: ${node.type}. Raw value: ${node.raw || 'N/A'}`);
        return [];
  }
}
