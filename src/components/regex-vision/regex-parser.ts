
import regexpTree from 'regexp-tree';
import type { Block, CharacterClassSettings, LiteralSettings, QuantifierSettings, AnchorSettings, LookaroundSettings, BackreferenceSettings, GroupSettings, ConditionalSettings } from './types';
import { BlockType } from './types';
import { generateId, createLiteral } from './utils';

// Main exported function
export function parseRegexWithLibrary(regexString: string): Block[] {
  try {
    // --- DEBUG ---
    console.log('--- DEBUG: STEP 1: Input to parseRegexWithLibrary ---');
    console.log('Regex String:', regexString);
    const placeholder = '\uE000'; 
    const escapedRegexString = regexString
      .replace(/\\\//g, placeholder)
      .replace(/\//g, '\\/')
      .replace(new RegExp(placeholder, 'g'), '\\/');

    const ast = regexpTree.parse(`/${escapedRegexString}/u`, { allowGroupNameDuplicates: true });
    
    // --- DEBUG ---
    console.log('--- DEBUG: STEP 2: Parsed AST from regexp-tree ---');
    console.log(JSON.stringify(ast, null, 2));
    
    if (ast.body) {
      const resultBlocks = transformNodeToBlocks(ast.body);
       // --- DEBUG ---
      console.log('--- DEBUG: STEP 4: Final blocks returned from parser ---');
      console.log(JSON.stringify(resultBlocks, null, 2));
      // --- END DEBUG ---
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
        console.log('--- DEBUG: ALTERNATIVE: Processing expressions:', JSON.stringify(expressions));
        const fusedBlocks: Block[] = [];
        let currentLiteralText = '';

        for (const expr of expressions) {
            // If the current expression is a simple character...
            if (expr.type === 'Char' && expr.kind === 'simple') {
                currentLiteralText += expr.value;
            } else {
                // ...otherwise, it's a complex node (like Repetition, Group, etc.)
                // First, push any accumulated literal string as a block.
                if (currentLiteralText) {
                    fusedBlocks.push(createLiteral(currentLiteralText));
                    currentLiteralText = '';
                }
                // Then, process the complex expression and add its blocks.
                fusedBlocks.push(...transformNodeToBlocks(expr));
            }
        }

        // After the loop, push any remaining accumulated literal.
        if (currentLiteralText) {
            fusedBlocks.push(createLiteral(currentLiteralText));
        }
        console.log('--- DEBUG: ALTERNATIVE: Produced blocks:', JSON.stringify(fusedBlocks));
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
      const pattern = node.expressions.map((expr: any) => regexpTree.generate(expr)).join('');
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
        console.log('--- DEBUG: DISJUNCTION: Processing AST alternatives:', JSON.stringify(alternativesAstNodes));
        
        const alternativeBlocks = alternativesAstNodes.map(altNode => {
            if (!altNode) return null;
            return transformNodeToBlocks(altNode);
        }).filter((b): b is Block[] => b !== null && b.length > 0);
        console.log('--- DEBUG: DISJUNCTION: Processed alternatives into block arrays:', JSON.stringify(alternativeBlocks));


        const finalChildren = alternativeBlocks.map(blocks => {
            if (blocks.length === 1) {
                return blocks[0];
            }
            // If an alternative consists of multiple blocks, wrap it in a non-capturing group
            // to treat it as a single unit within the alternation.
            const wrapperGroup: Block = {
                id: generateId(),
                type: BlockType.GROUP,
                settings: { type: 'non-capturing' } as GroupSettings,
                children: blocks,
                isExpanded: true
            };
            console.log('--- DEBUG: DISJUNCTION: Wrapping multi-block alternative in a group:', JSON.stringify(wrapperGroup));
            return wrapperGroup;
        });
        console.log('--- DEBUG: DISJUNCTION: Final children for ALTERNATION block:', JSON.stringify(finalChildren));

        const alternationBlock: Block = {
            id: newId,
            type: BlockType.ALTERNATION,
            settings: {},
            children: finalChildren,
            isExpanded: true,
        };
        
        return [alternationBlock];
    }

    case 'Assertion': {
        // --- DEBUG ---
        console.log('--- DEBUG: STEP 3: Processing Assertion node ---', { kind: node.kind, negative: node.negative });
        // --- END DEBUG ---
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
        } else if (node.kind === '^' || node.kind === '$' || node.kind === '\\b' || node.kind === '\\B') {
            blockType = BlockType.ANCHOR;
            settings.type = node.kind;
        } else {
            return [];
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
