
"use client";
import React, { useState, useEffect, useCallback } from 'react';
import type { Block, RegexMatch, GroupInfo, SavedPattern, CharacterClassSettings } from './types'; 
import { BlockType } from './types';
import { BLOCK_CONFIGS } from './constants';
import { generateId, generateRegexStringAndGroupInfo, createLiteral, processAiBlocks, cloneBlockForState, breakdownPatternIntoChildren, reconstructPatternFromChildren } from './utils'; 
import { useToast } from '@/hooks/use-toast';
import { generateRegexFromNaturalLanguage, type NaturalLanguageRegexOutput } from '@/ai/flows/natural-language-regex-flow';

import BlockNode from './BlockNode';
import SettingsPanel from './SettingsPanel';
import BlockPalette from './BlockPalette';
import RegexOutputDisplay from './RegexOutputDisplay';
import TestArea from './TestArea';
import CodeGenerationPanel from './CodeGenerationPanel';
import DebugView from './DebugView';
import PerformanceAnalyzerView from './PerformanceAnalyzerView';
import PatternLibraryView from './PatternLibraryView';
import { Button } from '@/components/ui/button';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Layers, Edit3, Code2, PlayCircle, Bug, Plus, FoldVertical, UnfoldVertical, Gauge, Library, Menu, Puzzle, Share2, DownloadCloud, UploadCloud } from 'lucide-react'; 
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

