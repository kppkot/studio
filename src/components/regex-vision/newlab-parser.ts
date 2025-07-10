// This file will contain the new, correct parser, built step-by-step.
import regexpTree from 'regexp-tree';
import type { Block, LiteralSettings, GroupSettings } from './types';
import { BlockType } from './types';
import { generateId } from './newlab-utils'; // We will use this soon.

/**
 * Main exported function to parse a regex string.
 * It will be expanded step-by-step.
 * @param regexString The regular expression string to parse.
 * @returns An object containing the generated blocks and the raw AST.
 */
export function parseRegexWithLibrary(regexString: string): { blocks: Block[], ast: object } {
  console.log(`[NewLab Parser] Received regex to parse: /${regexString}/`);

  if (!regexString.trim()) {
    console.log('[NewLab Parser] Regex is empty. Returning empty result.');
    return { blocks: [], ast: {} };
  }
  
  try {
    // We use the 'u' flag to ensure full Unicode support, which is good practice.
    const ast = regexpTree.parse(`/${regexString}/u`, { allowGroupNameDuplicates: true });
    
    // As requested, log the raw AST from the library to the console.
    console.log('[NewLab Parser] Successfully parsed. Raw AST from regexp-tree:', JSON.stringify(ast.body, null, 2));

    const resultBlocks = transformNodeToBlocks(ast.body);
    
    // NEW: Log the generated blocks to check our transformation logic.
    console.log('[NewLab Parser] Transformed Blocks:', JSON.stringify(resultBlocks, null, 2));
    
    return { blocks: resultBlocks, ast: ast.body };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown parser error.";
    console.error('[NewLab Parser] Syntax Error:', errorMessage);
    // Propagate the error so the UI can display it.
    throw new Error(`Syntax Error: ${errorMessage}`);
  }
}


/**
 * Recursively transforms an AST node from regexp-tree into our Block structure.
 * @param node The AST node to transform.
 * @returns An array of Block objects.
 */
function transformNodeToBlocks(node: any): Block[] {
    if (!node) {
        return [];
    }

    const newId = generateId();

    switch (node.type) {
        case 'Group':
            return [{
                id: newId,
                type: BlockType.GROUP,
                settings: {
                    type: node.capturing ? 'capturing' : 'non-capturing',
                    name: typeof node.name === 'string' ? node.name : undefined
                } as GroupSettings,
                children: transformNodeToBlocks(node.expression),
                isExpanded: true,
            }];

        case 'Alternative':
            // An Alternative is a sequence of expressions, so we process each one
            // and flatten the resulting arrays of blocks.
            return node.expressions.flatMap(transformNodeToBlocks);

        case 'Char':
            // A simple character becomes a LITERAL block.
            return [{
                id: newId,
                type: BlockType.LITERAL,
                settings: {
                    text: node.value,
                    isRawRegex: false
                } as LiteralSettings,
                children: [],
            }];

        // TODO: Add more cases here, starting with Repetition and Disjunction.
        default:
            console.warn(`[NewLab Parser] Unhandled AST node type: ${node.type}`);
            return [];
    }
}
