
"use client";
import React, { useState, useEffect, useCallback } from 'react';
import type { Block, RegexMatch } from './types';
import { BlockType } from './types';
import { BLOCK_CONFIGS } from './constants';
import { generateId, generateRegexString } from './utils';
import { useToast } from '@/hooks/use-toast';

import AppHeader from './AppHeader';
import BlockNode from './BlockNode';
import SettingsPanel from './SettingsPanel';
import BlockPalette from './BlockPalette';
import RegexOutputDisplay from './RegexOutputDisplay';
import TestArea from './TestArea';
import CodeGenerationPanel from './CodeGenerationPanel';
import DebugView from './DebugView';
import { Button } from '@/components/ui/button';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Layers, Edit3, Code2, PlayCircle, Bug, Plus, FoldVertical, UnfoldVertical } from 'lucide-react';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

const deepCloneBlock = (block: Block): Block => {
  const newBlock: Block = {
    ...block,
    id: generateId(),
    settings: { ...block.settings },
    children: block.children ? block.children.map(child => deepCloneBlock(child)) : [],
    isExpanded: block.isExpanded,
  };
  if (newBlock.type === BlockType.GROUP || 
      newBlock.type === BlockType.LOOKAROUND || 
      newBlock.type === BlockType.ALTERNATION || 
      newBlock.type === BlockType.CONDITIONAL) {
      newBlock.children = newBlock.children || [];
  }
  return newBlock;
};

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
      return block.children ? block.children.map(child => ({...child})) : [];
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
  const [parentIdForNewBlock, setParentIdForNewBlock] = useState<string | null>(null);
  const [isPaletteVisible, setIsPaletteVisible] = useState(false);
  
  const [testText, setTestText] = useState<string>('Быстрая коричневая лиса прыгает через ленивую собаку.');
  const [regexFlags, setRegexFlags] = useState<string>('g');
  const [matches, setMatches] = useState<RegexMatch[]>([]);
  const [generatedRegex, setGeneratedRegex] = useState<string>('');

  const { toast } = useToast();

  useEffect(() => {
    const newRegex = generateRegexString(blocks);
    setGeneratedRegex(newRegex);

    if (newRegex && testText) {
      try {
        const regexObj = new RegExp(newRegex, regexFlags);
        const foundRawMatches = [...testText.matchAll(regexObj)];
        const formattedMatches: RegexMatch[] = foundRawMatches.map(rawMatch => ({
          match: rawMatch[0],
          index: rawMatch.index!,
          groups: Array.from(rawMatch).slice(1),
          namedGroups: rawMatch.groups,
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

  const updateBlockRecursive = (currentBlocks: Block[], targetId: string, updatedBlock: Block): Block[] => {
    return currentBlocks.map(block => {
      if (block.id === targetId) return updatedBlock;
      if (block.children) {
        return { ...block, children: updateBlockRecursive(block.children, targetId, updatedBlock) };
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
        const parentCanBeExpanded = block.type === BlockType.GROUP || block.type === BlockType.LOOKAROUND || block.type === BlockType.ALTERNATION || block.type === BlockType.CONDITIONAL;
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
    
    const canBeExpanded = type === BlockType.GROUP || type === BlockType.LOOKAROUND || type === BlockType.ALTERNATION || type === BlockType.CONDITIONAL;

    const newBlock: Block = {
      id: generateId(),
      type,
      settings: customSettings || { ...config.defaultSettings },
      children: [],
      isExpanded: canBeExpanded ? true : undefined,
    };

    if (parentId) {
      setBlocks(prev => addChildRecursive(prev, parentId, newBlock));
    } else {
      setBlocks(prev => [...prev, newBlock]);
    }
    setSelectedBlockId(newBlock.id);
    setParentIdForNewBlock(null);
    setIsPaletteVisible(false);
  }, [toast]);


  const handleUpdateBlock = useCallback((id: string, updatedBlock: Block) => {
    setBlocks(prev => updateBlockRecursive(prev, id, updatedBlock));
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
      children: [], // Will be populated
      isExpanded: true,
    };

    const wrapRecursively = (currentNodes: Block[]): Block[] => {
      return currentNodes.map(node => {
        if (node.id === blockIdToWrap) {
          const wrappedNode = deepCloneBlock(node); // Clone to avoid issues if node is already part of state
          newGroupBlock.children = [wrappedNode];
          return newGroupBlock;
        }
        if (node.children) {
          return { ...node, children: wrapRecursively(node.children) };
        }
        return node;
      });
    };

    setBlocks(prevBlocks => wrapRecursively(prevBlocks));
    setSelectedBlockId(newGroupBlock.id); // Select the new group
    toast({ title: "Блок обернут", description: "Выбранный блок был обернут в новую группу." });
  }, [toast]);

  const handleReorderBlock = useCallback((draggedId: string, targetId: string, targetParentId: string | null) => {
    setBlocks(prevBlocks => {
      let draggedBlock: Block | null = null;
      
      // Function to remove block and return it
      const removeBlock = (nodes: Block[], idToRemove: string): { newNodes: Block[], removed: Block | null } => {
        let removedItem: Block | null = null;
        const filteredNodes = nodes.filter(block => {
          if (block.id === idToRemove) {
            removedItem = block;
            return false;
          }
          return true;
        });
        if (removedItem) return { newNodes: filteredNodes, removed: removedItem };

        for (let i = 0; i < nodes.length; i++) {
          if (nodes[i].children) {
            const result = removeBlock(nodes[i].children, idToRemove);
            if (result.removed) {
              const newParentNodes = [...nodes];
              newParentNodes[i] = { ...newParentNodes[i], children: result.newNodes };
              return { newNodes: newParentNodes, removed: result.removed };
            }
          }
        }
        return { newNodes: nodes, removed: null };
      };

      const { newNodes: blocksWithoutDragged, removed: foundDraggedBlock } = removeBlock(prevBlocks, draggedId);
      if (!foundDraggedBlock) return prevBlocks; // Dragged block not found
      draggedBlock = foundDraggedBlock;

      // Function to insert block
      const insertBlock = (nodes: Block[], currentParentId: string | null): Block[] => {
        if (currentParentId === targetParentId) { // Target is a sibling or root
          const targetIndex = nodes.findIndex(b => b.id === targetId);
          if (targetIndex !== -1 && draggedBlock) {
            const newSiblingNodes = [...nodes];
            newSiblingNodes.splice(targetIndex + 1, 0, draggedBlock); // Insert after target
            return newSiblingNodes;
          }
        }
        // Recurse if not at the target parent level
        return nodes.map(node => {
          if (node.children) {
            return { ...node, children: insertBlock(node.children, node.id) };
          }
          return node;
        });
      };
      
      return insertBlock(blocksWithoutDragged, null);
    });
    toast({ title: "Блок перемещен", description: "Порядок блоков обновлен." });
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
                  const canBeExpanded = b.type === BlockType.GROUP || b.type === BlockType.LOOKAROUND || b.type === BlockType.ALTERNATION || b.type === BlockType.CONDITIONAL;
                  return {
                    ...b,
                    id: b.id || generateId(), // Ensure imported blocks have IDs
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
        const canBeExpanded = b.type === BlockType.GROUP || b.type === BlockType.LOOKAROUND || b.type === BlockType.ALTERNATION || b.type === BlockType.CONDITIONAL;
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

      if (isTyping) return; // Don't interfere with text input

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

      if (selectedBlockId && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
        event.preventDefault();
        const { block: currentBlock, parent, indexInParent } = findBlockAndParentRecursive(blocks, selectedBlockId);
        
        if (currentBlock) {
          const siblings = parent ? parent.children : blocks;
          let newIndex = indexInParent;

          if (event.key === 'ArrowUp' && indexInParent > 0) {
            newIndex = indexInParent - 1;
          } else if (event.key === 'ArrowDown' && indexInParent < siblings.length - 1) {
            newIndex = indexInParent + 1;
          }
          
          if (newIndex !== indexInParent && siblings[newIndex]) {
            setSelectedBlockId(siblings[newIndex].id);
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedBlockId, handleDeleteBlock, handleExpandAll, handleCollapseAll, blocks]);


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
              <Card className="m-2 flex-1 flex flex-col shadow-md border-primary/20">
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
                      <Button size="sm" onClick={() => { setParentIdForNewBlock(null); setIsPaletteVisible(true); }}>
                        <Plus size={16} className="mr-1" /> Добавить корневой блок
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-3 flex-1 overflow-hidden">
                  <ScrollArea className="h-full pr-2">
                    {blocks.length === 0 ? (
                      <div className="text-center text-muted-foreground py-10 flex flex-col items-center justify-center h-full">
                        <Layers size={48} className="mb-3 opacity-50" />
                        <p className="font-medium">Начните строить свой regex!</p>
                        <p className="text-sm">Нажмите "Добавить корневой блок" или используйте палитру.</p>
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
                            parentId={null} // Root blocks have null parentId
                            level={0}
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
                <RegexOutputDisplay generatedRegex={generatedRegex} regexFlags={regexFlags} onFlagsChange={setRegexFlags} />
              </div>
              <Tabs defaultValue="testing" className="flex-1 flex flex-col min-h-0">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="testing"><PlayCircle size={16} className="mr-1.5"/>Тестирование</TabsTrigger>
                  <TabsTrigger value="codegen"><Code2 size={16} className="mr-1.5"/>Генерация кода</TabsTrigger>
                  <TabsTrigger value="debug"><Bug size={16} className="mr-1.5"/>Отладка</TabsTrigger>
                </TabsList>
                <TabsContent value="testing" className="mt-2 flex-1 overflow-y-auto p-0.5">
                  <TestArea testText={testText} onTestTextChange={setTestText} matches={matches} generatedRegex={generatedRegex} />
                </TabsContent>
                <TabsContent value="codegen" className="mt-2 flex-1 overflow-y-auto p-0.5">
                  <CodeGenerationPanel generatedRegex={generatedRegex} regexFlags={regexFlags} testText={testText} />
                </TabsContent>
                <TabsContent value="debug" className="mt-2 flex-1 overflow-y-auto p-0.5">
                  <DebugView />
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
    </div>
  );
};

export default RegexVisionWorkspace;

