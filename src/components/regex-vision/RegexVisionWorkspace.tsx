
"use client";
import React, { useState, useEffect, useCallback, lazy, Suspense, useMemo } from 'react';
import type { Block, RegexMatch, GroupInfo, CharacterClassSettings, RegexStringPart, SavedPattern, DropIndicator } from './types';
import { BlockType } from './types';
import { BLOCK_CONFIGS } from './constants';
import { generateId, cloneBlockForState, generateRegexStringAndGroupInfo } from './utils';
import { useToast } from '@/hooks/use-toast';
import { parseRegexWithLibrary } from './regex-parser';

import BlockNode from './BlockNode';
import SettingsPanel from './SettingsPanel';
import BlockPalette from './BlockPalette';
import RegexOutputDisplay from './RegexOutputDisplay';
import TestArea from './TestArea';
import { Button } from '@/components/ui/button';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Layers, Edit3, Code2, Plus, FoldVertical, UnfoldVertical, Menu, Puzzle, Share2, DownloadCloud, UploadCloud, Loader2 } from 'lucide-react';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import AnalysisPanel from './AnalysisPanel';
import type { FixRegexOutput } from '@/ai/flows/fix-regex-flow';

// Lazy load panels to improve initial load time
const CodeGenerationPanel = lazy(() => import('./CodeGenerationPanel'));
const PerformanceAnalyzerView = lazy(() => import('./PerformanceAnalyzerView'));
const PatternLibraryView = lazy(() => import('./PatternLibraryView'));
const DebugView = lazy(() => import('./DebugView'));

// Moved helper functions outside the component for stability and to prevent re-declaration
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

const findParentRecursive = (nodes: Block[], childId: string): Block | null => {
  for (const node of nodes) {
      if (node.children?.some(c => c.id === childId)) {
          return node;
      }
      if (node.children) {
          const result = findParentRecursive(node.children, childId);
          if (result) return result;
      }
  }
  return null;
};


