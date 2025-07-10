
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
    if (ast.body) {
        resultBlocks = transformNodeToBlocks(ast.body);
    }

    return { blocks: resultBlocks, ast: ast.body };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Неизвестная ошибка парсера.";
    // Keep error messages simple for now
    throw new Error(`Ошибка синтаксиса: ${errorMessage}`);
  }
}

// This is now the ONLY transformation function. No helpers.
function transformNodeToBlocks(node: any): Block[] {
    if (!node) return [];

    const newId = generateId();

    switch (node.type) {
        // A sequence of expressions
        case 'Alternative': {
             return node.expressions.flatMap(transformNodeToBlocks);
        }

        // A single character or simple escape
        case 'Char': {
            const value = node.value;
            // Handle simple meta characters as CharacterClass blocks
            if (node.kind === 'meta' && ['.', '\\d', '\\D', '\\w', '\\W', '\\s', '\\S'].includes(value)) {
                return [{
                    id: newId, type: BlockType.CHARACTER_CLASS,
                    settings: { pattern: value, negated: false } as CharacterClassSettings,
                    children: [],
                }];
            }
             // Handle unicode property escapes
             if (node.kind === 'unicode' && (node.property === 'L' || node.value === 'L')) {
                return [{
                    id: newId, type: BlockType.CHARACTER_CLASS,
                    settings: { pattern: '\\p{L}', negated: false } as CharacterClassSettings,
                    children: [],
                }];
            }
            // Everything else is a literal character
            return [{
                id: newId, type: BlockType.LITERAL,
                settings: { text: value, isRawRegex: false } as LiteralSettings,
                children: [],
            }];
        }

        // A repetition like *, +, ?, {n,m}
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
                    type, min, max,
                    mode: q.greedy ? 'greedy' : 'lazy',
                } as QuantifierSettings,
                children: [],
            };
            
            // The quantifier applies to the preceding block.
            return [...subjectBlocks, quantifierBlock];
        }
        
        // A character class like [a-z] or [^0-9]
        case 'CharacterClass': {
            const pattern = node.expressions.map((expr: any) => regexpTree.generate(expr)).join('');
            return [{
                id: newId, type: BlockType.CHARACTER_CLASS,
                settings: { pattern, negated: node.negative } as CharacterClassSettings,
                children: [],
                isExpanded: true,
            }];
        }

        // A group like (...) or (?:...)
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
                children: transformNodeToBlocks(node.expression), // The expression is the content of the group
                isExpanded: true,
            }];
        }

        // The OR operator |
        case 'Disjunction': {
             // THIS IS THE CRITICAL PART - NO WRAPPING!
             const leftBlocks = transformNodeToBlocks(node.left);
             const rightBlocks = transformNodeToBlocks(node.right);

             // To keep the left and right sides as distinct alternatives,
             // we create a placeholder group for each.
             const leftGroup: Block = { id: generateId(), type: BlockType.GROUP, settings: { type: 'non-capturing' }, children: leftBlocks, isExpanded: true };
             const rightGroup: Block = { id: generateId(), type: BlockType.GROUP, settings: { type: 'non-capturing' }, children: rightBlocks, isExpanded: true };

             return [{
                id: newId,
                type: BlockType.ALTERNATION,
                settings: {},
                children: [ leftGroup, rightGroup ],
                isExpanded: true,
            }];
        }

        // An assertion like ^, $, \b, (?=...)
        case 'Assertion': {
            // Lookarounds are groups with an assertion
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
            // Anchors are simple assertions
            const anchorTypeMap: { [key: string]: AnchorSettings['type'] } = { '^': '^', '$': '$', '\\b': '\\b', '\\B': '\\B' };
            if (Object.keys(anchorTypeMap).includes(node.kind)) {
                return [{
                    id: newId, type: BlockType.ANCHOR,
                    settings: { type: anchorTypeMap[node.kind] } as AnchorSettings,
                    children: [],
                }];
            }
            return []; // Other assertions not handled
        }

        // A backreference like \1 or \k<name>
        case 'Backreference': {
            const ref = node.number ? String(node.number) : node.name;
            return [{
                id: newId, type: BlockType.BACKREFERENCE,
                settings: { ref } as BackreferenceSettings,
                children: [],
            }];
        }

        default:
            // For any unhandled node type, return empty and log it.
            console.warn(`Unhandled AST node type: ${node.type}`);
            return [];
    }
}
