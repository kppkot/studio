// This file will contain the new, correct parser, built step-by-step.
import regexpTree from 'regexp-tree';
import type { Block } from './types';
import { generateId } from './newlab-utils'; // We will use this soon.

/**
 * Main exported function to parse a regex string.
 * Currently, it only parses and logs the AST for debugging purposes.
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
    // This is our "source of truth".
    console.log('[NewLab Parser] Successfully parsed. AST from regexp-tree:', JSON.stringify(ast.body, null, 2));

    const resultBlocks: Block[] = []; // TODO: Implement transformation logic here.
    
    // For now, we return an empty block array but the correct AST.
    return { blocks: resultBlocks, ast: ast.body };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown parser error.";
    console.error('[NewLab Parser] Syntax Error:', errorMessage);
    // Propagate the error so the UI can display it.
    throw new Error(`Syntax Error: ${errorMessage}`);
  }
}