const RegexVisionWorkspace: React.FC = () => {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);
  const [parentIdForNewBlock, setParentIdForNewBlock] = useState<string | null>(null);
  const [contextualBlockId, setContextualBlockId] = useState<string | null>(null);
  const [isPaletteVisible, setIsPaletteVisible] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isCodeGenOpen, setIsCodeGenOpen] = useState(false);

  const [testText, setTestText] = useState<string>('');
  const [regexFlags, setRegexFlags] = useState<string>('gmu');
  const [matches, setMatches] = useState<RegexMatch[]>([]);
  const [regexError, setRegexError] = useState<string | null>(null);
  const [regexOutputState, setRegexOutputState] = useState<{
    regexString: string;
    groupInfos: GroupInfo[];
    stringParts: RegexStringPart[];
  }>({
    regexString: '',
    groupInfos: [],
    stringParts: [],
  });
  const [naturalLanguageQuery, setNaturalLanguageQuery] = useState('');

  // Drag and Drop State
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(null);


  const { toast } = useToast();

  useEffect(() => {
    // This effect is to prevent a flash of unstyled content on load.
    const timer = setTimeout(() => setIsReady(true), 50); // Small delay to ensure styles are applied
    return () => clearTimeout(timer);
  }, []);

  // Effect to update regex string and matches whenever the block structure changes
  useEffect(() => {
    const { regexString: newRegex, groupInfos, stringParts } = generateRegexStringAndGroupInfo(blocks);
    setRegexOutputState({ regexString: newRegex, groupInfos, stringParts });

    if (newRegex && testText) {
      try {
        // 'd' flag is for match indices, which we need. Ensure it's always there.
        const currentFlags = regexFlags.includes('d') ? regexFlags : regexFlags + 'd';

        const regexObj = new RegExp(newRegex, currentFlags);
        const foundRawMatches = [...testText.matchAll(regexObj)];
        
        const formattedMatches: RegexMatch[] = foundRawMatches.map(rawMatch => ({
          match: rawMatch[0],
          index: rawMatch.index!,
          groups: Array.from(rawMatch).slice(1),
          groupIndices: rawMatch.indices ? rawMatch.indices.slice(1) as [number, number][] : [],
        }));
        setMatches(formattedMatches);
        setRegexError(null);
      } catch (error) {
        setMatches([]);
        if (error instanceof Error) {
            setRegexError(error.message);
        }
      }
    } else {
      setMatches([]);
       setRegexError(null);
    }
  }, [blocks, testText, regexFlags]);

  const updateBlockRecursive = (currentBlocks: Block[], targetId: string, updatedBlockData: Partial<Block>): Block[] => {
    return currentBlocks.map(block => {
      if (block.id === targetId) {
        // If the update involves children, ensure it's an array
        const newBlock = { ...block, ...updatedBlockData };
        if ('children' in updatedBlockData && !Array.isArray(newBlock.children)) {
            newBlock.children = [];
        }
        return newBlock;
      }
      if (block.children) {
        return { ...block, children: updateBlockRecursive(block.children, targetId, updatedBlockData) };
      }
      return block;
    });
  };

 const deleteBlockRecursive = (currentBlocks: Block[], targetId: string, deleteAttachedQuantifier: boolean): { updatedBlocks: Block[], blockWasSelected: boolean } => {
    let blockWasSelected = false;
    let idsToDelete = new Set<string>();
    idsToDelete.add(targetId);

    if (deleteAttachedQuantifier) {
        const findInArray = (arr: Block[], id: string): {parentArr: Block[], index: number} | null => {
            for(let i=0; i<arr.length; i++){
                if(arr[i].id === id) return {parentArr: arr, index: i};
            }
            return null;
        }

        const findRecursively = (nodes: Block[], id: string) : {parentArr: Block[], index: number} | null => {
            const directFind = findInArray(nodes, id);
            if(directFind) return directFind;
            for(const node of nodes){
                if(node.children){
                    const childFind = findRecursively(node.children, id);
                    if(childFind) return childFind;
                }
            }
            return null;
        }

        const foundInfo = findRecursively(currentBlocks, targetId);
        if (foundInfo) {
            const { parentArr, index } = foundInfo;
            if (index + 1 < parentArr.length && parentArr[index + 1].type === BlockType.QUANTIFIER && parentArr[index].type !== BlockType.QUANTIFIER) {
                idsToDelete.add(parentArr[index + 1].id);
            }
        }
    }

    if (idsToDelete.has(selectedBlockId || "")) blockWasSelected = true;

    const filterAndDelete = (nodes: Block[]): Block[] => {
        const remainingNodes = nodes.filter(block => !idsToDelete.has(block.id));
        return remainingNodes.map(block => {
            if (block.children) {
                return { ...block, children: filterAndDelete(block.children) };
            }
            return block;
        });
    };

    const updatedBlocks = filterAndDelete(currentBlocks);
    return { updatedBlocks, blockWasSelected };
};


  const addChildRecursive = (currentBlocks: Block[], pId: string, newBlock: Block): Block[] => {
    return currentBlocks.map(block => {
      if (block.id === pId) {
        const parentCanBeExpanded = [BlockType.GROUP, BlockType.LOOKAROUND, BlockType.ALTERNATION, BlockType.CONDITIONAL, BlockType.CHARACTER_CLASS].includes(block.type);
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

    // Special handling for quantifiers to attach them to the preceding block.
    if (type === BlockType.QUANTIFIER) {
      const targetBlockId = contextualBlockId || selectedBlockId;
      if (!targetBlockId) {
        toast({ title: "Ошибка", description: "Выберите блок, к которому нужно применить квантификатор.", variant: "destructive" });
        return;
      }
      const insertQuantifier = (nodes: Block[], blockToQuantifyId: string): Block[] | null => {
        for (let i = 0; i < nodes.length; i++) {
          const currentNode = nodes[i];
          if (currentNode.id === blockToQuantifyId) {
            // Can't quantify a quantifier or a block that already has one.
            if (currentNode.type === BlockType.QUANTIFIER) return null;
            if (i + 1 < nodes.length && nodes[i+1].type === BlockType.QUANTIFIER) return null;

            const newNodes = [...nodes];
            newNodes.splice(i + 1, 0, newBlock);
            return newNodes;
          }
          if (currentNode.children) {
            const newChildren = insertQuantifier(currentNode.children, blockToQuantifyId);
            if (newChildren) {
              const newNodes = [...nodes];
              newNodes[i] = { ...currentNode, children: newChildren };
              return newNodes;
            }
          }
        }
        return null;
      };
      setBlocks(prev => {
        const newTree = insertQuantifier(prev, targetBlockId);
        if (newTree) {
          setSelectedBlockId(newBlock.id);
          return newTree;
        }
        toast({ title: 'Невозможно добавить квантификатор', description: 'Этот блок уже имеет квантификатор или является квантификатором.', variant: 'destructive' });
        return prev;
      });
      setParentIdForNewBlock(null);
      setContextualBlockId(null);
      setIsPaletteVisible(false);
      return;
    }

    // Default block addition logic
    let targetParentId = parentId;
    if (!targetParentId && selectedBlockId) {
      const selBlock = findBlockRecursive(blocks, selectedBlockId);
      if (selBlock) {
         const isContainer =
            [BlockType.GROUP, BlockType.LOOKAROUND, BlockType.ALTERNATION, BlockType.CONDITIONAL].includes(selBlock.type) ||
            (selBlock.type === BlockType.CHARACTER_CLASS && (!(selBlock.settings as CharacterClassSettings).pattern || (selBlock.children && selBlock.children.length > 0)));

        // If the selected block is a container, new blocks are added inside it by default.
        if (isContainer) {
            targetParentId = selectedBlockId;
        }
      }
    }

    if (targetParentId) {
      setBlocks(prev => addChildRecursive(prev, targetParentId, newBlock));
    } else {
      // Find the parent of the selected block to add as a sibling
      const findParentOfSelected = (nodes: Block[], sId: string, pId: string | null): string | null => {
        for(const node of nodes) {
            if (node.id === sId) return pId;
            if (node.children) {
                const found = findParentOfSelected(node.children, sId, node.id);
                if (found !== null) return found;
            }
        }
        return null;
      }
      const selectedParentId = selectedBlockId ? findParentOfSelected(blocks, selectedBlockId, null) : null;

      if(selectedParentId && selectedBlockId) {
        setBlocks(prev => {
            const insertSibling = (bs: Block[], sId: string, newB: Block): Block[] => {
                return bs.flatMap(b => {
                    if (b.id === sId) return [b, newB];
                    if (b.children) return [{ ...b, children: insertSibling(b.children, sId, newB) }];
                    return [b];
                });
            }
            return insertSibling(prev, selectedBlockId, newBlock);
        });
      } else {
        // No parent, add to root
        setBlocks(prev => [...prev, newBlock]);
      }
    }
    setSelectedBlockId(newBlock.id);
    setParentIdForNewBlock(null);
    setContextualBlockId(null);
    setIsPaletteVisible(false);
  }, [toast, blocks, selectedBlockId, contextualBlockId]);

  const handleUpdateBlock = useCallback((id: string, updatedBlockData: Partial<Block>) => {
    setBlocks(prev => updateBlockRecursive(prev, id, updatedBlockData));
  }, []);


  const handleDeleteBlock = useCallback((id: string, deleteAttachedQuantifier: boolean = false) => {
    setBlocks(prev => {
        const result = deleteBlockRecursive(prev, id, deleteAttachedQuantifier);
        if (result.blockWasSelected) {
            setSelectedBlockId(null);
        }
        return result.updatedBlocks;
    });
    toast({ title: "Блок удален", description: "Блок был успешно удален." });
  }, [selectedBlockId, toast]);

  const duplicateAndInsertBlockRecursive = (currentBlocks: Block[], targetId: string): { updatedBlocks: Block[], success: boolean, newSelectedId?: string } => {
    for (let i = 0; i < currentBlocks.length; i++) {
      const block = currentBlocks[i];
      if (block.id === targetId) {
        const originalBlock = block;
        const newBlock = cloneBlockForState(originalBlock);
        const updatedBlocks = [...currentBlocks];
        updatedBlocks.splice(i + 1, 0, newBlock);

        // Also duplicate the quantifier if it exists
        if (originalBlock.type !== BlockType.QUANTIFIER && (i + 1) < currentBlocks.length && currentBlocks[i + 1].type === BlockType.QUANTIFIER) {
          const originalQuantifier = currentBlocks[i + 1];
          const newQuantifier = cloneBlockForState(originalQuantifier);
          updatedBlocks.splice(i + 2, 0, newQuantifier);
        }
        return { updatedBlocks, success: true, newSelectedId: newBlock.id };
      }
      if (block.children && block.children.length > 0) {
        const result = duplicateAndInsertBlockRecursive(block.children, targetId);
        if (result.success) {
          const updatedBlocks = [...currentBlocks];
          updatedBlocks[i] = { ...block, children: result.updatedBlocks };
          return { updatedBlocks, success: true, newSelectedId: result.newSelectedId };
        }
      }
    }
    return { updatedBlocks: currentBlocks, success: false };
  };

  const handleDuplicateBlock = useCallback((id: string) => {
    setBlocks(prevBlocks => {
      const result = duplicateAndInsertBlockRecursive(prevBlocks, id);
      if (result.success) {
        toast({ title: "Блок скопирован", description: "Копия блока добавлена в дерево." });
        if (result.newSelectedId) {
            setSelectedBlockId(result.newSelectedId);
        }
        return result.updatedBlocks;
      }
      toast({ title: "Ошибка копирования", description: "Не удалось найти блок для копирования.", variant: "destructive"});
      return prevBlocks;
    });
  }, [toast]);

  const processUngroupRecursive = (nodes: Block[], targetId: string): Block[] => {
    return nodes.flatMap(block => {
      if (block.id === targetId) {
        // Replace the group with its children
        return block.children ? block.children.map(child => cloneBlockForState(child)) : [];
      }
      if (block.children && block.children.length > 0) {
        return [{ ...block, children: processUngroupRecursive(block.children, targetId) }];
      }
      return [block];
    });
  };

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

    setBlocks(prevBlocks => {
      const blocksCopy = prevBlocks.map(b => cloneBlockForState(b));

      const replaceInTree = (nodes: Block[]): Block[] | null => {
          for (let i=0; i < nodes.length; i++) {
              if (nodes[i].id === blockIdToWrap) {
                  const originalBlock = nodes[i];
                  newGroupBlock.children.push(cloneBlockForState(originalBlock));
                  const updatedNodes = [...nodes];

                  // If the block has a quantifier, wrap it too.
                  if (originalBlock.type !== BlockType.QUANTIFIER && (i + 1) < nodes.length && nodes[i + 1].type === BlockType.QUANTIFIER) {
                      newGroupBlock.children.push(cloneBlockForState(nodes[i + 1]));
                      updatedNodes.splice(i, 2, newGroupBlock);
                  } else {
                      updatedNodes.splice(i, 1, newGroupBlock);
                  }
                  return updatedNodes;
              }
              if (nodes[i].children) {
                  const newChildren = replaceInTree(nodes[i].children!);
                  if (newChildren) {
                      const updatedNode = { ...nodes[i], children: newChildren };
                      const finalNodes = [...nodes];
                      finalNodes[i] = updatedNode;
                      return finalNodes;
                  }
              }
          }
          return null;
      }

      const updatedTree = replaceInTree(blocksCopy);

      if (updatedTree) {
        setSelectedBlockId(newGroupBlock.id);
        toast({ title: "Блок обернут", description: "Выбранный блок был обернут в новую группу." });
        return updatedTree;
      }

      toast({ title: "Ошибка", description: "Не удалось обернуть блок.", variant: "destructive" });
      return prevBlocks;
    });
  }, [toast]);

  // --- Scroll into View Logic ---
  const scrollBlockIntoView = useCallback((blockId: string) => {
    const element = document.getElementById(`block-node-${blockId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, []);

  const handleSelectBlock = useCallback((id: string | null) => {
    setSelectedBlockId(id);
    if (id) {
      scrollBlockIntoView(id);
    }
  }, [scrollBlockIntoView]);

  const handleBlockHover = useCallback((blockId: string | null) => {
    setHoveredBlockId(blockId);
    if (blockId) {
      scrollBlockIntoView(blockId);
    }
  }, [scrollBlockIntoView]);


  // --- Drag and Drop Handlers ---

  const handleDragStart = (e: React.DragEvent, blockId: string) => {
    e.dataTransfer.setData('text/plain', blockId);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => {
        setDraggedBlockId(blockId);
    }, 0);
  };

  const handleDragEnd = () => {
    setDraggedBlockId(null);
    setDropIndicator(null);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedBlockId || draggedBlockId === targetId) {
      setDropIndicator(null);
      return;
    }

    const targetElement = e.currentTarget as HTMLElement;
    const rect = targetElement.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;
    
    let position: DropIndicator['position'] = 'after';
    const targetBlock = findBlockRecursive(blocks, targetId);
    const isContainer = targetBlock && (targetBlock.children !== undefined);

    if (isContainer && y > height * 0.25 && y < height * 0.75) {
        position = 'inside';
    } else if (y < height / 2) {
        position = 'before';
    } else {
        position = 'after';
    }
    
    setDropIndicator({ targetId, position });
  };
  
  const handleDragLeave = () => {
    setDropIndicator(null);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain');
    if (sourceId && dropIndicator) {
      handleMoveBlock(sourceId, dropIndicator.targetId, dropIndicator.position);
    }
    handleDragEnd();
  };

  const handleMoveBlock = (sourceId: string, targetId: string, position: 'before' | 'after' | 'inside') => {
    if (sourceId === targetId) return;

    // Prevent dropping a block into itself or its descendants
    const isDescendant = (nodes: Block[], parentId: string, childId: string): boolean => {
        const node = findBlockRecursive(nodes, parentId);
        if (!node) return false;
        return !!findBlockRecursive(node.children || [], childId);
    };

    if (isDescendant(blocks, sourceId, targetId)) {
        toast({ title: "Неверное действие", description: "Нельзя переместить блок внутрь самого себя.", variant: "destructive" });
        return;
    }

    setBlocks(currentBlocks => {
      let foundBlock: Block | null = null;
      let foundQuantifier: Block | null = null;

      // 1. Find and remove the source block (and its quantifier) from the tree
      const removeRecursive = (nodes: Block[]): Block[] => {
        const result: Block[] = [];
        for (let i = 0; i < nodes.length; i++) {
          const node = nodes[i];
          if (node.id === sourceId) {
            foundBlock = node;
            if (i + 1 < nodes.length && nodes[i + 1].type === BlockType.QUANTIFIER) {
              foundQuantifier = nodes[i + 1];
              i++; // Skip the quantifier in the next iteration
            }
          } else {
            if (node.children) {
              result.push({ ...node, children: removeRecursive(node.children) });
            } else {
              result.push(node);
            }
          }
        }
        return result;
      };

      const blocksAfterRemoval = removeRecursive(currentBlocks);

      if (!foundBlock) return currentBlocks; // Should not happen

      // 2. Insert the found block at the target position
      const insertRecursive = (nodes: Block[]): Block[] => {
        if (position === 'inside') {
          const targetNode = nodes.find(n => n.id === targetId);
          if (targetNode) {
            if (!targetNode.children) targetNode.children = [];
            targetNode.children.push(foundBlock!);
            if (foundQuantifier) targetNode.children.push(foundQuantifier);
            return nodes;
          }
        }
        
        return nodes.flatMap(node => {
          if (node.id === targetId) {
            const itemsToInsert = [foundBlock!];
            if (foundQuantifier) itemsToInsert.push(foundQuantifier);

            if (position === 'before') return [...itemsToInsert, node];
            if (position === 'after') return [node, ...itemsToInsert];
          }
          if (node.children) {
            return { ...node, children: insertRecursive(node.children) };
          }
          return node;
        });
      };
      
      const newBlocks = insertRecursive(blocksAfterRemoval);
      setSelectedBlockId(sourceId);
      return newBlocks;
    });
  };

  // --- End of Drag and Drop Handlers ---


  const handleOpenPaletteFor = (pId: string | null, ctxId: string | null = null) => {
    setParentIdForNewBlock(pId);
    setContextualBlockId(ctxId);
    setIsPaletteVisible(true);
  };

  const selectedBlock = selectedBlockId ? findBlockRecursive(blocks, selectedBlockId) : null;

  const handleShare = () => {
    // A more robust solution would involve encoding the state into the URL.
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

  const toggleAllBlocksExpansion = useCallback((expand: boolean) => {
    const toggleRecursively = (currentBlocks: Block[]): Block[] => {
      return currentBlocks.map(b => {
        const hasChildren = b.children && b.children.length > 0;
        const isContainer =
          b.type === BlockType.GROUP ||
          b.type === BlockType.LOOKAROUND ||
          b.type === BlockType.ALTERNATION ||
          b.type === BlockType.CONDITIONAL ||
          (b.type === BlockType.CHARACTER_CLASS && hasChildren);

        return {
          ...b,
          isExpanded: isContainer ? expand : b.isExpanded,
          children: b.children ? toggleRecursively(b.children) : [],
        };
      });
    };
    setBlocks(prev => toggleRecursively(prev));
  }, []);

  const handleExpandAll = useCallback(() => toggleAllBlocksExpansion(true), [toggleAllBlocksExpansion]);
  const handleCollapseAll = useCallback(() => toggleAllBlocksExpansion(false), [toggleAllBlocksExpansion]);

  // Effect for keyboard shortcuts for better accessibility and power-user experience.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isTyping = activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.hasAttribute('contenteditable'));

      if (isTyping) return;

      // Delete selected block
      if (selectedBlockId && (event.key === 'Delete' || event.key === 'Backspace')) {
        event.preventDefault();
        const block = findBlockRecursive(blocks,selectedBlockId);
        const deleteAttached = block?.type !== BlockType.QUANTIFIER;
        handleDeleteBlock(selectedBlockId, deleteAttached);
      }

      // Expand/Collapse All
      if (event.ctrlKey && event.shiftKey) {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          handleExpandAll();
        } else if (event.key === 'ArrowUp') {
          event.preventDefault();
          handleCollapseAll();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedBlockId, blocks, handleDeleteBlock, handleExpandAll, handleCollapseAll, handleUpdateBlock]);

  const handleParseRegexString = useCallback((regexString: string) => {
    if (!regexString) {
      setBlocks([]);
      return;
    }

    let processedRegex = regexString;
    const inlineFlagMatch = regexString.match(/^\(\?([imsuy]+)\)/);
    let extractedFlags = '';

    if (inlineFlagMatch) {
      extractedFlags = inlineFlagMatch[1];
      setRegexFlags(currentFlags => {
        const flagSet = new Set(currentFlags.split(''));
        for (const flag of extractedFlags) {
          flagSet.add(flag);
        }
        return ['g', 'i', 'm', 's', 'u', 'y'].filter(f => flagSet.has(f as any)).join('');
      });
      processedRegex = regexString.substring(inlineFlagMatch[0].length);
    }

    setIsParsing(true);
    try {
      const parsedBlocks = parseRegexWithLibrary(processedRegex);
      setBlocks(parsedBlocks);
      setNaturalLanguageQuery('');

      if (extractedFlags) {
        toast({
          title: "Выражение разобрано",
          description: `Встроенный флаг '${extractedFlags}' был автоматически активирован.`,
        });
      } else {
        toast({ title: "Выражение разобрано", description: "Структура блоков построена успешно." });
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : "Неизвестная ошибка парсера.";
      toast({
        title: "Ошибка разбора",
        description: `Не удалось разобрать выражение: ${message}`,
        variant: "destructive",
      });
    } finally {
      setIsParsing(false);
    }
  }, [toast]);

  // Memoize the highlighted group index to prevent re-calculation on every render.
  const highlightedGroupIndex = React.useMemo(() => {
    if (selectedBlock && (selectedBlock.type === BlockType.GROUP || selectedBlock.type === BlockType.ALTERNATION)) {
        let blockToCheck = selectedBlock;
        const parent = findParentRecursive(blocks, selectedBlock.id);
        if (selectedBlock.type === BlockType.ALTERNATION && parent) {
           blockToCheck = parent;
        }
      const groupInfo = regexOutputState.groupInfos.find(gi => gi.blockId === blockToCheck.id);
      return groupInfo ? groupInfo.groupIndex : -1;
    }
    return -1;
  }, [selectedBlock, blocks, regexOutputState.groupInfos]);
  
  const getIdsToHighlight = (id: string | null): string[] => {
      if (!id) return [];
      const block = findBlockRecursive(blocks, id);
      if (!block) return [id];

      // If a group is selected, also highlight its alternation child
      if (block.type === BlockType.GROUP && block.children?.length === 1 && block.children[0].type === BlockType.ALTERNATION) {
          return [id, block.children[0].id];
      }
      
      return [id];
  }

  const idsToHighlight = useMemo(() => getIdsToHighlight(selectedBlockId), [selectedBlockId, blocks]);
  const idsToHover = useMemo(() => getIdsToHighlight(hoveredBlockId), [hoveredBlockId, blocks]);

  const handleFixApplied = (fixResult: FixRegexOutput) => {
      if (fixResult.parsedBlocks && fixResult.parsedBlocks.length > 0) {
          setBlocks(fixResult.parsedBlocks);
      } else if (fixResult.regex) {
          handleParseRegexString(fixResult.regex);
      }
      setNaturalLanguageQuery(fixResult.explanation); // Show AI explanation as new 'goal'
  };

  const renderBlockNodes = (nodes: Block[], parentId: string | null, depth: number, groupInfos: GroupInfo[]): React.ReactNode[] => {
    const nodeList: React.ReactNode[] = [];

    for (let i = 0; i < nodes.length; i++) {
        const block = nodes[i];
        let quantifierToRender: Block | null = null;

        if (block.type === BlockType.QUANTIFIER) {
            // Quantifiers are rendered as badges on the block they quantify, so we skip rendering them as standalone nodes.
            continue;
        }

        // Check if the next block is a quantifier for the current block.
        if (i + 1 < nodes.length && nodes[i + 1].type === BlockType.QUANTIFIER) {
            quantifierToRender = nodes[i + 1];
        }

        nodeList.push(
          <BlockNode
            key={block.id}
            block={block}
            quantifierToRender={quantifierToRender}
            onUpdate={handleUpdateBlock}
            onDelete={handleDeleteBlock}
            onAddChild={(pId) => handleOpenPaletteFor(pId, block.id)}
            onAddSibling={(pId, ctxId) => handleOpenPaletteFor(pId, ctxId)}
            onDuplicate={handleDuplicateBlock}
            onUngroup={handleUngroupBlock}
            onWrapBlock={handleWrapBlock}
            selectedId={selectedBlockId}
            onSelect={handleSelectBlock}
            parentId={parentId}
            depth={depth}
            hoveredId={hoveredBlockId}
            onBlockHover={handleBlockHover}
            renderChildNodes={(childNodes, pId, nextDepth, gInfos) => renderBlockNodes(childNodes, pId, nextDepth, gInfos)}
            groupInfos={groupInfos}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            dropIndicator={dropIndicator}
          />
        );
    }
    return nodeList;
  };

  const mainContent = () => {
    return (
        <div className="h-full flex flex-col p-2">
            <Card className="flex-1 flex flex-col shadow-md border-primary/20 overflow-hidden">
            <CardHeader className="py-2 px-3 border-b flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                    <Edit3 size={18} className="text-primary"/> Дерево выражения
                </CardTitle>
                <div className="flex items-center gap-1">
                    <Button size="sm" onClick={() => handleOpenPaletteFor(null)}>
                        <Plus size={16} className="mr-1" /> Добавить блок
                    </Button>
                    <Button variant="outline" size="icon" className="h-9 w-9" onClick={handleExpandAll} title="Развернуть всё">
                        <UnfoldVertical size={16} />
                    </Button>
                    <Button variant="outline" size="icon" className="h-9 w-9" onClick={handleCollapseAll} title="Свернуть всё">
                        <FoldVertical size={16} />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-1 flex-1 min-h-0">
                <ScrollArea className="h-full pr-2">
                {blocks.length === 0 ? (
                    <div className="text-center text-muted-foreground py-10 flex flex-col items-center justify-center h-full">
                    <Layers size={48} className="mb-3 opacity-50" />
                    <p className="font-medium">Начните строить!</p>
                    <p className="text-sm">Вставьте Regex в поле выше или добавьте блоки вручную.</p>
                    </div>
                ) : (
                    <div className="space-y-1 p-2">
                      {renderBlockNodes(blocks, null, 0, regexOutputState.groupInfos)}
                    </div>
                )}
                </ScrollArea>
            </CardContent>
            </Card>
        </div>
    );
  };


  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <header className="flex items-center gap-4 p-3 border-b bg-card shadow-sm z-10">
          <div className="flex-1">
              <RegexOutputDisplay
                generatedRegex={regexOutputState.regexString}
                regexFlags={regexFlags}
                onFlagsChange={setRegexFlags}
                onParseRegexString={handleParseRegexString}
                isParsing={isParsing}
                stringParts={regexOutputState.stringParts}
                highlightedIds={idsToHighlight}
                onSelectBlock={handleSelectBlock}
                hoveredIds={idsToHover}
                onHoverPart={handleBlockHover}
                isReady={isReady}
              />
          </div>
          <Button variant="outline" size="icon" onClick={() => setIsCodeGenOpen(true)} title="Сгенерировать код">
              <Code2 size={16} />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu size={16} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="flex items-center gap-2 font-semibold">
                  <Puzzle size={16} />
                  RegexVision
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleShare}>
                <Share2 className="mr-2 h-4 w-4" />
                <span>Поделиться</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExport}>
                <DownloadCloud className="mr-2 h-4 w-4" />
                <span>Экспорт</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleImport}>
                <UploadCloud className="mr-2 h-4 w-4" />
                <span>Импорт</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
      </header>

      <main className="flex-1 min-h-0">
          <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel defaultSize={50} minSize={30}>
                {mainContent()}
            </ResizablePanel>

            <ResizableHandle withHandle />

            <ResizablePanel defaultSize={25} minSize={25}>
                <div className="h-full p-2">
                    <TestArea
                        testText={testText}
                        onTestTextChange={setTestText}
                        matches={matches}
                        generatedRegex={regexOutputState.regexString}
                        highlightedGroupIndex={highlightedGroupIndex}
                        regexError={regexError}
                    />
                    <AnalysisPanel
                      originalQuery={naturalLanguageQuery}
                      generatedRegex={regexOutputState.regexString}
                      testText={testText}
                      errorContext={regexError || undefined}
                      isVisible={!!regexError || (matches.length === 0 && !!regexOutputState.regexString && !!testText)}
                      onFixApplied={handleFixApplied}
                    />
                </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            <ResizablePanel defaultSize={25} minSize={25}>
                 <div className="h-full p-2">
                    <SettingsPanel
                        block={selectedBlock}
                        onUpdate={handleUpdateBlock}
                        onClose={() => setSelectedBlockId(null)}
                    />
                </div>
            </ResizablePanel>
          </ResizablePanelGroup>
      </main>

      <Sheet open={isCodeGenOpen} onOpenChange={setIsCodeGenOpen}>
        <SheetContent className="w-[600px] sm:max-w-2xl">
            <SheetHeader>
                <SheetTitle className="flex items-center gap-2"><Code2 size={20}/> Генерация кода</SheetTitle>
                 <SheetDescription>
                    Скопируйте готовый фрагмент кода для использования в вашем проекте.
                 </SheetDescription>
            </SheetHeader>
            <div className="py-4 h-[calc(100%-6rem)]">
                <Suspense fallback={<div className="flex h-full items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Загрузка...</div>}>
                    <CodeGenerationPanel generatedRegex={regexOutputState.regexString} regexFlags={regexFlags} testText={testText} />
                </Suspense>
            </div>
        </SheetContent>
    </Sheet>

      <BlockPalette
        onAddBlock={handleAddBlock}
        isVisible={isPaletteVisible}
        onToggle={() => {
          setIsPaletteVisible(!isPaletteVisible);
          setParentIdForNewBlock(null);
          setContextualBlockId(null);
        }}
        parentIdForNewBlock={parentIdForNewBlock}
      />
    </div>
  );
};

export default RegexVisionWorkspace;
