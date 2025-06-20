
"use client";
import React, { useState, useEffect, useCallback } from 'react';
import type { Block, RegexMatch, GroupInfo, SavedPattern, NaturalLanguageRegexOutput } from './types'; 
import { BlockType } from './types';
import { BLOCK_CONFIGS } from './constants';
import { generateId, generateRegexStringAndGroupInfo, createLiteral, processAiBlocks, createSequenceGroup, escapeRegexChars, createCharClass, createQuantifier, createAnchor, createAlternation, createLookaround, createBackreference } from './utils'; 
import { useToast } from '@/hooks/use-toast';
import { generateRegexFromNaturalLanguage } from '@/ai/flows/natural-language-regex-flow';

import AppHeader from './AppHeader';
import BlockNode from './BlockNode';
import SettingsPanel from './SettingsPanel';
import BlockPalette from './BlockPalette';
import RegexOutputDisplay from './RegexOutputDisplay';
import TestArea from './TestArea';
import CodeGenerationPanel from './CodeGenerationPanel';
import DebugView from './DebugView';
import PerformanceAnalyzerView from './PerformanceAnalyzerView';
import PatternLibraryView from './PatternLibraryView';
import RegexWizardModal from './RegexWizardModal';
import { Button } from '@/components/ui/button';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Layers, Edit3, Code2, PlayCircle, Bug, Plus, FoldVertical, UnfoldVertical, Sparkles, Gauge, Library } from 'lucide-react'; 
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

const deepCloneBlock = (block: Block): Block => {
  const newBlock: Block = {
    ...block,
    id: generateId(),
    settings: { ...block.settings },
    children: block.children ? block.children.map(child => deepCloneBlock(child)) : [],
    isExpanded: block.isExpanded,
  };
  if ([BlockType.GROUP, BlockType.LOOKAROUND, BlockType.ALTERNATION, BlockType.CONDITIONAL].includes(newBlock.type)) {
      newBlock.children = newBlock.children || [];
  }
  return newBlock;
};

const cloneBlockForState = (block: Block): Block => {
  const newBlock: Block = {
    ...block,
    settings: { ...block.settings },
    children: block.children ? block.children.map(child => cloneBlockForState(child)) : [],
  };
  if ([BlockType.GROUP, BlockType.LOOKAROUND, BlockType.ALTERNATION, BlockType.CONDITIONAL].includes(newBlock.type)) {
      newBlock.children = newBlock.children || [];
  }
  return newBlock;
}


const duplicateAndInsertBlockRecursive = (currentBlocks: Block[], targetId: string): { updatedBlocks: Block[], success: boolean } => {
  for (let i = 0; i < currentBlocks.length; i++) {
    const block = currentBlocks[i];
    if (block.id === targetId) {
      const originalBlock = block;
      const newBlock = deepCloneBlock(originalBlock);
      const updatedBlocks = [...currentBlocks];
      updatedBlocks.splice(i + 1, 0, newBlock);
      return { updatedBlocks, success: true };
    }
    if (block.children && block.children.length > 0) {
      const result = duplicateAndInsertBlockRecursive(block.children, targetId);
      if (result.success) {
        const updatedBlocks = [...currentBlocks];
        updatedBlocks[i] = { ...block, children: result.updatedBlocks };
        return { updatedBlocks, success: true };
      }
    }
  }
  return { updatedBlocks: currentBlocks, success: false };
};

const processUngroupRecursive = (nodes: Block[], targetId: string): Block[] => {
  return nodes.flatMap(block => {
    if (block.id === targetId) {
      return block.children ? block.children.map(child => cloneBlockForState(child)) : [];
    }
    if (block.children && block.children.length > 0) {
      return [{ ...block, children: processUngroupRecursive(block.children, targetId) }];
    }
    return [block];
  });
};

const findBlockAndParentRecursive = (
  nodes: Block[],
  targetId: string,
  currentParent: Block | null = null
): { block: Block | null; parent: Block | null; indexInParent: number } => {
  for (let i = 0; i < nodes.length; i++) {
    const block = nodes[i];
    if (block.id === targetId) {
      return { block, parent: currentParent, indexInParent: i };
    }
    if (block.children) {
      const found = findBlockAndParentRecursive(block.children, targetId, block);
      if (found.block) return found;
    }
  }
  return { block: null, parent: null, indexInParent: -1 };
};


