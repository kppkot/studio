
"use client";
import React, { useState, useEffect, useCallback } from 'react';
import type { Block, RegexMatch, GroupInfo, SavedPattern } from './types'; 
import { BlockType } from './types';
import { BLOCK_CONFIGS } from './constants';
import { generateId, generateRegexStringAndGroupInfo, createLiteral, processAiBlocks, cloneBlockForState } from './utils'; 
import { useToast } from '@/hooks/use-toast';
import { generateRegexFromNaturalLanguage, type NaturalLanguageRegexOutput } from '@/ai/flows/natural-language-regex-flow';

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
import { Layers, Edit3, Code2, PlayCircle, Bug, Plus, FoldVertical, UnfoldVertical, Sparkles, Gauge, Library, Lightbulb, Combine } from 'lucide-react'; 
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { cn } from '@/lib/utils';


const duplicateAndInsertBlockRecursive = (currentBlocks: Block[], targetId: string): { updatedBlocks: Block[], success: boolean, newSelectedId?: string } => {
  for (let i = 0; i < currentBlocks.length; i++) {
    const block = currentBlocks[i];
    if (block.id === targetId) {
      const originalBlock = block;
      const newBlock = cloneBlockForState(originalBlock);
      const updatedBlocks = [...currentBlocks];
      updatedBlocks.splice(i + 1, 0, newBlock);

      // Check if the duplicated block has an attached quantifier
      if (block.type !== BlockType.QUANTIFIER && (i + 1) < updatedBlocks.length && updatedBlocks[i+1].type === BlockType.QUANTIFIER) {
          // This condition means the original block was followed by a quantifier.
          // We should also duplicate the quantifier.
          const originalQuantifier = updatedBlocks[i+2]; // original quantifier is now at i+2 because newBlock was inserted at i+1
          if(originalQuantifier && originalQuantifier.type === BlockType.QUANTIFIER) {
            const newQuantifier = cloneBlockForState(originalQuantifier);
            updatedBlocks.splice(i + 2, 0, newQuantifier); // insert new quantifier after newBlock
          }
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
      const blocksCopy = prevBlocks.map(b => cloneBlockForState(b)); // Deep clone to avoid mutation issues

      const replaceInTree = (nodes: Block[]): Block[] => {
          for (let i=0; i < nodes.length; i++) {
              if (nodes[i].id === blockIdToWrap) {
                  const originalBlock = nodes[i];
                  newGroupBlock.children.push(cloneBlockForState(originalBlock));
                  let nextIndex = i + 1;
                  if (originalBlock.type !== BlockType.QUANTIFIER && nextIndex < nodes.length && nodes[nextIndex].type === BlockType.QUANTIFIER) {
                      newGroupBlock.children.push(cloneBlockForState(nodes[nextIndex]));
                      return [...nodes.slice(0, i), newGroupBlock, ...nodes.slice(nextIndex + 1)];
                  }
                  return [...nodes.slice(0, i), newGroupBlock, ...nodes.slice(i + 1)];
              }
              if (nodes[i].children) {
                  const newChildren = replaceInTree(nodes[i].children);
                  if (newChildren.length !== nodes[i].children.length || newChildren.some((nc, idx) => nc.id !== nodes[i].children[idx].id)) {
                      return [...nodes.slice(0,i), {...nodes[i], children: newChildren}, ...nodes.slice(i+1)];
                  }
              }
          }
          return nodes; // No change
      }
      
      const updatedTree = replaceInTree(blocksCopy);

      if (updatedTree !== blocksCopy) {
        setSelectedBlockId(newGroupBlock.id);
        toast({ title: "Блок обернут", description: "Выбранный блок был обернут в новую группу." });
        return updatedTree;
      }
      
      toast({ title: "Ошибка", description: "Не удалось обернуть блок.", variant: "destructive" });
      return prevBlocks;
    });
  }, [toast]);


  const handleReorderBlock = useCallback((draggedId: string, dropOnBlockId: string, parentOfDropOnBlockIdOrDropTargetId: string | null) => {
    setBlocks(prevBlocks => {
      let draggedBlockInstance: Block | null = null;
      let draggedQuantifierInstance: Block | null = null;

      const removeDraggedRecursive = (nodes: Block[], idToRemove: string): { updatedNodes: Block[], foundBlock: Block | null, foundQuantifier: Block | null } => {
        let found: Block | null = null;
        let foundQ: Block | null = null;
        
        const newNodes: Block[] = [];
        for(let i=0; i<nodes.length; i++) {
            const b = nodes[i];
            if (b.id === idToRemove) {
                found = b;
                if (b.type !== BlockType.QUANTIFIER && (i + 1) < nodes.length && nodes[i+1].type === BlockType.QUANTIFIER) {
                    foundQ = nodes[i+1];
                    i++; 
                }
            } else {
                newNodes.push(b);
            }
        }

        if (found) return { updatedNodes: newNodes, foundBlock: found, foundQuantifier: foundQ };

        for (let i = 0; i < newNodes.length; i++) {
          if (newNodes[i].children && newNodes[i].children.length > 0) {
            const childResult = removeDraggedRecursive(newNodes[i].children, idToRemove);
            if (childResult.foundBlock) {
              newNodes[i] = { ...newNodes[i], children: childResult.updatedNodes };
              return { updatedNodes: newNodes, foundBlock: childResult.foundBlock, foundQuantifier: childResult.foundQuantifier };
            }
          }
        }
        return { updatedNodes: nodes, foundBlock: null, foundQuantifier: null };
      };

      const { updatedNodes: blocksWithoutDraggedOriginal, foundBlock, foundQuantifier } = removeDraggedRecursive(prevBlocks, draggedId);

      if (!foundBlock) {
        return prevBlocks;
      }
      let blocksWithoutDragged = cloneBlockForState({id: 'root', type: BlockType.LITERAL, settings: {text:''}, children: blocksWithoutDraggedOriginal, isExpanded: true}).children || [];


      draggedBlockInstance = cloneBlockForState(foundBlock);
      if (foundQuantifier) {
        draggedQuantifierInstance = cloneBlockForState(foundQuantifier);
      }


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
      const blocksToAdd = [draggedBlockInstance];
      if (draggedQuantifierInstance) blocksToAdd.push(draggedQuantifierInstance);


      if (canDropTargetBeParent && dragTargetRole === 'parent') {
        const addAsChildRecursiveFn = (nodes: Block[], targetParentId: string, childrenToAdd: Block[]): Block[] => {
          return nodes.map(n => {
            if (n.id === targetParentId) {
              const existingChildren = n.children || [];
              return { ...n, children: [...existingChildren, ...childrenToAdd], isExpanded: true };
            }
            if (n.children) {
              return { ...n, children: addAsChildRecursiveFn(n.children, targetParentId, childrenToAdd) };
            }
            return n;
          });
        };
        finalBlocks = addAsChildRecursiveFn(blocksWithoutDragged, dropOnBlockId, blocksToAdd);
      } else {
        const addAsSiblingRecursiveFn = (
            nodes: Block[],
            parentToSearchInId: string | null,
            afterSiblingId: string,
            newBlocks: Block[]
        ): Block[] => {
            if (parentToSearchInId === null) { 
                const targetIdx = nodes.findIndex(n => n.id === afterSiblingId);
                const resultNodes = [...nodes];
                if (targetIdx !== -1) resultNodes.splice(targetIdx + 1, 0, ...newBlocks);
                else resultNodes.push(...newBlocks);
                return resultNodes;
            }

            return nodes.map(n => { 
                if (n.id === parentToSearchInId) {
                    const targetIdx = (n.children || []).findIndex(child => child.id === afterSiblingId);
                    const newChildren = [...(n.children || [])];
                    if (targetIdx !== -1) newChildren.splice(targetIdx + 1, 0, ...newBlocks);
                    else newChildren.push(...newBlocks);
                    return { ...n, children: newChildren, isExpanded: true };
                }
                if (n.children) { 
                    return { ...n, children: addAsSiblingRecursiveFn(n.children, parentToSearchInId, afterSiblingId, newBlocks) };
                }
                return n;
            });
        };
        finalBlocks = addAsSiblingRecursiveFn(blocksWithoutDragged, parentOfDropOnBlockIdOrDropTargetId, dropOnBlockId, blocksToAdd);
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

        const canBeExpanded = [BlockType.GROUP, BlockType.LOOKAROUND, BlockType.ALTERNATION, BlockType.CONDITIONAL].includes(currentBlock.type);

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
      if (aiResult.exampleTestText) { 
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

  const handleAutoGroupAlternation = useCallback((alternationId: string) => {
    const processNodes = (nodes: Block[]): Block[] => {
      const altIndex = nodes.findIndex(n => n.id === alternationId);

      if (altIndex !== -1) {
        const alternationBlock = nodes[altIndex];
        const literalsToMove: Block[] = [];
        let currentIndex = altIndex + 1;
        
        while (currentIndex < nodes.length && nodes[currentIndex].type === BlockType.LITERAL) {
          literalsToMove.push(nodes[currentIndex]);
          currentIndex++;
        }

        if (literalsToMove.length > 0) {
          alternationBlock.children.push(...literalsToMove.map(cloneBlockForState));
          alternationBlock.isExpanded = true;
          nodes.splice(altIndex + 1, literalsToMove.length);
          toast({ title: "Блоки объединены!", description: `Добавлено ${literalsToMove.length} вариант(а).` });
        }
        return nodes;
      } else {
        return nodes.map(node => {
          if (node.children) {
            return { ...node, children: processNodes(node.children) };
          }
          return node;
        });
      }
    };

    setBlocks(prevBlocks => {
      const blocksCopy = prevBlocks.map(b => cloneBlockForState(b));
      return processNodes(blocksCopy);
    });
  }, [toast]);


  const headerHeight = "60px";

  const renderBlockNodes = (nodes: Block[], parentId: string | null, depth: number, groupInfos: GroupInfo[]): React.ReactNode[] => {
    const nodeList: React.ReactNode[] = [];
    for (let i = 0; i < nodes.length; i++) {
        const block = nodes[i];
        let quantifierToRender: Block | null = null;

        if (block.type !== BlockType.QUANTIFIER && (i + 1) < nodes.length && nodes[i + 1].type === BlockType.QUANTIFIER) {
            quantifierToRender = nodes[i + 1];
        }
        
        nodeList.push(
          <BlockNode
            key={block.id}
            block={block}
            quantifierToRender={quantifierToRender}
            onUpdate={handleUpdateBlock}
            onDelete={handleDeleteBlock}
            onAddChild={handleOpenPaletteForChild}
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

        // Suggestion logic for empty alternation
        const isPotentiallyEmptyAlt = block.type === BlockType.ALTERNATION && (!block.children || block.children.length === 0);
        if (isPotentiallyEmptyAlt) {
            let subsequentLiteralsCount = 0;
            let j = i + 1;
            while (j < nodes.length && nodes[j].type === BlockType.LITERAL) {
                subsequentLiteralsCount++;
                j++;
            }

            if (subsequentLiteralsCount > 0) {
                nodeList.push(
                    <Card key={`${block.id}-suggestion`} className="my-2 p-3 border-amber-500/50 bg-amber-500/10">
                        <div className="flex items-center gap-3">
                            <Lightbulb className="h-6 w-6 text-amber-600 shrink-0" />
                            <div className="flex-1">
                                <h4 className="font-semibold text-sm">Объединить следующие {subsequentLiteralsCount} блок(а)?</h4>
                                <p className="text-xs text-muted-foreground">Похоже, вы хотите создать выбор 'ИЛИ'.</p>
                            </div>
                            <Button size="sm" variant="outline" className="bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30" onClick={() => handleAutoGroupAlternation(block.id)}>
                                <Combine size={16} className="mr-2"/>
                                Объединить
                            </Button>
                        </div>
                    </Card>
                );
            }
        }


        if (quantifierToRender) {
            i++; 
        }
    }
    return nodeList;
  };


  return (
    <div className="flex flex-col h-screen bg-background text-foreground" style={{ "--header-height": headerHeight } as React.CSSProperties}>
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
                      <div className="space-y-0"> 
                         {renderBlockNodes(blocks, null, 0, regexOutput.groupInfos)}
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
          onComplete={(wizardBlocks, parentId, exampleText) => { 
            handleAddBlocksFromWizard(wizardBlocks, parentId, exampleText); 
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
