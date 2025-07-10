import regexpTree from 'regexp-tree';
import type { Block, CharacterClassSettings, LiteralSettings, QuantifierSettings, AnchorSettings, LookaroundSettings, BackreferenceSettings, GroupSettings } from './types';
import { BlockType } from './types';
import { generateId } from './utils';

// Main exported function
export function parseRegexWithLibrary(regexString: string): Block[] {
  console.log('--- DEBUG: STEP 1: Input to parseRegexWithLibrary ---');
  console.log('Regex String:', regexString);

  if (!regexString.trim()) {
    return [];
  }
  
  try {
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

// Simple recursive transformer. No more "smart" logic.
function transformNodeToBlocks(node: any): Block[] {
  if (!node) return [];

  const newId = generateId();

  switch (node.type) {
    // A sequence of expressions
    case 'Alternative':
      return node.expressions.flatMap((expr: any) => transformNodeToBlocks(expr));

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
        if (node.kind === 'unicode' && node.symbol === 'L') {
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
            // The direct child of a disjunction is an 'Alternative', which contains the actual expressions.
            return altNode.expressions.flatMap((expr: any) => transformNodeToBlocks(expr));
        };
        
        let leftBlocks = processAlternative(node.left);
        let rightBlocks = processAlternative(node.right);

        // This is the key logic: if an alternative expanded into more than one block,
        // it needs to be wrapped in a non-capturing group to preserve its meaning.
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