const RegexVisionWorkspace: React.FC = () => {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null); 
  const [parentIdForNewBlock, setParentIdForNewBlock] = useState<string | null>(null);
  const [isPaletteVisible, setIsPaletteVisible] = useState(false);
  const [isWizardModalOpen, setIsWizardModalOpen] = useState(false);

  const [testText, setTestText] = useState<string>('Быстрая коричневая лиса прыгает через ленивую собаку.');
  const [regexFlags, setRegexFlags] = useState<string>('g');
  const [matches, setMatches] = useState<RegexMatch[]>([]);
  const [regexOutput, setRegexOutput] = useState<{ regexString: string; groupInfos: GroupInfo[] }>({ regexString: '', groupInfos: [] });
  const [highlightedGroupInTestArea, setHighlightedGroupInTestArea] = useState<{ groupIndex: number } | null>(null);


  const { toast } = useToast();

  useEffect(() => {
    const { regexString: newRegex, groupInfos } = generateRegexStringAndGroupInfo(blocks);
    setRegexOutput({ regexString: newRegex, groupInfos });

    if (newRegex && testText) {
      try {
        const currentFlags = regexFlags.includes('d') ? regexFlags : regexFlags + (regexFlags.length ? '' : '') + 'd';

        const regexObj = new RegExp(newRegex, currentFlags);
        const foundRawMatches = [...testText.matchAll(regexObj)];
        const formattedMatches: RegexMatch[] = foundRawMatches.map(rawMatch => ({
          match: rawMatch[0],
          index: rawMatch.index!,
          groups: Array.from(rawMatch).slice(1), 
        }));
        setMatches(formattedMatches);
      } catch (error) {
        setMatches([]);
      }
    } else {
      setMatches([]);
    }
  }, [blocks, testText, regexFlags]);


  useEffect(() => {
    let blockIdToProcess: string | null = null;
    let isHoverSource = false;

    if (hoveredBlockId) {
        blockIdToProcess = hoveredBlockId;
        isHoverSource = true;
    } else if (selectedBlockId) {
        blockIdToProcess = selectedBlockId;
    }

    if (blockIdToProcess) {
        const block = findBlockRecursive(blocks, blockIdToProcess);
        if (block && block.type === BlockType.GROUP) {
            const foundGroupInfo = regexOutput.groupInfos.find(gi => gi.blockId === block.id);
            if (foundGroupInfo) {
                setHighlightedGroupInTestArea({ groupIndex: foundGroupInfo.groupIndex });
                return;
            }
        }
    }
    
    if (!isHoverSource || !blockIdToProcess) { 
        setHighlightedGroupInTestArea(null);
    }
  }, [selectedBlockId, hoveredBlockId, blocks, regexOutput.groupInfos]);


  const findBlockRecursive = (searchBlocks: Block[], id: string): Block | null => {
    for (const block of searchBlocks) {
      if (block.id === id) return block;
      if (block.children) {
        const found = findBlockRecursive(block.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const updateBlockRecursive = (currentBlocks: Block[], targetId: string, updatedBlockData: Partial<Block>): Block[] => {
    return currentBlocks.map(block => {
      if (block.id === targetId) return { ...block, ...updatedBlockData };
      if (block.children) {
        return { ...block, children: updateBlockRecursive(block.children, targetId, updatedBlockData) };
      }
      return block;
    });
  };


  const deleteBlockRecursive = (currentBlocks: Block[], targetId: string): Block[] => {
    return currentBlocks.filter(block => {
      if (block.id === targetId) return false;
      if (block.children) {
        block.children = deleteBlockRecursive(block.children, targetId);
      }
      return true;
    });
  };

  const addChildRecursive = (currentBlocks: Block[], pId: string, newBlock: Block): Block[] => {
    return currentBlocks.map(block => {
      if (block.id === pId) {
        const parentCanBeExpanded = [BlockType.GROUP, BlockType.LOOKAROUND, BlockType.ALTERNATION, BlockType.CONDITIONAL].includes(block.type);
        return { ...block, children: [...(block.children || []), newBlock], isExpanded: parentCanBeExpanded ? true : block.isExpanded };
      }
      if (block.children) {
        return { ...block, children: addChildRecursive(block.children, pId, newBlock) };
      }
      return block;
    });
  };

  const handleAddBlock = useCallback((type: BlockType, customSettings?: any, parentId?: string | null) => {
    const config = BLOCK_CONFIGS[type];
    if (!config) {
      toast({ title: "Ошибка", description: `Неизвестный тип блока: ${type}`, variant: "destructive" });
      return;
    }

    const canBeExpanded = [BlockType.GROUP, BlockType.LOOKAROUND, BlockType.ALTERNATION, BlockType.CONDITIONAL].includes(type);

    const newBlock: Block = {
      id: generateId(),
      type,
      settings: customSettings || { ...config.defaultSettings },
      children: [],
      isExpanded: canBeExpanded ? true : undefined,
    };

    let targetParentId = parentId;
    if (!targetParentId && selectedBlockId) {
      const selBlock = findBlockRecursive(blocks, selectedBlockId);
      if (selBlock && [BlockType.GROUP, BlockType.LOOKAROUND, BlockType.ALTERNATION, BlockType.CONDITIONAL].includes(selBlock.type)) {
        targetParentId = selectedBlockId;
      }
    }

    if (targetParentId) {
      setBlocks(prev => addChildRecursive(prev, targetParentId, newBlock));
    } else {
      setBlocks(prev => [...prev, newBlock]);
    }
    setSelectedBlockId(newBlock.id);
    setParentIdForNewBlock(null);
    setIsPaletteVisible(false);
  }, [toast, blocks, selectedBlockId]);


  const handleAddBlocksFromWizard = useCallback((newBlocks: Block[], parentIdFromWizard?: string | null, exampleTestText?: string) => {
    if (newBlocks.length === 0) return;

    let targetParentId = parentIdFromWizard;

    if (!targetParentId && selectedBlockId) {
      const selBlock = findBlockRecursive(blocks, selectedBlockId);
      if (selBlock && [BlockType.GROUP, BlockType.LOOKAROUND, BlockType.ALTERNATION, BlockType.CONDITIONAL].includes(selBlock.type)) {
        targetParentId = selectedBlockId;
      }
    }

    if (targetParentId) {
      setBlocks(prev => {
        const addRec = (currentNodes: Block[], pId: string, blocksToAdd: Block[]): Block[] => {
          return currentNodes.map(node => {
            if (node.id === pId) {
              const parentCanBeExpanded = [BlockType.GROUP, BlockType.LOOKAROUND, BlockType.ALTERNATION, BlockType.CONDITIONAL].includes(node.type);
              return { ...node, children: [...(node.children || []), ...blocksToAdd], isExpanded: parentCanBeExpanded ? true : node.isExpanded };
            }
            if (node.children) {
              return { ...node, children: addRec(node.children, pId, blocksToAdd) };
            }
            return node;
          });
        };
        return addRec(prev, targetParentId, newBlocks);
      });
    } else {
      setBlocks(prev => [...prev, ...newBlocks]);
    }

    if (exampleTestText) {
      setTestText(exampleTestText);
    }

    setSelectedBlockId(newBlocks[newBlocks.length - 1].id);
    setIsWizardModalOpen(false);
    toast({ title: "Блоки добавлены", description: "Блоки из Помощника успешно добавлены." });
  }, [toast, blocks, selectedBlockId]);


  const handleUpdateBlock = useCallback((id: string, updatedBlockSettings: Partial<Block>) => {
    setBlocks(prev => updateBlockRecursive(prev, id, updatedBlockSettings));
  }, []);


  const handleDeleteBlock = useCallback((id: string) => {
    setBlocks(prev => deleteBlockRecursive(prev, id));
    if (selectedBlockId === id) {
      setSelectedBlockId(null);
    }
    toast({ title: "Блок удален", description: "Блок был успешно удален из дерева." });
  }, [selectedBlockId, toast]);

  const handleDuplicateBlock = useCallback((id: string) => {
    setBlocks(prevBlocks => {
      const result = duplicateAndInsertBlockRecursive(prevBlocks, id);
      if (result.success) {
        toast({ title: "Блок скопирован", description: "Копия блока добавлена в дерево." });
        return result.updatedBlocks;
      }
      toast({ title: "Ошибка копирования", description: "Не удалось найти блок для копирования.", variant: "destructive"});
      return prevBlocks;
    });
  }, [toast]);

  const handleUngroupBlock = useCallback((id: string) => {
    const blockToUngroup = findBlockRecursive(blocks, id);
    if (!blockToUngroup || !blockToUngroup.children || blockToUngroup.children.length === 0) {
      toast({ title: "Ошибка", description: "Блок не может быть разгруппирован или не имеет дочерних элементов.", variant: "destructive" });
      return;
    }

    setBlocks(prevBlocks => processUngroupRecursive(prevBlocks, id));

    if (selectedBlockId === id) {
      setSelectedBlockId(null);
    }
    toast({ title: "Блок разгруппирован", description: "Дочерние элементы блока были подняты на уровень выше." });
  }, [blocks, selectedBlockId, toast]);

  const handleWrapBlock = useCallback((blockIdToWrap: string) => {
    const config = BLOCK_CONFIGS[BlockType.GROUP];
    const newGroupBlock: Block = {
      id: generateId(),
      type: BlockType.GROUP,
      settings: { ...config.defaultSettings },
      children: [],
      isExpanded: true,
    };

    const wrapRecursively = (currentNodes: Block[]): {wrappedNodes: Block[], success: boolean} => {
      let success = false;
      const mappedNodes = currentNodes.map(node => {
        if (node.id === blockIdToWrap) {
          const wrappedNode = cloneBlockForState(node);
          newGroupBlock.children = [wrappedNode];
          success = true;
          return newGroupBlock;
        }
        if (node.children) {
          const childResult = wrapRecursively(node.children);
          if (childResult.success) {
            success = true;
            return { ...node, children: childResult.wrappedNodes };
          }
        }
        return node;
      });
      return {wrappedNodes: mappedNodes, success};
    };

    setBlocks(prevBlocks => {
        const result = wrapRecursively(prevBlocks);
        if(result.success){
            setSelectedBlockId(newGroupBlock.id);
            toast({ title: "Блок обернут", description: "Выбранный блок был обернут в новую группу." });
            return result.wrappedNodes;
        }
        toast({ title: "Ошибка", description: "Не удалось обернуть блок.", variant: "destructive" });
        return prevBlocks;
    });
  }, [toast]);


  const handleReorderBlock = useCallback((draggedId: string, dropOnBlockId: string, parentOfDropOnBlockIdOrDropTargetId: string | null) => {
    setBlocks(prevBlocks => {
      let draggedBlockInstance: Block | null = null;

      const removeDraggedRecursive = (nodes: Block[], idToRemove: string): { updatedNodes: Block[], foundBlock: Block | null } => {
        let found: Block | null = null;
        const filteredNodes = nodes.filter(b => {
          if (b.id === idToRemove) {
            found = b;
            return false;
          }
          return true;
        });

        if (found) return { updatedNodes: filteredNodes, foundBlock: found };

        for (let i = 0; i < nodes.length; i++) {
          if (nodes[i].children && nodes[i].children.length > 0) {
            const childResult = removeDraggedRecursive(nodes[i].children, idToRemove);
            if (childResult.foundBlock) {
              const newParentNodes = [...nodes];
              newParentNodes[i] = { ...newParentNodes[i], children: childResult.updatedNodes };
              return { updatedNodes: newParentNodes, foundBlock: childResult.foundBlock };
            }
          }
        }
        return { updatedNodes: nodes, foundBlock: null };
      };

      const { updatedNodes: blocksWithoutDraggedOriginal, foundBlock } = removeDraggedRecursive(prevBlocks, draggedId);

      if (!foundBlock) {
        return prevBlocks;
      }
      let blocksWithoutDragged = cloneBlockForState({id: 'root', type: BlockType.LITERAL, settings: {text:''}, children: blocksWithoutDraggedOriginal, isExpanded: true}).children || [];


      draggedBlockInstance = cloneBlockForState(foundBlock);

      const dropTargetNodeInfo = findBlockAndParentRecursive(blocksWithoutDragged, dropOnBlockId);
      if (!dropTargetNodeInfo.block) {
        return prevBlocks;
      }
      const dropTargetNode = dropTargetNodeInfo.block;


      const canDropTargetBeParent = [BlockType.GROUP, BlockType.LOOKAROUND, BlockType.ALTERNATION, BlockType.CONDITIONAL].includes(dropTargetNode.type);
      let finalBlocks: Block[];

      const isDescendantOrSelf = (checkNodes: Block[], parentId: string, childIdToFind: string): boolean => {
        for (const node of checkNodes) {
          if (node.id === parentId) {
            const findChild = (nodesToSearch: Block[], id: string): boolean => {
              for (const n of nodesToSearch) {
                if (n.id === id) return true;
                if (n.children && findChild(n.children, id)) return true;
              }
              return false;
            };
            return findChild(node.children || [], childIdToFind);
          }
          if (node.children && isDescendantOrSelf(node.children, parentId, childIdToFind)) {
            return true;
          }
        }
        return false;
      };

      if (draggedId === dropTargetNode.id || isDescendantOrSelf(prevBlocks, draggedId, dropTargetNode.id)) {
          return prevBlocks;
      }

      const dragTargetRole = document.body.getAttribute('data-drag-target-role');

      if (canDropTargetBeParent && dragTargetRole === 'parent') {
        const addAsChildRecursiveFn = (nodes: Block[], targetParentId: string, childToAdd: Block): Block[] => {
          return nodes.map(n => {
            if (n.id === targetParentId) {
              const existingChildren = n.children || [];
              return { ...n, children: [...existingChildren, childToAdd], isExpanded: true };
            }
            if (n.children) {
              return { ...n, children: addAsChildRecursiveFn(n.children, targetParentId, childToAdd) };
            }
            return n;
          });
        };
        finalBlocks = addAsChildRecursiveFn(blocksWithoutDragged, dropOnBlockId, draggedBlockInstance);
      } else {
        const addAsSiblingRecursiveFn = (
            nodes: Block[],
            parentToSearchInId: string | null,
            afterSiblingId: string,
            blockToAdd: Block
        ): Block[] => {
            if (parentToSearchInId === null) {
                const targetIdx = nodes.findIndex(n => n.id === afterSiblingId);
                const newRootNodes = [...nodes];
                if (targetIdx !== -1) newRootNodes.splice(targetIdx + 1, 0, blockToAdd);
                else newRootNodes.push(blockToAdd);
                return newRootNodes;
            }

            return nodes.map(n => {
                if (n.id === parentToSearchInId) {
                    const targetIdx = (n.children || []).findIndex(child => child.id === afterSiblingId);
                    const newChildren = [...(n.children || [])];
                    if (targetIdx !== -1) newChildren.splice(targetIdx + 1, 0, blockToAdd);
                    else newChildren.push(blockToAdd);
                    return { ...n, children: newChildren, isExpanded: true };
                }
                if (n.children) {
                    return { ...n, children: addAsSiblingRecursiveFn(n.children, parentToSearchInId, afterSiblingId, blockToAdd) };
                }
                return n;
            });
        };
        finalBlocks = addAsSiblingRecursiveFn(blocksWithoutDragged, parentOfDropOnBlockIdOrDropTargetId, dropOnBlockId, draggedBlockInstance);
      }
      
      setTimeout(() => {
        toast({ title: "Блок перемещен", description: "Порядок блоков обновлен." });
      }, 0);
      return finalBlocks;
    });
  }, [toast]);


  const handleOpenPaletteForChild = useCallback((pId: string) => {
    setParentIdForNewBlock(pId);
    setIsPaletteVisible(true);
  }, []);

  const selectedBlock = selectedBlockId ? findBlockRecursive(blocks, selectedBlockId) : null;

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href)
      .then(() => toast({ title: "Ссылка скопирована!", description: "Ссылка для обмена скопирована в буфер обмена." }))
      .catch(() => toast({ title: "Ошибка", description: "Не удалось скопировать ссылку.", variant: "destructive" }));
  };

  const handleExport = () => {
     try {
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify({ blocks, regexFlags, testText }, null, 2)
      )}`;
      const link = document.createElement("a");
      link.href = jsonString;
      link.download = "regexvision_config.json";
      link.click();
      toast({ title: "Экспортировано!", description: "Конфигурация загружена." });
    } catch (error) {
      toast({ title: "Ошибка", description: "Не удалось экспортировать конфигурацию.", variant: "destructive" });
    }
  };
  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const imported = JSON.parse(e.target?.result as string);
            if (imported.blocks && imported.regexFlags !== undefined && imported.testText !== undefined) {
              const processImportedBlocks = (bs: Block[]): Block[] => {
                return bs.map(b => {
                  const canBeExpanded = [BlockType.GROUP, BlockType.LOOKAROUND, BlockType.ALTERNATION, BlockType.CONDITIONAL].includes(b.type);
                  return {
                    ...b,
                    id: b.id || generateId(),
                    isExpanded: b.isExpanded ?? (canBeExpanded ? true : undefined),
                    children: b.children ? processImportedBlocks(b.children) : []
                  };
                });
              };
              setBlocks(processImportedBlocks(imported.blocks));
              setRegexFlags(imported.regexFlags);
              setTestText(imported.testText);
              setSelectedBlockId(null);
              toast({ title: "Импортировано!", description: "Конфигурация загружена." });
            } else {
              throw new Error("Неверный формат файла");
            }
          } catch (err) {
            toast({ title: "Ошибка импорта", description: "Не удалось разобрать или неверный файл.", variant: "destructive" });
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const toggleAllBlocksExpansion = (expand: boolean) => {
    const toggleRecursively = (currentBlocks: Block[]): Block[] => {
      return currentBlocks.map(b => {
        const canBeExpanded = [BlockType.GROUP, BlockType.LOOKAROUND, BlockType.ALTERNATION, BlockType.CONDITIONAL].includes(b.type);
        return {
          ...b,
          isExpanded: canBeExpanded ? expand : b.isExpanded,
          children: b.children ? toggleRecursively(b.children) : [],
        };
      });
    };
    setBlocks(prev => toggleRecursively(prev));
  };

  const handleExpandAll = useCallback(() => toggleAllBlocksExpansion(true), []);
  const handleCollapseAll = useCallback(() => toggleAllBlocksExpansion(false), []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isTyping = activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.hasAttribute('contenteditable'));

      if (isTyping) return;

      if (selectedBlockId && (event.key === 'Delete' || event.key === 'Backspace')) {
        event.preventDefault();
        handleDeleteBlock(selectedBlockId);
      }

      if (event.ctrlKey && event.shiftKey) {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          handleExpandAll();
        } else if (event.key === 'ArrowUp') {
          event.preventDefault();
          handleCollapseAll();
        }
      }

      if (selectedBlockId) {
        const { block: currentBlock, parent, indexInParent } = findBlockAndParentRecursive(blocks, selectedBlockId);
        if (!currentBlock) return;

        const canBeExpanded = [BlockType.GROUP, BlockType.LOOKAROUND, BlockType.ALTERNATION, BlockType.CONDITIONAL].includes(currentBlock.type);

        if (event.key === 'ArrowUp') {
          event.preventDefault();
          const siblings = parent ? parent.children : blocks;
          if (indexInParent > 0 && siblings) {
            setSelectedBlockId(siblings[indexInParent - 1].id);
          }
        } else if (event.key === 'ArrowDown') {
          event.preventDefault();
          const siblings = parent ? parent.children : blocks;
          if (siblings && indexInParent < siblings.length - 1) {
            setSelectedBlockId(siblings[indexInParent + 1].id);
          }
        } else if (event.key === 'ArrowRight') {
          event.preventDefault();
          if (canBeExpanded && !(currentBlock.isExpanded ?? (currentBlock.children && currentBlock.children.length > 0))) {
            handleUpdateBlock(selectedBlockId, { ...currentBlock, isExpanded: true });
          } else if (currentBlock.children && currentBlock.children.length > 0) {
            setSelectedBlockId(currentBlock.children[0].id);
          }
        } else if (event.key === 'ArrowLeft') {
          event.preventDefault();
          if (parent && (currentBlock.isExpanded ?? (currentBlock.children && currentBlock.children.length > 0))) {
            if (canBeExpanded && (currentBlock.isExpanded ?? false)) {
               handleUpdateBlock(selectedBlockId, { ...currentBlock, isExpanded: false });
            } else {
                 setSelectedBlockId(parent.id);
            }
          } else if (canBeExpanded && (currentBlock.isExpanded ?? false)) {
            handleUpdateBlock(selectedBlockId, { ...currentBlock, isExpanded: false });
          } else if (parent) {
            setSelectedBlockId(parent.id);
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedBlockId, blocks, handleDeleteBlock, handleExpandAll, handleCollapseAll, handleUpdateBlock]);

  const handleApplySavedPattern = async (pattern: SavedPattern) => {
    setRegexFlags(pattern.flags);
    setTestText(pattern.testString || '');
    setSelectedBlockId(null); 
    setHoveredBlockId(null); 

    try {
      const aiResult: NaturalLanguageRegexOutput = await generateRegexFromNaturalLanguage({ query: pattern.regexString });
      if (aiResult.parsedBlocks && aiResult.parsedBlocks.length > 0) {
        const parsedBlocksFromAI = processAiBlocks(aiResult.parsedBlocks);
        setBlocks(parsedBlocksFromAI);
        toast({ title: "Паттерн применен и разобран!", description: `"${pattern.name}" загружен и преобразован в блоки.` });
      } else {
        const fallbackBlock = createLiteral(pattern.regexString, false); 
        setBlocks([fallbackBlock]);
        toast({ title: "Паттерн применен (как литерал)", description: `"${pattern.name}" загружен. AI не смог разобрать его на блоки.` });
      }
      if (aiResult.exampleTestText) { // Apply example text from AI if available
          setTestText(aiResult.exampleTestText);
      }
    } catch (error) {
      console.error("Error parsing pattern with AI:", error);
      const fallbackBlock = createLiteral(pattern.regexString, false);
      setBlocks([fallbackBlock]);
      toast({ title: "Паттерн применен (ошибка AI)", description: `"${pattern.name}" загружен. Произошла ошибка при попытке разбора AI.`, variant: "destructive" });
    }
  };

  const handleBlockHover = (blockId: string | null) => {
    setHoveredBlockId(blockId);
  };

  const handleHoverBlockInOutput = (blockId: string | null) => {
    setHoveredBlockId(blockId);
  };

  const handleSelectBlockInOutput = (blockId: string) => {
    setSelectedBlockId(blockId);
  };


  const headerHeight = "60px";
  const outputPanelMinHeight = "250px";
  const settingsHeaderHeight = "50px";

  return (
    <div className="flex flex-col h-screen bg-background text-foreground" style={{ "--header-height": headerHeight, "--output-panel-min-height": outputPanelMinHeight, "--settings-header-height": settingsHeaderHeight } as React.CSSProperties}>
      <AppHeader onShare={handleShare} onExport={handleExport} onImport={handleImport} />

      <ResizablePanelGroup direction="vertical" className="flex-1 overflow-hidden">
        <ResizablePanel defaultSize={65} minSize={30}>
          <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel defaultSize={selectedBlockId ? 60 : 100} minSize={30} className="flex flex-col overflow-hidden">
              <Card className="m-2 flex-1 flex flex-col shadow-md border-primary/20 overflow-hidden">
                <CardHeader className="py-2 px-3 border-b">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2"><Edit3 size={18} className="text-primary"/> Дерево выражения</CardTitle>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="iconSm" onClick={handleExpandAll} title="Развернуть всё (Ctrl+Shift+Вниз)">
                        <UnfoldVertical size={14} />
                      </Button>
                      <Button variant="outline" size="iconSm" onClick={handleCollapseAll} title="Свернуть всё (Ctrl+Shift+Вверх)">
                        <FoldVertical size={14} />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setParentIdForNewBlock(null); setIsWizardModalOpen(true); }}>
                        <Sparkles size={16} className="mr-1 text-amber-500" /> AI Помощник
                      </Button>
                      <Button size="sm" onClick={() => { setParentIdForNewBlock(null); setIsPaletteVisible(true); }}>
                        <Plus size={16} className="mr-1" /> Добавить блок
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-3 flex-1 min-h-0">
                  <ScrollArea className="h-full pr-2">
                    {blocks.length === 0 ? (
                      <div className="text-center text-muted-foreground py-10 flex flex-col items-center justify-center h-full">
                        <Layers size={48} className="mb-3 opacity-50" />
                        <p className="font-medium">Начните строить свой regex!</p>
                        <p className="text-sm">Нажмите "Добавить блок" или используйте "AI Помощник".</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {blocks.map(block => (
                          <BlockNode
                            key={block.id}
                            block={block}
                            onUpdate={handleUpdateBlock}
                            onDelete={handleDeleteBlock}
                            onAddChild={handleOpenPaletteForChild}
                            onDuplicate={handleDuplicateBlock}
                            onUngroup={handleUngroupBlock}
                            onWrapBlock={handleWrapBlock}
                            onReorder={handleReorderBlock}
                            selectedId={selectedBlockId}
                            onSelect={setSelectedBlockId}
                            parentId={null}
                            level={0}
                            onBlockHover={handleBlockHover} 
                          />
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </ResizablePanel>
            {selectedBlockId && selectedBlock && (
              <>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={40} minSize={25} maxSize={50} className="overflow-hidden">
                   <div className="h-full m-2 ml-0 shadow-md border-primary/20 rounded-lg overflow-hidden bg-card">
                     <SettingsPanel
                        block={selectedBlock}
                        onUpdate={(id, data) => handleUpdateBlock(id, data as Partial<Block>)}
                        onClose={() => setSelectedBlockId(null)}
                      />
                   </div>
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={35} minSize={20} className="bg-card p-2 shadow-top">
            <div className="h-full flex flex-col">
              <div className="mb-3">
                <RegexOutputDisplay 
                    blocks={blocks} 
                    generatedRegex={regexOutput.regexString} 
                    regexFlags={regexFlags} 
                    onFlagsChange={setRegexFlags}
                    selectedBlockId={selectedBlockId} 
                    hoveredBlockId={hoveredBlockId}
                    onHoverBlockInOutput={handleHoverBlockInOutput}
                    onSelectBlockInOutput={handleSelectBlockInOutput}
                />
              </div>
              <Tabs defaultValue="testing" className="flex-1 flex flex-col min-h-0">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="testing"><PlayCircle size={16} className="mr-1.5"/>Тестирование</TabsTrigger>
                  <TabsTrigger value="codegen"><Code2 size={16} className="mr-1.5"/>Генерация кода</TabsTrigger>
                  <TabsTrigger value="debug"><Bug size={16} className="mr-1.5"/>Отладка</TabsTrigger>
                  <TabsTrigger value="performance"><Gauge size={16} className="mr-1.5"/>Производительность</TabsTrigger>
                  <TabsTrigger value="library"><Library size={16} className="mr-1.5"/>Библиотека</TabsTrigger>
                </TabsList>
                <TabsContent value="testing" className="mt-2 flex-1 overflow-y-auto p-0.5">
                  <TestArea
                    testText={testText}
                    onTestTextChange={setTestText}
                    matches={matches}
                    generatedRegex={regexOutput.regexString}
                  />
                </TabsContent>
                <TabsContent value="codegen" className="mt-2 flex-1 overflow-y-auto p-0.5">
                  <CodeGenerationPanel generatedRegex={regexOutput.regexString} regexFlags={regexFlags} testText={testText} />
                </TabsContent>
                <TabsContent value="debug" className="mt-2 flex-1 overflow-y-auto p-0.5">
                  <DebugView regexString={regexOutput.regexString} testString={testText} />
                </TabsContent>
                <TabsContent value="performance" className="mt-2 flex-1 overflow-y-auto p-0.5">
                  <PerformanceAnalyzerView regexString={regexOutput.regexString} />
                </TabsContent>
                <TabsContent value="library" className="mt-2 flex-1 overflow-y-auto p-0.5">
                  <PatternLibraryView
                    currentRegexString={regexOutput.regexString}
                    currentFlags={regexFlags}
                    currentTestString={testText}
                    onApplyPattern={handleApplySavedPattern}
                  />
                </TabsContent>
              </Tabs>
            </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      <BlockPalette
        onAddBlock={handleAddBlock}
        isVisible={isPaletteVisible}
        onToggle={() => setIsPaletteVisible(!isPaletteVisible)}
        parentIdForNewBlock={parentIdForNewBlock}
      />
      {isWizardModalOpen && (
        <RegexWizardModal
          isOpen={isWizardModalOpen}
          onClose={() => {
            setIsWizardModalOpen(false);
            setParentIdForNewBlock(null);
          }}
          onComplete={(wizardBlocks, parentId, exampleText) => { // Updated to accept exampleText
            handleAddBlocksFromWizard(wizardBlocks, parentId, exampleText); // Pass exampleText
            setIsWizardModalOpen(false);
            setParentIdForNewBlock(null);
          }}
          initialParentId={parentIdForNewBlock}
        />
      )}
    </div>
  );
};

export default RegexVisionWorkspace;

    