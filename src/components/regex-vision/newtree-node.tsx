// This file will be the new, clean implementation for rendering a block node.
// We will fill it in step-by-step.
import React from 'react';
import type { Block, GroupInfo, QuantifierSettings, GroupSettings, CharacterClassSettings, LiteralSettings, AlternationSettings } from './types';
import { BlockType } from './types';
import { BLOCK_CONFIGS } from './constants';
import { cn } from '@/lib/utils';
import { Repeat } from 'lucide-react';


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
    
    const getBlockVisuals = () => {
        const settings = block.settings;
        let title = config.name;
        let details = '';
        let regexFragment = '';

        switch (block.type) {
            case BlockType.LITERAL:
                const litSettings = settings as LiteralSettings;
                title = 'Текст';
                regexFragment = litSettings.text || '';
                if (!regexFragment) {
                    details = 'Пустой литерал.';
                }
                break;
            case BlockType.GROUP:
                 const gSettings = settings as GroupSettings;
                 switch(gSettings.type) {
                    case 'capturing':
                        title = 'Группа (захватывающая)';
                        regexFragment = `(...)`;
                        break;
                    case 'non-capturing':
                        title = `Группа (незахватывающая)`;
                        regexFragment = `(?:...)`;
                        break;
                    case 'named':
                        title = `Группа (имя: ${gSettings.name || '...'})`;
                        regexFragment = `(?<${gSettings.name || '...'}>...)`;
                        break;
                 }
                 break;
            case BlockType.ALTERNATION:
                title = 'Чередование (ИЛИ)';
                details = 'Совпадает с одним из вариантов';
                regexFragment = '...|...';
                break;
             // Add more cases here as needed
        }
        return { icon: config.icon, title, details, regexFragment };
    }

    const { icon, title, details, regexFragment } = getBlockVisuals();

    const renderQuantifierBadge = () => {
        if (!quantifierToRender) return null;

        const qSettings = quantifierToRender.settings as QuantifierSettings;
        let badgeDetails = '';
        switch (qSettings.type) {
            case '*': badgeDetails = '0+'; break;
            case '+': badgeDetails = '1+'; break;
            case '?': badgeDetails = '0–1'; break;
            case '{n}': badgeDetails = `{${qSettings.min ?? 0}}`; break;
            case '{n,}': badgeDetails = `${qSettings.min ?? 0}+`; break;
            case '{n,m}': badgeDetails = `${qSettings.min ?? 0}–${qSettings.max ?? ''}`; break;
        }
        
        return (
          <div
            className={cn(
              "absolute top-1/2 -translate-y-1/2 right-4 z-10 cursor-pointer",
              "bg-sky-100 text-sky-800 border-sky-300 border",
              "dark:bg-sky-900/50 dark:text-sky-300 dark:border-sky-700/50",
              "px-2 py-1 rounded-full text-xs font-semibold shadow-md flex items-center gap-1.5"
            )}
            title={`${qSettings.mode} квантификатор`}
          >
            <Repeat size={12} />
            <span>{badgeDetails}</span>
          </div>
        );
    };


    return (
        <div style={{ marginLeft: `${depth * 1.5}rem` }} className="relative">
            <div className="relative p-2 border rounded-md bg-card shadow-sm">
                <div className="flex items-start gap-3">
                     <div className="w-7 h-7 flex-shrink-0" />
                     <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center gap-2">
                          <span className="text-primary h-5 w-5 flex items-center justify-center">{icon}</span>
                          <h3 className="font-semibold text-sm truncate">{title}</h3>
                        </div>

                        {(details || regexFragment) && (
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                {details && <p className="text-xs text-muted-foreground">{details}</p>}
                                {regexFragment && (
                                    <div className="px-1.5 py-0.5 bg-muted/70 rounded font-mono text-xs text-foreground/80">
                                        {regexFragment}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
                 {renderQuantifierBadge()}
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