const RegexVisionWorkspace: React.FC = () => {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null); 
  const [parentIdForNewBlock, setParentIdForNewBlock] = useState<string | null>(null);
  const [contextualBlockId, setContextualBlockId] = useState<string | null>(null);
  const [isPaletteVisible, setIsPaletteVisible] = useState(false);
  const [isParsing, setIsParsing] = useState(false);

  const [testText, setTestText] = useState<string>('Быстрая коричневая лиса прыгает через ленивую собаку.');
  const [regexFlags, setRegexFlags] = useState<string>('g');
  const [matches, setMatches] = useState<RegexMatch[]>([]);
  const [regexOutput, setRegexOutput] = useState<{ regexString: string; groupInfos: GroupInfo[] }>({ regexString: '', groupInfos: [] });
  const [regexError, setRegexError] = useState<string | null>(null);
  
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

    let targetParentId = parentId;
    if (!targetParentId && selectedBlockId) {
      const selBlock = findBlockRecursive(blocks, selectedBlockId);
      if (selBlock && [BlockType.GROUP, BlockType.LOOKAROUND, BlockType.ALTERNATION, BlockType.CONDITIONAL, BlockType.CHARACTER_CLASS].includes(selBlock.type)) {
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
    setContextualBlockId(null);
    setIsPaletteVisible(false);
  }, [toast, blocks, selectedBlockId, contextualBlockId]);

  const handleUpdateBlock = useCallback((id: string, updatedBlockData: Partial<Block>) => {
      if (updatedBlockData.settings && 'pattern' in updatedBlockData.settings) {
          const blockToUpdate = findBlockRecursive(blocks, id);
          if (blockToUpdate && blockToUpdate.type === BlockType.CHARACTER_CLASS) {
              const newPattern = (updatedBlockData.settings as CharacterClassSettings).pattern;
              const newChildren = breakdownPatternIntoChildren(newPattern);
              
              const reparsedBlock: Partial<Block> = { 
                  settings: { ...(blockToUpdate.settings as CharacterClassSettings), pattern: '' },
                  children: newChildren,
                  isExpanded: newChildren.length > 0 ? true : undefined,
              };
              setBlocks(prev => updateBlockRecursive(prev, id, reparsedBlock));
              return;
          }
      }

      setBlocks(prev => updateBlockRecursive(prev, id, updatedBlockData));
  }, [blocks]);


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

  const handleReorderBlock = useCallback((draggedId: string, dropOnBlockId: string, newParentId: string | null) => {
    setBlocks(prevBlocks => {
      let draggedBlock: Block | null = null;
      let draggedQuantifier: Block | null = null;

      const removeDraggedRecursive = (nodes: Block[], idToRemove: string): Block[] => {
        const result: Block[] = [];
        for (let i = 0; i < nodes.length; i++) {
          const node = nodes[i];
          if (node.id === idToRemove) {
            draggedBlock = cloneBlockForState(node);
            if (i + 1 < nodes.length && nodes[i + 1].type === BlockType.QUANTIFIER) {
              draggedQuantifier = cloneBlockForState(nodes[i + 1]);
              i++; // Skip quantifier
            }
          } else {
            if (node.children) {
              node.children = removeDraggedRecursive(node.children);
            }
            result.push(node);
          }
        }
        return result;
      };

      const blocksWithoutDragged = removeDraggedRecursive(cloneBlockForState({ id: 'root', type: BlockType.LITERAL, settings:{text:''}, children: prevBlocks }).children!);
      
      if (!draggedBlock) return prevBlocks;

      const isDescendant = (nodes: Block[], idToFind: string): boolean => {
        for (const node of nodes) {
          if (node.id === idToFind) return true;
          if (node.children && isDescendant(node.children, idToFind)) return true;
        }
        return false;
      };

      if (draggedBlock.id === dropOnBlockId || (draggedBlock.children && isDescendant(draggedBlock.children, dropOnBlockId))) {
        toast({ title: "Недопустимое действие", description: "Нельзя переместить блок внутрь самого себя.", variant: "destructive" });
        return prevBlocks;
      }

      const blocksToAdd = [draggedBlock];
      if (draggedQuantifier) blocksToAdd.push(draggedQuantifier);

      const insertRecursive = (nodes: Block[]): Block[] => {
        // Case 1: Drop into a container (newParentId is the container's ID)
        if (newParentId === dropOnBlockId) {
          return nodes.map(node => {
            if (node.id === newParentId) {
              return { ...node, children: [...(node.children || []), ...blocksToAdd], isExpanded: true };
            }
            if (node.children) {
              return { ...node, children: insertRecursive(node.children) };
            }
            return node;
          });
        }
        
        // Case 2: Drop as a sibling
        const newNodes: Block[] = [];
        for (const node of nodes) {
            if (node.id === dropOnBlockId) {
                const parentInfo = findBlockAndParentRecursive(prevBlocks, dropOnBlockId);
                if ((parentInfo.parent?.id ?? null) === newParentId) {
                    newNodes.push(node, ...blocksToAdd);
                } else {
                    newNodes.push(node);
                }
            } else if (node.children) {
                newNodes.push({ ...node, children: insertRecursive(node.children) });
            } else {
                newNodes.push(node);
            }
        }
        return newNodes;
      };
      
      let finalBlocks: Block[]
      if (newParentId === null) { // Dropping in root
          const dropIndex = blocksWithoutDragged.findIndex(b => b.id === dropOnBlockId);
          if (dropIndex > -1) {
              blocksWithoutDragged.splice(dropIndex + 1, 0, ...blocksToAdd);
          }
          finalBlocks = blocksWithoutDragged;
      } else {
          finalBlocks = insertRecursive(blocksWithoutDragged);
      }

      toast({ title: "Блок перемещен", description: "Порядок блоков обновлен." });
      return finalBlocks;
    });
  }, [toast]);

  const handleOpenPaletteFor = (pId: string | null, ctxId: string | null = null) => {
    setParentIdForNewBlock(pId);
    setContextualBlockId(ctxId);
    setIsPaletteVisible(true);
  };
  
  const selectedBlock = selectedBlockId ? findBlockRecursive(blocks, selectedBlockId) : null;
  
  const highlightedGroupIndex = React.useMemo(() => {
    if (selectedBlock && (selectedBlock.type === BlockType.GROUP)) {
      const groupInfo = regexOutput.groupInfos.find(gi => gi.blockId === selectedBlock.id);
      return groupInfo ? groupInfo.groupIndex : -1;
    }
    return -1;
  }, [selectedBlock, regexOutput.groupInfos]);

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
        const canBeExpanded = [BlockType.GROUP, BlockType.LOOKAROUND, BlockType.ALTERNATION, BlockType.CONDITIONAL, BlockType.CHARACTER_CLASS].includes(b.type);
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
        const block = findBlockRecursive(blocks,selectedBlockId);
        const deleteAttached = block?.type !== BlockType.QUANTIFIER;
        handleDeleteBlock(selectedBlockId, deleteAttached);
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

        const canBeExpanded = [BlockType.GROUP, BlockType.LOOKAROUND, BlockType.ALTERNATION, BlockType.CONDITIONAL, BlockType.CHARACTER_CLASS].includes(currentBlock.type);

        if (event.key === 'ArrowUp') {
          event.preventDefault();
          const siblings = parent ? parent.children : blocks;
          if(currentBlock.type === BlockType.QUANTIFIER && parent && parent.children.includes(currentBlock) && indexInParent > 0){
            setSelectedBlockId(siblings[indexInParent - 1].id);
          } else if (indexInParent > 0 && siblings) {
            setSelectedBlockId(siblings[indexInParent - 1].id);
          }
        } else if (event.key === 'ArrowDown') {
          event.preventDefault();
          const siblings = parent ? parent.children : blocks;
          if (siblings && indexInParent < siblings.length - 1) {
            if(currentBlock.type !== BlockType.QUANTIFIER && (indexInParent + 1) < siblings.length && siblings[indexInParent+1].type === BlockType.QUANTIFIER){
                 setSelectedBlockId(siblings[indexInParent + 1].id);
            } else {
                 setSelectedBlockId(siblings[indexInParent + 1].id);
            }
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
    handleParseRegexString(pattern.regexString);
  };

  const handleParseRegexString = useCallback(async (regexString: string) => {
      if (!regexString) {
          setBlocks([]);
          return;
      }

      setIsParsing(true);
      try {
          const result = await generateRegexFromNaturalLanguage({ query: regexString });
          
          if (result.parsedBlocks && result.parsedBlocks.length > 0) {
              setBlocks(result.parsedBlocks);
              toast({ title: "Выражение разобрано", description: result.explanation });
          } else {
              // This is the controlled failure case from the flow
              toast({ title: "Ошибка разбора", description: result.explanation, variant: "destructive" });
          }

          if(result.recommendedFlags) {
              setRegexFlags(result.recommendedFlags);
          }
      } catch (error) {
          console.error("Critical AI Parsing Error:", error);
          toast({ title: "Критическая ошибка", description: "Не удалось связаться с сервисом. Проверьте ваше соединение.", variant: "destructive" });
      } finally {
          setIsParsing(false);
      }
  }, [toast]);


  const handleBlockHover = (blockId: string | null) => {
    setHoveredBlockId(blockId);
  };
  
  const renderBlockNodes = useCallback((nodes: Block[], parentId: string | null, depth: number, groupInfos: GroupInfo[]): React.ReactNode[] => {
    const nodeList: React.ReactNode[] = [];

    for (let i = 0; i < nodes.length; i++) {
        const block = nodes[i];
        let quantifierToRender: Block | null = null;

        if (block.type === BlockType.QUANTIFIER) {
            continue;
        }
        
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
            onReorder={handleReorderBlock}
            selectedId={selectedBlockId}
            onSelect={setSelectedBlockId}
            parentId={parentId}
            depth={depth} 
            onBlockHover={handleBlockHover}
            renderChildNodes={(childNodes, pId, nextDepth, gInfos) => renderBlockNodes(childNodes, pId, nextDepth, gInfos)}
            groupInfos={groupInfos}
          />
        );
        
        if (quantifierToRender) {
            i++; 
        }
    }
    return nodeList;
  }, [selectedBlockId, hoveredBlockId, regexOutput.groupInfos, handleUpdateBlock, handleDeleteBlock, handleDuplicateBlock, handleUngroupBlock, handleWrapBlock, handleReorderBlock]);

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <ResizablePanelGroup direction="vertical" className="flex-1 overflow-hidden">
        <ResizablePanel defaultSize={65} minSize={30}>
          <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel defaultSize={selectedBlockId ? 60 : 100} minSize={30} className="flex flex-col overflow-hidden">
              <div className="flex-1 flex flex-col m-2 overflow-hidden">
                <Card className="flex-1 flex flex-col shadow-md border-primary/20 overflow-hidden">
                  <CardHeader className="py-2 px-3 border-b">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Edit3 size={18} className="text-primary"/> Дерево выражения
                      </CardTitle>
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="iconSm" onClick={handleExpandAll} title="Развернуть всё (Ctrl+Shift+Вниз)">
                          <UnfoldVertical size={14} />
                        </Button>
                        <Button variant="outline" size="iconSm" onClick={handleCollapseAll} title="Свернуть всё (Ctrl+Shift+Вверх)">
                          <FoldVertical size={14} />
                        </Button>
                        <Button size="sm" onClick={() => handleOpenPaletteFor(null)}>
                          <Plus size={16} className="mr-1" /> Добавить блок
                        </Button>
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
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
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-3 flex-1 min-h-0">
                    <ScrollArea className="h-full pr-2">
                      {blocks.length === 0 ? (
                        <div className="text-center text-muted-foreground py-10 flex flex-col items-center justify-center h-full">
                          <Layers size={48} className="mb-3 opacity-50" />
                          <p className="font-medium">Начните строить!</p>
                          <p className="text-sm">Вставьте Regex в поле выше или добавьте блоки вручную.</p>
                        </div>
                      ) : (
                        <div className="space-y-1"> 
                          {renderBlockNodes(blocks, null, 0, regexOutput.groupInfos)}
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </ResizablePanel>
            
            {selectedBlockId && (
              <>
                <ResizableHandle withHandle />
                 <ResizablePanel defaultSize={40} minSize={25} maxSize={50} className="overflow-hidden">
                   <div className="h-full m-2 ml-0 shadow-md border-primary/20 rounded-lg overflow-hidden bg-card">
                      <SettingsPanel
                          block={selectedBlock}
                          onUpdate={handleUpdateBlock}
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
                    generatedRegex={regexOutput.regexString} 
                    regexFlags={regexFlags} 
                    onFlagsChange={setRegexFlags}
                    onParseRegexString={handleParseRegexString}
                    isParsing={isParsing}
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
                    highlightedGroupIndex={highlightedGroupIndex}
                  />
                </TabsContent>
                <TabsContent value="codegen" className="mt-2 flex-1 overflow-y-auto p-0.5">
                  <CodeGenerationPanel generatedRegex={regexOutput.regexString} regexFlags={regexFlags} testText={testText} />
                </TabsContent>
                <TabsContent value="debug" className="mt-2 flex-1 overflow-y-auto p-0.5">
                  <DebugView />
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
