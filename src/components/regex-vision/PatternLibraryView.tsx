
"use client";
import React, { useState, useEffect } from 'react';
import type { SavedPattern } from './types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Save, Trash2, Download, PlusCircle, Pencil } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';

interface PatternLibraryViewProps {
  currentRegexString: string;
  currentFlags: string;
  currentTestString?: string;
  onApplyPattern: (pattern: SavedPattern) => void;
}

const PatternLibraryView: React.FC<PatternLibraryViewProps> = ({
  currentRegexString,
  currentFlags,
  currentTestString,
  onApplyPattern,
}) => {
  const { toast } = useToast();
  const [savedPatterns, setSavedPatterns] = useState<SavedPattern[]>([]);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [newPatternName, setNewPatternName] = useState('');
  const [newPatternDescription, setNewPatternDescription] = useState('');

  // State for editing
  const [editingPattern, setEditingPattern] = useState<SavedPattern | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormValues, setEditFormValues] = useState<Partial<SavedPattern>>({
    name: '',
    regexString: '',
    flags: '',
    description: '',
    testString: '',
  });

  const LIBRARY_STORAGE_KEY = 'regexVisionPro_library';

  useEffect(() => {
    try {
      const storedPatterns = localStorage.getItem(LIBRARY_STORAGE_KEY);
      if (storedPatterns) {
        setSavedPatterns(JSON.parse(storedPatterns));
      }
    } catch (error) {
      console.error("Error loading patterns from localStorage:", error);
      toast({
        title: "Ошибка загрузки библиотеки",
        description: "Не удалось загрузить сохраненные паттерны.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const savePatternsToLocalStorage = (patterns: SavedPattern[]) => {
    try {
      localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(patterns));
    } catch (error) {
      console.error("Error saving patterns to localStorage:", error);
      toast({
        title: "Ошибка сохранения библиотеки",
        description: "Не удалось сохранить паттерны.",
        variant: "destructive",
      });
    }
  };

  const handleToggleSaveForm = () => {
    if (!showSaveForm) {
      setNewPatternName('');
      setNewPatternDescription('');
    }
    setShowSaveForm(!showSaveForm);
  };

  const handleSavePattern = () => {
    if (!newPatternName.trim()) {
      toast({ title: "Ошибка", description: "Имя паттерна не может быть пустым.", variant: "destructive" });
      return;
    }
    const newPattern: SavedPattern = {
      id: Date.now().toString(),
      name: newPatternName,
      regexString: currentRegexString,
      flags: currentFlags,
      testString: currentTestString || '',
      description: newPatternDescription,
    };
    const updatedPatterns = [...savedPatterns, newPattern];
    setSavedPatterns(updatedPatterns);
    savePatternsToLocalStorage(updatedPatterns);
    toast({ title: "Паттерн сохранен!", description: `"${newPattern.name}" добавлен в библиотеку.` });
    setShowSaveForm(false);
    setNewPatternName('');
    setNewPatternDescription('');
  };

  const handleDeletePattern = (idToDelete: string) => {
    const updatedPatterns = savedPatterns.filter(p => p.id !== idToDelete);
    setSavedPatterns(updatedPatterns);
    savePatternsToLocalStorage(updatedPatterns);
    toast({ title: "Паттерн удален" });
  };

  const handleApplyPatternInternal = (pattern: SavedPattern) => {
    onApplyPattern(pattern);
  };

  const handleStartEdit = (pattern: SavedPattern) => {
    setEditingPattern(pattern);
    setEditFormValues({
      name: pattern.name,
      regexString: pattern.regexString,
      flags: pattern.flags,
      description: pattern.description || '',
      testString: pattern.testString || '',
    });
    setIsEditModalOpen(true);
  };

  const handleEditFormChange = (field: keyof SavedPattern, value: string) => {
    setEditFormValues(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveChangesToPattern = () => {
    if (!editingPattern || !editFormValues.name?.trim()) {
      toast({ title: "Ошибка", description: "Имя паттерна не может быть пустым.", variant: "destructive" });
      return;
    }
    const updatedPatterns = savedPatterns.map(p =>
      p.id === editingPattern.id ? { ...p, ...editFormValues } : p
    );
    setSavedPatterns(updatedPatterns);
    savePatternsToLocalStorage(updatedPatterns);
    toast({ title: "Паттерн обновлен!", description: `Паттерн "${editFormValues.name}" был успешно обновлен.` });
    setIsEditModalOpen(false);
    setEditingPattern(null);
  };

  return (
    <>
      <div className="h-full flex flex-col gap-4 p-1">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Библиотека Паттернов</h3>
          <Button onClick={handleToggleSaveForm} size="sm">
            <PlusCircle size={16} className="mr-2" />
            {showSaveForm ? "Отмена" : "Сохранить текущий Regex"}
          </Button>
        </div>

        {showSaveForm && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Сохранить новый паттерн</CardTitle>
              <CardDescription>Текущее регулярное выражение, флаги и тестовая строка будут сохранены.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label htmlFor="newPatternName" className="text-xs font-medium text-muted-foreground">Имя паттерна</label>
                <Input
                  id="newPatternName"
                  value={newPatternName}
                  onChange={(e) => setNewPatternName(e.target.value)}
                  placeholder="Мой полезный Regex"
                  className="mt-1"
                />
              </div>
              <div>
                <label htmlFor="newPatternDescription" className="text-xs font-medium text-muted-foreground">Описание (необязательно)</label>
                <Textarea
                  id="newPatternDescription"
                  value={newPatternDescription}
                  onChange={(e) => setNewPatternDescription(e.target.value)}
                  placeholder="Этот regex находит..."
                  className="mt-1"
                  rows={2}
                />
              </div>
              <p className="text-xs text-muted-foreground p-2 bg-muted/50 rounded-md">
                  Regex: <code>/{currentRegexString}/{currentFlags}</code> <br/>
                  Тест: <code>{currentTestString?.substring(0,50) || "Нет"}...</code>
              </p>
            </CardContent>
            <CardFooter>
              <Button onClick={handleSavePattern} size="sm">
                <Save size={16} className="mr-2" /> Сохранить паттерн
              </Button>
            </CardFooter>
          </Card>
        )}

        <div className="flex-1 min-h-0">
          {savedPatterns.length === 0 && !showSaveForm ? (
            <div className="text-center text-muted-foreground py-10">
              <p>Ваша библиотека паттернов пуста.</p>
              <p className="text-xs">Сохраните свой первый Regex, чтобы он появился здесь.</p>
            </div>
          ) : (
            <ScrollArea className="h-full pr-2">
              <div className="space-y-3">
                {savedPatterns.map(pattern => (
                  <Card key={pattern.id} className="shadow-sm">
                    <CardHeader className="pb-2 pt-3 px-4">
                      <CardTitle className="text-base flex justify-between items-center">
                        {pattern.name}
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="iconSm" onClick={() => handleStartEdit(pattern)} title="Редактировать паттерн">
                            <Pencil size={14} className="text-blue-600" />
                          </Button>
                          <Button variant="ghost" size="iconSm" onClick={() => handleDeletePattern(pattern.id)} title="Удалить паттерн">
                            <Trash2 size={14} className="text-destructive" />
                          </Button>
                        </div>
                      </CardTitle>
                      <p className="text-xs font-mono text-muted-foreground bg-muted/30 p-1.5 rounded-sm overflow-x-auto">
                          /{pattern.regexString}/{pattern.flags}
                      </p>
                    </CardHeader>
                    {pattern.description && (
                      <CardContent className="py-2 px-4">
                        <p className="text-xs text-muted-foreground whitespace-pre-wrap">{pattern.description}</p>
                      </CardContent>
                    )}
                    <CardFooter className="pt-2 pb-3 px-4">
                      <Button variant="outline" size="sm" onClick={() => handleApplyPatternInternal(pattern)}>
                          <Download size={14} className="mr-2" /> Применить
                        </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>

      {isEditModalOpen && editingPattern && (
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Редактировать паттерн: {editingPattern.name}</DialogTitle>
              <DialogDescription>
                Измените детали вашего сохраненного регулярного выражения.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="editName" className="text-right">Имя</Label>
                <Input id="editName" value={editFormValues.name || ''} onChange={(e) => handleEditFormChange('name', e.target.value)} className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="editRegexString" className="text-right">Regex</Label>
                <Input id="editRegexString" value={editFormValues.regexString || ''} onChange={(e) => handleEditFormChange('regexString', e.target.value)} className="col-span-3 font-mono" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="editFlags" className="text-right">Флаги</Label>
                <Input id="editFlags" value={editFormValues.flags || ''} onChange={(e) => handleEditFormChange('flags', e.target.value.replace(/[^gimsuy]/g, ''))} className="col-span-3 font-mono" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="editDescription" className="text-right">Описание</Label>
                <Textarea id="editDescription" value={editFormValues.description || ''} onChange={(e) => handleEditFormChange('description', e.target.value)} className="col-span-3" rows={2}/>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="editTestString" className="text-right">Тест. строка</Label>
                <Textarea id="editTestString" value={editFormValues.testString || ''} onChange={(e) => handleEditFormChange('testString', e.target.value)} className="col-span-3 font-mono" rows={3}/>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Отмена</Button>
              </DialogClose>
              <Button onClick={handleSaveChangesToPattern}>Сохранить изменения</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default PatternLibraryView;

    