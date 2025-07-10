
import regexpTree from 'regexp-tree';
import type { Block, CharacterClassSettings, LiteralSettings, QuantifierSettings, AnchorSettings, LookaroundSettings, BackreferenceSettings, GroupSettings } from './types';
import { BlockType } from './types';
import { generateId } from './utils';

// Main exported function
export function parseRegexWithLibrary(regexString: string): { blocks: Block[], ast: object } {
  if (!regexString.trim()) {
    return { blocks: [], ast: {} };
  }
  
  try {
    const ast = regexpTree.parse(`/${regexString}/u`, { allowGroupNameDuplicates: true });
    
    let resultBlocks: Block[] = [];
    if (ast.body?.type === 'Alternative') {
        resultBlocks = transformAlternativeToBlocks(ast.body);
    } else if (ast.body) {
        resultBlocks = transformNodeToBlocks(ast.body);
    }

    return { blocks: resultBlocks, ast: ast.body };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Неизвестная ошибка парсера.";
    let friendlyMessage = `Ошибка синтаксиса в выражении. ${errorMessage}`;
    if (errorMessage.includes('Unexpected quantifier')) {
      friendlyMessage = 'Синтаксическая ошибка: квантификатор (например, *, +, ?) оказался в неожиданном месте, ему нечего повторять.';
    }
    if (errorMessage.includes('Unmatched left parenthesis')) {
      friendlyMessage = 'Синтаксическая ошибка: есть незакрытая открывающая скобка `(`.'
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

function transformAlternativeToBlocks(alternativeNode: any): Block[] {
    if (!alternativeNode || !alternativeNode.expressions) return [];
    
    let blocks: Block[] = [];
    for (const expr of alternativeNode.expressions) {
        blocks.push(...transformNodeToBlocks(expr));
    }
    return blocks;
}

// The one and only recursive transformer.
function transformNodeToBlocks(node: any): Block[] {
    if (!node) return [];

    const newId = generateId();

    switch (node.type) {
        case 'Alternative': {
             return transformAlternativeToBlocks(node);
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
            return [{
                id: newId, type: BlockType.LITERAL,
                settings: { text: value, isRawRegex: false } as LiteralSettings,
                children: [],
            }];
        }

        case 'CharacterClass': {
            const pattern = node.expressions.map((expr: any) => regexpTree.generate(expr)).join('');
            return [{
                id: newId, type: BlockType.CHARACTER_CLASS,
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
             
             return [{
                id: newId,
                type: BlockType.ALTERNATION,
                settings: {},
                children: [
                    ...leftBranch,
                    ...rightBranch
                ],
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
            return [];
    }
}
