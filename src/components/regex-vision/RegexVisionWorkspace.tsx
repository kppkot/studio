
"use client";
import React, { useState, useEffect, useCallback } from 'react';
import type { Block, RegexMatch, GroupInfo, SavedPattern, CharacterClassSettings } from './types'; 
import { BlockType } from './types';
import { BLOCK_CONFIGS } from './constants';
import { generateId, generateRegexStringAndGroupInfo, createLiteral, processAiBlocks, cloneBlockForState, breakdownPatternIntoChildren, reconstructPatternFromChildren } from './utils'; 
import { useToast } from '@/hooks/use-toast';
import { generateRegexFromNaturalLanguage, type NaturalLanguageRegexOutput } from '@/ai/flows/natural-language-regex-flow';
import { generateNextGuidedStep, regenerateGuidedStep } from '@/ai/flows/guided-regex-flow';
import type { GuidedRegexStep, NextGuidedStepInput, RegenerateGuidedStepInput } from '@/ai/flows/schemas';

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
import AnalysisPanel from './AnalysisPanel';
import GuidedStepsPanel from './GuidedStepsPanel';
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
import { Layers, Edit3, Code2, PlayCircle, Bug, Plus, FoldVertical, UnfoldVertical, Sparkles, Gauge, Library, Lightbulb, Combine, Menu, Puzzle, Share2, DownloadCloud, UploadCloud, Loader2, Terminal } from 'lucide-react'; 
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

interface GuidedModeState {
    query: string;
    exampleTestText: string;
    steps: GuidedRegexStep[];
    isLoading: boolean;
}

