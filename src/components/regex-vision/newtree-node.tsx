// This file will be the new, clean implementation for rendering a block node.
// We will fill it in step-by-step.
import React from 'react';
import type { Block, GroupInfo } from './types';
import { BLOCK_CONFIGS } from './constants';
import { cn } from '@/lib/utils';


// We'll add more props later as we need them.
interface NewTreeNodeProps {
  block: Block;
  quantifierToRender?: Block | null;
  parentId: string | null;
  depth?: number;
  renderChildNodes: (nodes: Block[], parentId: string, depth: number, groupInfos: GroupInfo[]) => React.ReactNode[];
  // We'll add many more props here for interactivity later
}

const NewTreeNode: React.FC<NewTreeNodeProps> = ({
    block,
    quantifierToRender,
    parentId,
    depth = 0,
    renderChildNodes,
}) => {
    // Get the static configuration for the block type (name, icon, etc.)
    const config = BLOCK_CONFIGS[block.type];
    const hasChildren = block.children && block.children.length > 0;

    // If for some reason there's no config, render nothing to avoid errors.
    if (!config) {
        console.warn(`[NewTreeNode] Missing config for block type: ${block.type}`);
        return null;
    }

    return (
        <div style={{ marginLeft: `${depth * 1.5}rem` }}>
            <div className="flex items-center gap-2 p-2 border rounded-md bg-card shadow-sm">
                <span className="text-primary">{config.icon}</span>
                <h3 className="font-semibold text-sm">{config.name}</h3>
            </div>

            {hasChildren && (
                <div className="children-container mt-1 pl-6 relative">
                     <div className="absolute left-[18px] top-0 bottom-2 w-px bg-primary/20"></div>
                     <div className="space-y-1 pt-1">
                        {renderChildNodes(block.children, block.id, depth + 1, [])}
                    </div>
                </div>
            )}
        </div>
    );
}

export default NewTreeNode;
