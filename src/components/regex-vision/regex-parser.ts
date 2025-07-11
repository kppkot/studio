
import regexpTree from 'regexp-tree';
import type { Block, CharacterClassSettings, LiteralSettings, QuantifierSettings, AnchorSettings, LookaroundSettings, BackreferenceSettings, GroupSettings } from './types';
import { BlockType } from './types';
import { generateId } from './utils';

// Main exported function
export function parseRegexWithLibrary(regexString: string): { blocks: Block[], ast: object } {
  console.log(`[Parser] Received regex to parse: /${regexString}/`);
  
  if (!regexString.trim()) {
    return { blocks: [], ast: {} };
  }
  
  try {
    const ast = regexpTree.parse(`/${regexString}/u`, { allowGroupNameDuplicates: true });
    console.log('[Parser] Raw AST from regexp-tree:', JSON.stringify(ast.body, null, 2));
    
    let resultBlocks: Block[] = [];
    if (ast.body) {
        resultBlocks = transformNodeToBlocks(ast.body);
    }

    console.log('[Parser] Transformed & Combined Blocks:', JSON.stringify(resultBlocks, null, 2));
    return { blocks: resultBlocks, ast: ast.body };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Неизвестная ошибка парсера.";
    console.error('[Parser] Syntax Error:', errorMessage);
    throw new Error(`Syntax Error: ${errorMessage}`);
  }
}

function transformNodeToBlocks(node: any): Block[] {
    if (!node) return [];

    const newId = generateId();

    switch (node.type) {
        case 'Alternative': {
             // NEW LOGIC: Combine consecutive characters here directly.
             const combinedExpressions: Block[] = [];
             let currentLiteralText = '';

             const flushLiteral = () => {
                 if (currentLiteralText) {
                     combinedExpressions.push({
                         id: generateId(),
                         type: BlockType.LITERAL,
                         settings: { text: currentLiteralText, isRawRegex: false } as LiteralSettings,
                         children: [],
                     });
                     currentLiteralText = '';
                 }
             };

             for (const expr of node.expressions) {
                 if (expr.type === 'Char' && expr.kind === 'simple') {
                     currentLiteralText += expr.value;
                 } else {
                     flushLiteral();
                     combinedExpressions.push(...transformNodeToBlocks(expr));
                 }
             }
             flushLiteral(); // Add any remaining literal

             return combinedExpressions;
        }

        case 'Char': {
            const value = node.value;
            if (node.kind === 'meta' && ['.', '\\d', '\\D', '\\w', '\\W', '\\s', '\\S'].includes(value)) {
                return [{
                    id: newId, type: BlockType.CHARACTER_CLASS,
                    settings: { pattern: value, negated: false } as CharacterClassSettings,
                    children: [],
                }];
            }
             if (node.kind === 'unicode' && (node.property === 'L' || node.value === 'L')) {
                return [{
                    id: newId, type: BlockType.CHARACTER_CLASS,
                    settings: { pattern: '\\p{L}', negated: false } as CharacterClassSettings,
                    children: [],
                }];
            }
            // This case will now mostly handle single characters that are not part of a sequence
            return [{
                id: newId, type: BlockType.LITERAL,
                settings: { text: value, isRawRegex: false } as LiteralSettings,
                children: [],
            }];
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
                    type, min, max,
                    mode: q.greedy ? 'greedy' : 'lazy',
                } as QuantifierSettings,
                children: [],
            };
            
            return [...subjectBlocks, quantifierBlock];
        }
        
        case 'CharacterClass': {
            const pattern = node.expressions.map((expr: any) => regexpTree.generate(expr)).join('');
            return [{
                id: newId, type: BlockType.CHARACTER_CLASS,
                settings: { pattern, negated: node.negative } as CharacterClassSettings,
                children: [],
                isExpanded: true,
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
            
            return [{
                id: newId, type: BlockType.GROUP,
                settings: { type: groupType, name } as GroupSettings,
                children: transformNodeToBlocks(node.expression),
                isExpanded: true,
            }];
        }

        case 'Disjunction': {
             const leftBranch = transformNodeToBlocks(node.left);
             const rightBranch = transformNodeToBlocks(node.right);
             
             // Wrap each branch in a non-capturing group to visually contain them in the UI.
             const leftGroup: Block = {
                 id: generateId(),
                 type: BlockType.GROUP,
                 settings: { type: 'non-capturing' } as GroupSettings,
                 children: leftBranch,
                 isExpanded: true
             };
             
             const rightGroup: Block = {
                 id: generateId(),
                 type: BlockType.GROUP,
                 settings: { type: 'non-capturing' } as GroupSettings,
                 children: rightBranch,
                 isExpanded: true
             };

             return [{
                id: newId,
                type: BlockType.ALTERNATION,
                settings: {},
                children: [ leftGroup, rightGroup ],
                isExpanded: true,
            }];
        }

        case 'Assertion': {
            if (node.kind === 'Lookahead' || node.kind === 'Lookbehind') {
                return [{
                    id: newId, type: BlockType.LOOKAROUND,
                    settings: {
                        type: `${node.negative ? 'negative' : 'positive'}-${node.kind.toLowerCase()}`
                    } as LookaroundSettings,
                    children: transformNodeToBlocks(node.assertion),
                    isExpanded: true,
                }];
            }
            const anchorTypeMap: { [key: string]: AnchorSettings['type'] } = { '^': '^', '$': '$', '\\b': '\\b', '\\B': '\\B' };
            if (Object.keys(anchorTypeMap).includes(node.kind)) {
                return [{
                    id: newId, type: BlockType.ANCHOR,
                    settings: { type: anchorTypeMap[node.kind] } as AnchorSettings,
                    children: [],
                }];
            }
            return [];
        }

        case 'Backreference': {
            const ref = node.number ? String(node.number) : node.name;
            return [{
                id: newId, type: BlockType.BACKREFERENCE,
                settings: { ref } as BackreferenceSettings,
                children: [],
            }];
        }

        default:
            console.warn(`Unhandled AST node type: ${node.type}`);
            return [];
    }
}
