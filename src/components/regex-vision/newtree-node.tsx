// This file will be the new, clean implementation for rendering a block node.
// We will fill it in step-by-step.
import React from 'react';
import type { Block } from './types';
import { BLOCK_CONFIGS } from './constants';

// We'll add more props later as we need them.
interface NewTreeNodeProps {
  block: Block;
  // We'll add many more props here for interactivity later
}

const NewTreeNode: React.FC<NewTreeNodeProps> = ({ block }) => {
    // Get the static configuration for the block type (name, icon, etc.)
    const config = BLOCK_CONFIGS[block.type];

    // If for some reason there's no config, render nothing to avoid errors.
    if (!config) {
        console.warn(`[NewTreeNode] Missing config for block type: ${block.type}`);
        return null;
    }

    // A very simple initial rendering.
    // We will build this up step by step.
    return (
        <div className="flex items-center gap-2 p-2 border rounded-md bg-card shadow-sm">
            <span className="text-primary">{config.icon}</span>
            <h3 className="font-semibold text-sm">{config.name}</h3>
        </div>
    );
}

export default NewTreeNode;