interface DebugLog {
    timestamp: string;
    message: string;
}

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
  const [regexError, setRegexError] = useState<string | null>(null);
  const [lastWizardQuery, setLastWizardQuery] = useState('');
  
  const [guidedModeState, setGuidedModeState] = useState<GuidedModeState | null>(null);
  const [debugLogs, setDebugLogs] = useState<DebugLog[]>([]);


  const { toast } = useToast();

  const addDebugLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
    setDebugLogs(prev => [{ timestamp, message }, ...prev.slice(0, 49)]); // Keep last 50 logs
  }

  useEffect(() => {
    addDebugLog("Инициализация рабочей области...");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const { regexString: newRegex, groupInfos } = generateRegexStringAndGroupInfo(blocks);
    setRegexOutput({ regexString: newRegex, groupInfos });
    addDebugLog(`Генерация Regex: /${newRegex}/${regexFlags}`);

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
            const errorMessage = `Ошибка: ${error.message}. Пожалуйста, исправьте блоки в конструкторе.`;
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
    setIsPaletteVisible(false);
  }, [toast, blocks, selectedBlockId]);


  const handleAddBlocksFromQuickGen = useCallback((query: string, newBlocks: Block[], parentId: string | null, exampleTestText?: string, recommendedFlags?: string) => {
    if (newBlocks.length === 0) return;
    
    setLastWizardQuery(query);
    setGuidedModeState(null); // Exit guided mode if active

    let targetParentId = parentId;

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
    
    if (recommendedFlags) {
      // Combine with existing 'g' flag if it's there, avoiding duplicates.
      const currentGlobalFlag = regexFlags.includes('g') ? 'g' : '';
      const otherFlags = recommendedFlags.replace(/g/g, '');
      const finalFlags = Array.from(new Set(currentGlobalFlag + otherFlags)).join('');
      setRegexFlags(finalFlags);
    }

    setSelectedBlockId(newBlocks[newBlocks.length - 1].id);
    setIsWizardModalOpen(false);
    toast({ title: "Блоки добавлены", description: "Блоки из Помощника успешно добавлены." });
  }, [toast, blocks, selectedBlockId, regexFlags]);

  const handleStartGuidedMode = useCallback(async (query: string, exampleTestText: string) => {
    setLastWizardQuery(query);
    setTestText(exampleTestText);
    setBlocks([]); // Clear existing blocks for a fresh start
    setSelectedBlockId(null);
    setGuidedModeState({ query, exampleTestText, steps: [], isLoading: true });

    try {
        const input: NextGuidedStepInput = { query, exampleTestText, existingSteps: [] };
        const firstStep = await generateNextGuidedStep(input);
        setGuidedModeState({ query, exampleTestText, steps: [firstStep], isLoading: false });
        toast({ title: "Пошаговый режим запущен!", description: "AI предложил первый шаг." });
    } catch (error) {
        console.error("Failed to start guided mode:", error);
        toast({ title: "Ошибка AI", description: "Не удалось получить первый шаг от AI.", variant: "destructive" });
        setGuidedModeState(null); // Cancel guided mode on error
    }
  }, [toast]);

 const handleAddStepBlock = useCallback((block: Block, parentId: string | null) => {
    const processedBlock = processAiBlocks([block])[0];
    if (!processedBlock) return;

    if (processedBlock.type === BlockType.QUANTIFIER) {
      if (!selectedBlockId) {
        toast({ title: "Ошибка", description: "Выберите блок, к которому нужно применить квантификатор.", variant: "destructive" });
        return;
      }
      const insertQuantifier = (nodes: Block[]): Block[] | null => {
        for (let i = 0; i < nodes.length; i++) {
          const currentNode = nodes[i];
          if (currentNode.id === selectedBlockId) {
            if (currentNode.type === BlockType.QUANTIFIER) return null;
            if (i + 1 < nodes.length && nodes[i+1].type === BlockType.QUANTIFIER) return null;
            const newNodes = [...nodes];
            newNodes.splice(i + 1, 0, processedBlock);
            return newNodes;
          }
          if (currentNode.children) {
            const newChildren = insertQuantifier(currentNode.children);
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
        const newTree = insertQuantifier(prev);
        if (newTree) {
          setSelectedBlockId(processedBlock.id);
          return newTree;
        }
        toast({ title: 'Невозможно добавить квантификатор', description: 'Этот блок уже имеет квантификатор или является квантификатором.', variant: 'destructive' });
        return prev;
      });
      return;
    }

    let targetParentId: string | null = parentId;
    let parentBlock: Block | null = null;
    
    if (!targetParentId && selectedBlockId) {
      const selBlock = findBlockRecursive(blocks, selectedBlockId);
      if (selBlock) {
        const isGenericContainer = [BlockType.GROUP, BlockType.ALTERNATION, BlockType.LOOKAROUND, BlockType.CONDITIONAL].includes(selBlock.type);
        const isCharClassAsContainer = selBlock.type === BlockType.CHARACTER_CLASS && 
            (!(selBlock.settings as CharacterClassSettings).pattern || (selBlock.children && selBlock.children.length > 0));

        if (isGenericContainer || isCharClassAsContainer) {
             targetParentId = selectedBlockId;
             parentBlock = selBlock;
        }
      }
    } else if (targetParentId) {
        parentBlock = findBlockRecursive(blocks, targetParentId);
    }

    if (targetParentId) {
      setBlocks(prev => addChildRecursive(prev, targetParentId, processedBlock));
      
      if (parentBlock && parentBlock.type === BlockType.ALTERNATION) {
          setSelectedBlockId(targetParentId);
      } else {
          setSelectedBlockId(processedBlock.id);
      }
    } else {
      setBlocks(prev => [...prev, processedBlock]);
      setSelectedBlockId(processedBlock.id);
    }
  }, [toast, blocks, selectedBlockId]);

  const handleClearGuidedMode = useCallback(() => {
    setGuidedModeState(null);
  }, []);

  const handleResetAndClearGuidedMode = useCallback(() => {
    setBlocks([]);
    setGuidedModeState(null);
  }, []);

  const handleGenerateNextGuidedStep = async () => {
    if (!guidedModeState) return;

    setGuidedModeState(prev => ({ ...prev!, isLoading: true }));
    try {
        const newStep = await generateNextGuidedStep({
            query: guidedModeState.query,
            exampleTestText: guidedModeState.exampleTestText,
            existingSteps: guidedModeState.steps,
        });
        setGuidedModeState(prev => ({
            ...prev!,
            steps: [...prev!.steps, newStep],
            isLoading: false
        }));
        if (newStep.isFinalStep) {
            toast({ title: "План завершен!", description: "AI считает, что это был последний необходимый шаг." });
        }
    } catch (error) {
        console.error("Failed to generate next step:", error);
        toast({ title: "Ошибка AI", description: "Не удалось сгенерировать следующий шаг.", variant: "destructive" });
        setGuidedModeState(prev => ({ ...prev!, isLoading: false }));
    }
  };

  const handleRegenerateGuidedStep = async (indexToRegen: number) => {
    if (!guidedModeState) return;

    setGuidedModeState(prev => ({ ...prev!, isLoading: true }));
    try {
        const stepToRegenerate = guidedModeState.steps[indexToRegen];
        const stepsSoFar = guidedModeState.steps.slice(0, indexToRegen);

        const newStep = await regenerateGuidedStep({
            query: guidedModeState.query,
            exampleTestText: guidedModeState.exampleTestText,
            stepsSoFar,
            stepToRegenerate
        });
        
        setGuidedModeState(prev => {
            const newSteps = [...prev!.steps];
            newSteps[indexToRegen] = newStep;
            return { ...prev!, steps: newSteps, isLoading: false };
        });

    } catch (error) {
        console.error("Failed to regenerate step:", error);
        toast({ title: "Ошибка AI", description: "Не удалось перегенерировать шаг.", variant: "destructive" });
        setGuidedModeState(prev => ({ ...prev!, isLoading: false }));
    }
  };


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

      const canDropTargetBeParent = [BlockType.GROUP, BlockType.LOOKAROUND, BlockType.ALTERNATION, BlockType.CONDITIONAL, BlockType.CHARACTER_CLASS].includes(dropTargetNode.type);
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
        const { parent: dropTargetParent, indexInParent: dropTargetIndex } = dropTargetNodeInfo;
        const targetContainer = dropTargetParent ? dropTargetParent.children! : blocksWithoutDragged;
        const adjustedDropIndex = targetContainer.findIndex(b => b.id === dropOnBlockId);

        if (adjustedDropIndex !== -1) {
            targetContainer.splice(adjustedDropIndex + 1, 0, ...blocksToAdd);
        } else {
            blocksWithoutDragged.push(...blocksToAdd);
        }

        const updateParentRecursive = (nodes: Block[], parentToUpdate: Block): Block[] => {
            return nodes.map(n => {
                if (n.id === parentToUpdate.id) return parentToUpdate;
                if (n.children) {
                    return { ...n, children: updateParentRecursive(n.children, parentToUpdate) };
                }
                return n;
            });
        };

        if (dropTargetParent) {
            finalBlocks = updateParentRecursive(blocksWithoutDragged, dropTargetParent);
        } else {
            finalBlocks = blocksWithoutDragged;
        }
      }
      
      const updatedBlocksWithToast = () => {
        toast({ title: "Блок перемещен", description: "Порядок блоков обновлен." });
        return finalBlocks;
      };
      return updatedBlocksWithToast();

    });
  }, [toast]);


  const handleOpenPaletteForChild = useCallback((pId: string) => {
    setParentIdForNewBlock(pId);
    setIsPaletteVisible(true);
  }, []);

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
              setGuidedModeState(null);
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
    setLastWizardQuery(pattern.name); 
    handleClearGuidedMode();

    try {
      const aiResult: NaturalLanguageRegexOutput = await generateRegexFromNaturalLanguage({ query: pattern.regexString });
      if (aiResult.parsedBlocks && aiResult.parsedBlocks.length > 0) {
        const parsedBlocksFromAI = processAiBlocks(aiResult.parsedBlocks);
        setBlocks(parsedBlocksFromAI);
        toast({ title: "Паттерн применен и разобран!", description: `"${pattern.name}" загружен и преобразован в блоки.` });
      } else {
        const fallbackBlock = createLiteral(pattern.regexString, true); 
        setBlocks([fallbackBlock]);
        toast({ title: "Паттерн применен (как литерал)", description: `"${pattern.name}" загружен. AI не смог разобрать его на блоки.` });
      }
      if (aiResult.exampleTestText) { 
          setTestText(aiResult.exampleTestText);
      }
    } catch (error) {
      console.error("Error parsing pattern with AI:", error);
      const fallbackBlock = createLiteral(pattern.regexString, true);
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

  const isCombinableBlock = (type: BlockType): boolean => {
    return type === BlockType.LITERAL || type === BlockType.CHARACTER_CLASS;
  };

  const handleAutoGroupAlternation = useCallback((alternationId: string) => {
    let movedCountResult = 0;
    const processNodesRecursive = (nodes: Block[]): Block[] => {
      for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].id === alternationId) {
          const alternationBlock = nodes[i];
          const blocksToMove: Block[] = [];
          let currentIndex = i + 1;
          
          while (currentIndex < nodes.length && isCombinableBlock(nodes[currentIndex].type)) {
            blocksToMove.push(nodes[currentIndex]);
            currentIndex++;
          }

          if (blocksToMove.length > 0) {
            movedCountResult = blocksToMove.length;
            const updatedAlternation = {
              ...alternationBlock,
              children: [...(alternationBlock.children || []), ...blocksToMove.map(cloneBlockForState)],
              isExpanded: true,
            };
            const newNodes = [...nodes];
            newNodes.splice(i, 1 + blocksToMove.length, updatedAlternation);
            return newNodes;
          }
          return nodes;
        }
        
        if (nodes[i].children) {
          const updatedChildren = processNodesRecursive(nodes[i].children!);
          if (updatedChildren !== nodes[i].children) {
            const newNodes = [...nodes];
            newNodes[i] = { ...nodes[i], children: updatedChildren };
            return newNodes;
          }
        }
      }
      return nodes;
    };

    const updatedBlocks = processNodesRecursive(blocks);
    
    if (movedCountResult > 0) {
      setBlocks(updatedBlocks);
      toast({ title: "Блоки объединены!", description: `Добавлено ${movedCountResult} вариант(а).` });
    }
  }, [blocks, toast]);

  const handleApplyFix = useCallback((fixResult: NaturalLanguageRegexOutput) => {
    if (fixResult.parsedBlocks && fixResult.parsedBlocks.length > 0) {
      setBlocks(fixResult.parsedBlocks);
    }
    if (fixResult.recommendedFlags) {
       const currentGlobalFlag = regexFlags.includes('g') ? 'g' : '';
      const otherFlags = fixResult.recommendedFlags.replace(/g/g, '');
      const finalFlags = Array.from(new Set(currentGlobalFlag + otherFlags)).join('');
      setRegexFlags(finalFlags);
    }
    if(fixResult.exampleTestText) {
        setTestText(fixResult.exampleTestText);
    }
    setRegexError(null); 
    setSelectedBlockId(null);
    setGuidedModeState(null);
  }, [regexFlags]);

  const showRightPanel = selectedBlockId || guidedModeState;

  const renderBlockNodes = (nodes: Block[], parentId: string | null, depth: number, groupInfos: GroupInfo[]): React.ReactNode[] => {
    addDebugLog(`Render Engine: v2.1-instrumented. Rendering ${nodes.length} nodes at depth ${depth}.`);
    const nodeList: React.ReactNode[] = [];

    for (let i = 0; i < nodes.length; i++) {
        const block = nodes[i];
        let quantifierToRender: Block | null = null;

        if (block.type === BlockType.QUANTIFIER) {
            addDebugLog(`Skipping Quantifier node ${block.id} as it will be handled by its parent.`);
            continue;
        }

        if (i + 1 < nodes.length && nodes[i + 1].type === BlockType.QUANTIFIER) {
            quantifierToRender = nodes[i + 1];
            addDebugLog(`Found Quantifier satellite for Block ${block.id}: ${quantifierToRender.id}`);
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
        
        if (quantifierToRender) {
            i++; 
        }
    }
    return nodeList;
  };


  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <ResizablePanelGroup direction="vertical" className="flex-1 overflow-hidden">
        <ResizablePanel defaultSize={65} minSize={30}>
          <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel defaultSize={showRightPanel ? 60 : 100} minSize={30} className="flex flex-col overflow-hidden">
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
                        <Button size="sm" variant="outline" onClick={() => { setParentIdForNewBlock(null); setIsWizardModalOpen(true); }}>
                          <Sparkles size={16} className="mr-1 text-amber-500" /> AI Помощник
                        </Button>
                        <Button size="sm" onClick={() => { setParentIdForNewBlock(null); setIsPaletteVisible(true); }}>
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
                          <p className="font-medium">Начните строить свой regex!</p>
                          <p className="text-sm">Нажмите "Добавить блок" или используйте "AI Помощник".</p>
                        </div>
                      ) : (
                        <div className="space-y-1"> 
                          {renderBlockNodes(blocks, null, 0, regexOutput.groupInfos)}
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>

                {/* DEBUG PANEL */}
                <Card className="mt-2 shadow-sm border-blue-500/20 bg-blue-950 text-blue-200">
                    <CardHeader className="py-1 px-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Terminal size={16}/> Панель отладки рендеринга
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <ScrollArea className="h-24">
                            <div className="p-2 font-mono text-xs space-y-1">
                                {debugLogs.map((log, i) => (
                                    <p key={i}><span className="text-blue-400/70">{log.timestamp}</span> &gt; {log.message}</p>
                                ))}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>

                <AnalysisPanel
                  isVisible={regexError !== null}
                  originalQuery={lastWizardQuery}
                  generatedRegex={regexOutput.regexString}
                  testText={testText}
                  errorContext={regexError ?? undefined}
                  onFixApplied={handleApplyFix}
                />
              </div>
            </ResizablePanel>
            
            {showRightPanel && (
              <>
                <ResizableHandle withHandle />
                 <ResizablePanel defaultSize={40} minSize={25} maxSize={50} className="overflow-hidden">
                   <div className="h-full m-2 ml-0 shadow-md border-primary/20 rounded-lg overflow-hidden bg-card">
                      {guidedModeState ? (
                          <GuidedStepsPanel
                                query={guidedModeState.query}
                                exampleTestText={guidedModeState.exampleTestText}
                                steps={guidedModeState.steps}
                                isLoading={guidedModeState.isLoading}
                                onAddStep={handleAddStepBlock}
                                onFinish={handleClearGuidedMode}
                                onResetAndFinish={handleResetAndClearGuidedMode}
                                selectedBlockId={selectedBlockId}
                                blocks={blocks}
                                onNextStep={handleGenerateNextGuidedStep}
                                onRegenerate={handleRegenerateGuidedStep}
                            />
                      ) : selectedBlockId ? (
                        <SettingsPanel
                            block={selectedBlock}
                            onUpdate={handleUpdateBlock}
                            onClose={() => setSelectedBlockId(null)}
                        />
                      ) : null}
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
          onCompleteQuickGen={handleAddBlocksFromQuickGen}
          onStartGuidedMode={handleStartGuidedMode}
          initialParentId={parentIdForNewBlock}
        />
      )}
    </div>
  );
};

export default RegexVisionWorkspace;
