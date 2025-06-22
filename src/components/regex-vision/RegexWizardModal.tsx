
"use client";
import React, { useState, useCallback, useEffect } from 'react';
import type { Block, QuantifierSettings, CharacterClassSettings, GroupSettings, LiteralSettings, AnchorSettings, BackreferenceSettings, LookaroundSettings } from './types';
import { BlockType } from './types';
import { BLOCK_CONFIGS } from './constants'; 
import { generateRegexFromNaturalLanguage, type NaturalLanguageRegexOutput } from '@/ai/flows/natural-language-regex-flow'; // Ensure type is imported
import { useToast } from "@/hooks/use-toast";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card } from "@/components/ui/card";
import { Lightbulb, CheckSquare, TextCursorInput, Replace, Eraser, Split, Wand2, Phone, AtSign, Globe, KeyRound, Shuffle, MessageSquareQuote, CaseSensitive, SearchCheck, Route, Workflow, FileText, CalendarClock, BadgeCheck, AlignLeft, Calculator, Sparkles, Bot, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { generateId, createAnchor, createLiteral, createCharClass, createQuantifier, createSequenceGroup, createAlternation, createLookaround, createBackreference, generateBlocksForEmail, generateBlocksForURL, generateBlocksForIPv4, generateBlocksForIPv6, generateBlocksForDuplicateWords, generateBlocksForMultipleSpaces, generateBlocksForTabsToSpaces, generateBlocksForNumbers, processAiBlocks } from './utils';


interface RegexWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (blocks: Block[], parentId?: string | null, exampleTestText?: string) => void; // Added exampleTestText
  initialParentId: string | null;
}

type WizardStepId =
  | 'start'
  | 'ai_natural_language_input'
  | 'validation_type_choice'
  | 'validation_basicPatterns_what'
  | 'validation_basicPatterns_length'
  | 'validation_basicPatterns_length_specify'
  | 'validation_standardFormats_what'
  | 'validation_standardFormats_url_protocol'
  | 'validation_standardFormats_ip_type'
  // Disabled steps below for brevity, can be re-enabled
  | 'extraction_whatToExtract'
  | 'replacement_whatToReplace'
  | 'final_preview';

interface WizardFormData {
  naturalLanguageQuery?: string;
  
  mainCategory?: 'validation' | 'extraction' | 'replacement' | 'splitting' | 'ai_assisted';

  validationTypeChoice?: 'basic' | 'standard' | 'datetime';

  basicPattern_contains_digits?: boolean;
  basicPattern_contains_letters_az?: boolean;
  basicPattern_contains_letters_AZ?: boolean;
  basicPattern_contains_space?: boolean;
  basicPattern_contains_otherChars?: string;
  basicPattern_restrictLength?: 'no' | 'yes';
  basicPattern_minLength?: number;
  basicPattern_maxLength?: number;

  standardFormatChoice?: 'email' | 'url' | 'phone' | 'ip' | 'password';
  url_requireProtocol?: 'yes' | 'no';
  ip_type?: 'ipv4' | 'ipv6';
  
  extractionChoice?: 'emails' | 'urls' | 'numbers' | 'duplicateWords';
  
  replacementChoice?: 'multipleSpaces' | 'tabsToSpaces';
}

const wizardConfig: Record<WizardStepId, any> = {
  start: {
    title: "Мастер Regex: С чего начнем?",
    description: "Выберите общую задачу. Мастер поможет вам уточнить детали на следующих шагах.",
    type: 'card_choice',
    options: [
      { id: 'validation', label: "Проверить/Валидировать текст", description: "Соответствует ли строка формату (email, IP, и т.д.)?", icon: SearchCheck },
      { id: 'extraction', label: "Найти/Извлечь данные", description: "Найти в тексте все email, URL, числа и т.д.", icon: FileText },
      { id: 'replacement', label: "Заменить/Трансформировать", description: "Заменить несколько пробелов одним, табуляцию и т.д.", icon: Replace },
      { id: 'ai_assisted', label: "Помощь AI (свой запрос)", description: "Опишите любую другую задачу на естественном языке.", icon: Sparkles },
    ],
    next: (choice: string) => {
      if (choice === 'validation') return 'validation_type_choice';
      if (choice === 'extraction') return 'extraction_whatToExtract';
      if (choice === 'replacement') return 'replacement_whatToReplace';
      if (choice === 'ai_assisted') return 'ai_natural_language_input';
      return 'start';
    }
  },
  ai_natural_language_input: {
    title: "AI Помощник: Опишите вашу задачу",
    description: "Например: 'email, но только с доменов .com или .org', 'найти все UUID версии 4', 'извлечь номера телефонов в формате +7 XXX XXX XX XX'.",
    type: 'inputs',
    inputs: [
        { id: 'naturalLanguageQuery', label: "Ваш запрос:", inputType: 'textarea', defaultValue: '', placeholder: "Я хочу найти..." },
    ],
    nextStep: 'final_preview', 
    autoFocusInputId: 'naturalLanguageQuery'
  },
  validation_type_choice: {
    title: "Валидация: Какой тип проверки вам нужен?",
    type: 'radio',
    options: [
      { id: 'basic', label: "Простые шаблоны (цифры, буквы, длина и т.д.)", icon: FileText },
      { id: 'standard', label: "Стандартные форматы (Email, URL, IP)", icon: BadgeCheck },
      { id: 'datetime', label: "Дата и время", icon: CalendarClock, disabled: true },
    ],
    next: (choice: string) => {
      if (choice === 'basic') return 'validation_basicPatterns_what';
      if (choice === 'standard') return 'validation_standardFormats_what';
      return 'validation_type_choice';
    }
  },
  validation_basicPatterns_what: {
    title: "Проверка простых шаблонов: Что должно быть в строке?",
    type: 'checkbox_with_input',
    checkboxes: [
      { id: 'basicPattern_contains_digits', label: "Цифры (0-9)" },
      { id: 'basicPattern_contains_letters_az', label: "Буквы (a-z)" },
      { id: 'basicPattern_contains_letters_AZ', label: "Большие буквы (A-Z)" },
      { id: 'basicPattern_contains_space', label: "Пробелы" },
    ],
    conditionalInput: {
        checkboxId: 'basicPattern_enable_otherChars',
        checkboxLabel: 'Другие символы (укажите):',
        inputId: 'basicPattern_contains_otherChars',
        inputPlaceholder: 'например, _-!',
        inputLabel: 'Разрешенные другие символы:'
    },
    nextStep: 'validation_basicPatterns_length'
  },
  validation_basicPatterns_length: {
    title: "Проверка простых шаблонов: Нужно ли ограничить длину строки?",
    type: 'radio',
    options: [
      { id: 'no', label: "Нет, любая длина" },
      { id: 'yes', label: "Да, указать минимум и максимум" },
    ],
    next: (choice: string) => {
      if (choice === 'yes') return 'validation_basicPatterns_length_specify';
      return 'final_preview';
    }
  },
  validation_basicPatterns_length_specify: {
    title: "Проверка простых шаблонов: Укажите длину строки",
    type: 'inputs',
    inputs: [
      { id: 'basicPattern_minLength', label: "Минимальное число символов:", inputType: 'number', defaultValue: 1 },
      { id: 'basicPattern_maxLength', label: "Максимальное число символов (необязательно):", inputType: 'number' },
    ],
    nextStep: 'final_preview'
  },
  validation_standardFormats_what: {
    title: "Проверка стандартных форматов: Что вы хотите проверить?",
    type: 'radio',
    options: [
      { id: 'email', label: "Email (электронная почта)", icon: AtSign },
      { id: 'url', label: "URL (веб-адрес)", icon: Globe },
      { id: 'phone', label: "Телефон", icon: Phone, disabled: true },
      { id: 'ip', label: "IP-адрес (IPv4/IPv6)", icon: Route },
      { id: 'password', label: "Пароль", icon: KeyRound, disabled: true },
    ],
    next: (choice: string) => {
      if (choice === 'email') return 'final_preview';
      if (choice === 'url') return 'validation_standardFormats_url_protocol';
      if (choice === 'ip') return 'validation_standardFormats_ip_type';
      return 'validation_standardFormats_what';
    }
  },
  validation_standardFormats_url_protocol: {
    title: "Проверка URL: Требуется протокол http(s)?",
    type: 'radio',
    options: [
      { id: 'yes', label: "Да, http или https обязателен" },
      { id: 'no', label: "Нет, протокол не обязателен" },
    ],
    nextStep: 'final_preview'
  },
  validation_standardFormats_ip_type: {
    title: "Проверка IP-адреса: Какой тип IP-адреса?",
    type: 'radio',
    options: [
        { id: 'ipv4', label: "IPv4 (например, 192.168.0.1)" },
        { id: 'ipv6', label: "IPv6 (например, 2001:0db8:...)"},
    ],
    next: () => 'final_preview'
  },
  extraction_whatToExtract: {
    title: "Извлечение/Поиск: Что нужно найти в тексте?",
    type: 'radio',
    options: [
      { id: 'emails', label: "Все email-адреса", icon: AtSign },
      { id: 'urls', label: "Все URL-адреса", icon: Globe },
      { id: 'numbers', label: "Все числа (целые/десятичные)", icon: Calculator },
      { id: 'quotedText', label: "Текст в кавычках", icon: MessageSquareQuote, disabled: true },
      { id: 'specificWord', label: "Слово/фразу (ввести)", icon: TextCursorInput, disabled: true },
      { id: 'duplicateWords', label: "Повторяющиеся слова", icon: Shuffle },
    ],
    next: () => 'final_preview'
  },
  replacement_whatToReplace: {
    title: "Замена/Трансформация: Что нужно заменить?",
    type: 'radio',
    options: [
        { id: 'multipleSpaces', label: "Несколько пробелов -> один", icon: Eraser },
        { id: 'tabsToSpaces', label: "Табуляция -> пробелы", icon: AlignLeft },
        { id: 'removeHtml', label: "Удалить HTML-теги", icon: Eraser, disabled: true },
    ],
    next: () => 'final_preview'
  },
  final_preview: {
    title: "Результат Помощника",
    type: 'preview',
  }
};

const escapeCharsForCharClass = (str: string): string => {
  // Inside a character set [], only ], \, ^, and - need escaping.
  return str.replace(/[\\\]\-\^]/g, '\\$&');
};


const RegexWizardModal: React.FC<RegexWizardModalProps> = ({ isOpen, onClose, onComplete, initialParentId }) => {
  const [currentStepId, setCurrentStepId] = useState<WizardStepId>('start');
  const [formData, setFormData] = useState<WizardFormData>({});
  const [generatedBlocks, setGeneratedBlocks] = useState<Block[]>([]);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [aiExampleTestText, setAiExampleTestText] = useState<string | null>(null); // New state for AI example text
  const [replacementString, setReplacementString] = useState<string | null>(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
        setCurrentStepId('start');
        setFormData({});
        setGeneratedBlocks([]);
        setAiExplanation(null);
        setAiExampleTestText(null);
        setReplacementString(null);
        setIsLoadingAI(false);
    }
  }, [isOpen]);

  const currentStepConfig = wizardConfig[currentStepId as keyof typeof wizardConfig];

  const handleRadioChange = (value: string) => {
    const newFormData : Partial<WizardFormData> = { ...formData };
    const keysToKeepOnCategoryChange: (keyof WizardFormData)[] = [];
    const keysToKeepOnSubCategoryChange: (keyof WizardFormData)[] = ['mainCategory'];

    const resetSubsequentFields = (keysToKeep: (keyof WizardFormData)[]) => {
        const currentMainCategory = newFormData.mainCategory;
        Object.keys(newFormData).forEach(keyStr => {
            const key = keyStr as keyof WizardFormData;
            if (!keysToKeep.includes(key)) {
                 delete (newFormData as any)[key];
            }
        });
        if (keysToKeep.includes('mainCategory') && currentMainCategory) newFormData.mainCategory = currentMainCategory;
    };

    if (currentStepId === 'start') {
        resetSubsequentFields(keysToKeepOnCategoryChange);
        newFormData.mainCategory = value as WizardFormData['mainCategory'];
    } else if (currentStepId === 'validation_type_choice') {
        resetSubsequentFields(keysToKeepOnSubCategoryChange);
        newFormData.validationTypeChoice = value as WizardFormData['validationTypeChoice'];
    } else if (currentStepId === 'validation_standardFormats_what') {
        resetSubsequentFields(['mainCategory','validationTypeChoice']);
        newFormData.standardFormatChoice = value as WizardFormData['standardFormatChoice'];
    } else if (currentStepId === 'extraction_whatToExtract') {
        resetSubsequentFields(keysToKeepOnSubCategoryChange);
        newFormData.extractionChoice = value as WizardFormData['extractionChoice'];
    } else if (currentStepId === 'replacement_whatToReplace') {
        resetSubsequentFields(keysToKeepOnSubCategoryChange);
        newFormData.replacementChoice = value as WizardFormData['replacementChoice'];
    } else if (currentStepId === 'validation_standardFormats_ip_type') {
        resetSubsequentFields(['mainCategory', 'validationTypeChoice', 'standardFormatChoice']);
        newFormData.ip_type = value as WizardFormData['ip_type'];
    }
     else {
       (newFormData as any)[currentStepId as keyof WizardFormData] = value as any;
    }

    if (currentStepId === 'validation_standardFormats_url_protocol') newFormData.url_requireProtocol = value as WizardFormData['url_requireProtocol'];
    else if (currentStepId === 'validation_basicPatterns_length') newFormData.basicPattern_restrictLength = value as WizardFormData['basicPattern_restrictLength'];
    
    setFormData(newFormData as WizardFormData);
  };

  const getRadioValue = () => {
    if (currentStepId === 'start') return formData.mainCategory;
    if (currentStepId === 'validation_type_choice') return formData.validationTypeChoice;
    if (currentStepId === 'validation_standardFormats_what') return formData.standardFormatChoice;
    if (currentStepId === 'validation_standardFormats_url_protocol') return formData.url_requireProtocol;
    if (currentStepId === 'validation_standardFormats_ip_type') return formData.ip_type;
    if (currentStepId === 'validation_basicPatterns_length') return formData.basicPattern_restrictLength;
    if (currentStepId === 'extraction_whatToExtract') return formData.extractionChoice;
    if (currentStepId === 'replacement_whatToReplace') return formData.replacementChoice;
    return formData[currentStepId as keyof WizardFormData] as string || '';
  }

  const handleCheckboxChange = (checkboxId: string, checked: boolean) => {
    setFormData(prev => ({ ...prev, [checkboxId]: checked }));
  };

  const handleInputChange = (inputId: string, value: string | number) => {
     setFormData(prev => ({ ...prev, [inputId]: value }));
  };

  const generateBlocksFromFormData = useCallback((): Block[] => {
    if(formData.mainCategory === 'validation'){
        if(formData.validationTypeChoice === 'basic'){
             return generateBlocksForBasicPattern();
        } else if (formData.validationTypeChoice === 'standard') {
            if(formData.standardFormatChoice === 'email') return generateBlocksForEmail(false);
            if (formData.standardFormatChoice === 'url') return generateBlocksForURL(false, formData.url_requireProtocol === 'yes');
            if (formData.standardFormatChoice === 'ip') {
                if (formData.ip_type === 'ipv4') return generateBlocksForIPv4();
                if (formData.ip_type === 'ipv6') return generateBlocksForIPv6();
                return [];
            }
            return [];
        }
         return [];
    } else if (formData.mainCategory === 'extraction') {
        if (formData.extractionChoice === 'emails') return generateBlocksForEmail(true);
        if (formData.extractionChoice === 'urls') return generateBlocksForURL(true, false);
        if (formData.extractionChoice === 'numbers') return generateBlocksForNumbers();
        if (formData.extractionChoice === 'duplicateWords') return generateBlocksForDuplicateWords();
        return [];
    } else if (formData.mainCategory === 'replacement') {
        if (formData.replacementChoice === 'multipleSpaces') {
             setReplacementString(" (один пробел)"); 
             return generateBlocksForMultipleSpaces();
        } 
        if (formData.replacementChoice === 'tabsToSpaces') {
             setReplacementString(" (один пробел)"); 
             return generateBlocksForTabsToSpaces();
        } 
        return [];
    }
    return [];
  }, [formData]);


  const generateBlocksForBasicPattern = useCallback((): Block[] => {
    const blocks: Block[] = [];
    let patternChars = '';
    if (formData.basicPattern_contains_digits) patternChars += '\\d';
    if (formData.basicPattern_contains_letters_az) patternChars += 'a-z';
    if (formData.basicPattern_contains_letters_AZ) patternChars += 'A-Z';
    if (formData.basicPattern_contains_space) patternChars += '\\s';
    if (formData.basicPattern_contains_otherChars) {
      patternChars += escapeCharsForCharClass(formData.basicPattern_contains_otherChars);
    }

    if (!patternChars) return [];

    blocks.push(createAnchor('^'));
    const charClassBlock: Block = createCharClass(patternChars);
    let quantifierType: QuantifierSettings['type'] = '+';
    let min: number | undefined = undefined;
    let max: number | null | undefined = undefined;

    if (formData.basicPattern_restrictLength === 'yes') {
      min = typeof formData.basicPattern_minLength === 'number' ? formData.basicPattern_minLength : 1;
      max = typeof formData.basicPattern_maxLength === 'number' && formData.basicPattern_maxLength > 0 ? formData.basicPattern_maxLength : null;

      if (min !== undefined && max === null && min === 1) quantifierType = '+';
      else if (min !== undefined && max === null) quantifierType = '{n,}';
      else if (min !== undefined && max !== undefined && min === max) quantifierType = '{n}';
      else if (min !== undefined && max !== undefined) quantifierType = '{n,m}';
    }
    blocks.push(charClassBlock);
    blocks.push(createQuantifier(quantifierType, min, max));
    blocks.push(createAnchor('$'));
    return blocks;
  }, [formData]);


  const handleNext = async () => {
    if (!currentStepConfig) return;
    setReplacementString(null);
    setGeneratedBlocks([]);
    setAiExplanation(null);
    setAiExampleTestText(null); // Clear previous AI example text

    if (currentStepId === 'final_preview') {
        if (generatedBlocks.length > 0 || (formData.mainCategory === 'replacement' && replacementString)) {
          onComplete(generatedBlocks, initialParentId, aiExampleTestText || undefined); // Pass AI example text
        }
        return;
    }

    let nextStepTargetId: WizardStepId | undefined = undefined;
    let choice: string | undefined = getRadioValue();

    if (currentStepId === 'ai_natural_language_input' && formData.naturalLanguageQuery) {
        setIsLoadingAI(true);
        try {
            const aiResult: NaturalLanguageRegexOutput = await generateRegexFromNaturalLanguage({ query: formData.naturalLanguageQuery });
            
            if (aiResult.parsedBlocks && aiResult.parsedBlocks.length > 0) {
                const processed = processAiBlocks(aiResult.parsedBlocks);
                setGeneratedBlocks(processed);
                 toast({
                    title: "AI Сгенерировал Regex и Блоки!",
                    description: "Проверьте предложенные блоки.",
                });
            } else if (aiResult.regex) {
                setGeneratedBlocks([createLiteral(aiResult.regex, false)]); 
                 toast({
                    title: "AI Сгенерировал Regex",
                    description: "AI не смог разобрать regex на блоки, но предоставил строку.",
                });
            } else {
                 setGeneratedBlocks([createLiteral(".*", false)]);
                 toast({
                    title: "AI Генерация",
                    description: "AI не смог сгенерировать специфический Regex.",
                    variant: "default",
                });
            }
            setAiExplanation(aiResult.explanation || "Объяснение не предоставлено.");
            setAiExampleTestText(aiResult.exampleTestText || null); // Store AI example text

        } catch (error) {
            console.error("AI Regex Generation Error:", error);
            setGeneratedBlocks([createLiteral("Ошибка AI :(", false)]);
            setAiExplanation("Произошла ошибка при обращении к AI сервису.");
            setAiExampleTestText("Не удалось загрузить пример текста от AI.");
            toast({
                title: "Ошибка AI",
                description: "Не удалось связаться с AI сервисом.",
                variant: "destructive",
            });
        } finally {
            setIsLoadingAI(false);
        }
        nextStepTargetId = 'final_preview';

    } else if ('next' in currentStepConfig && typeof currentStepConfig.next === 'function') {
      if (choice || currentStepConfig.type !== 'radio' && currentStepConfig.type !== 'card_choice' && currentStepConfig.type !== 'card_choice_single_ai' && currentStepConfig.type !== 'radio_with_conditional_input' ) { 
        nextStepTargetId = currentStepConfig.next(choice) as WizardStepId;
      } else if (!choice && (currentStepConfig.type === 'radio' || currentStepConfig.type === 'card_choice' || currentStepConfig.type === 'card_choice_single_ai' || currentStepConfig.type === 'radio_with_conditional_input')) {
          console.warn("Wizard: No choice made on step", currentStepId);
          toast({ title: "Выбор не сделан", description: "Пожалуйста, выберите опцию.", variant: "destructive"});
          return; 
      }
    } else if ('nextStep' in currentStepConfig) {
      nextStepTargetId = currentStepConfig.nextStep as WizardStepId;
    }

    if (nextStepTargetId === 'final_preview' && currentStepId !== 'ai_natural_language_input') {
        setGeneratedBlocks(generateBlocksFromFormData());
    }

    if (nextStepTargetId) {
      setCurrentStepId(nextStepTargetId);
    } else if (currentStepId !== 'ai_natural_language_input') { 
      console.warn("Wizard: No next step defined for", currentStepId, "with choice", choice);
    }
  };

  const handleBack = () => {
    let prevStep: WizardStepId | null = null;
    setGeneratedBlocks([]);
    setAiExplanation(null);
    setAiExampleTestText(null);
    setReplacementString(null);
    setIsLoadingAI(false);

    if (currentStepId === 'ai_natural_language_input') {
        prevStep = 'start';
    } else if (currentStepId === 'final_preview') {
        if (formData.mainCategory === 'ai_assisted') prevStep = 'ai_natural_language_input';
        else if (formData.mainCategory === 'validation') {
            if (formData.validationTypeChoice === 'basic') {
                prevStep = formData.basicPattern_restrictLength === 'yes' ? 'validation_basicPatterns_length_specify' : 'validation_basicPatterns_length';
            } else if (formData.validationTypeChoice === 'standard') {
                if (formData.standardFormatChoice === 'email') prevStep = 'validation_standardFormats_what';
                else if (formData.standardFormatChoice === 'url') prevStep = 'validation_standardFormats_url_protocol';
                else if (formData.standardFormatChoice === 'ip') prevStep = 'validation_standardFormats_ip_type';
                else prevStep = 'validation_standardFormats_what';
            } else prevStep = 'validation_type_choice';
        } else if (formData.mainCategory === 'extraction') {
             prevStep = 'extraction_whatToExtract';
        } else if (formData.mainCategory === 'replacement') {
            prevStep = 'replacement_whatToReplace';
        } else prevStep = 'start';
    } else {
        const stepKeys = Object.keys(wizardConfig) as WizardStepId[];
        const currentIndex = stepKeys.indexOf(currentStepId);
        if (currentStepId === 'validation_type_choice' || currentStepId === 'extraction_whatToExtract' || currentStepId === 'replacement_whatToReplace') {
            prevStep = 'start';
        } else if (currentStepId === 'validation_basicPatterns_what') prevStep = 'validation_type_choice';
        else if (currentStepId === 'validation_basicPatterns_length') prevStep = 'validation_basicPatterns_what';
        else if (currentStepId === 'validation_basicPatterns_length_specify') prevStep = 'validation_basicPatterns_length';
        else if (currentStepId === 'validation_standardFormats_what') prevStep = 'validation_type_choice';
        else if (currentStepId === 'validation_standardFormats_url_protocol') prevStep = 'validation_standardFormats_what';
        else if (currentStepId === 'validation_standardFormats_ip_type') prevStep = 'validation_standardFormats_what';
        else prevStep = 'start';
    }

    if (prevStep) setCurrentStepId(prevStep);
    else setCurrentStepId('start');
  };

  const resetWizardAndClose = () => {
    setCurrentStepId('start');
    setFormData({});
    setGeneratedBlocks([]);
    setAiExplanation(null);
    setAiExampleTestText(null);
    setReplacementString(null);
    setIsLoadingAI(false);
    onClose();
  }

  const isNextDisabled = () => {
    const currentChoice = getRadioValue();
    if (!currentStepConfig) return true;
    if (isLoadingAI) return true;
    
    if ((currentStepConfig.type === 'radio' || currentStepConfig.type === 'card_choice' || currentStepConfig.type === 'card_choice_single_ai') && !currentChoice) {
      if (currentStepConfig.options?.every((opt:any) => opt.disabled)) return false;
      return true;
    }
    if (currentStepConfig.type === 'radio' && currentStepConfig.options) {
        const selectedOption = currentStepConfig.options.find((opt:any) => opt.id === currentChoice);
        if (selectedOption?.disabled) return true;
    }

    if (currentStepId === 'ai_natural_language_input' && !formData.naturalLanguageQuery?.trim()) {
        return true;
    }

    if (currentStepId === 'final_preview') {
        if (generatedBlocks.length === 0 && !(formData.mainCategory === 'replacement' && replacementString)) {
            return true;
        }
    }
    return false;
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) resetWizardAndClose(); }}>
      <DialogContent className="sm:max-w-xl md:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{currentStepConfig?.title || "AI Помощник"}</DialogTitle>
          {currentStepConfig?.description && (
            <DialogDescription className="mt-1">{currentStepConfig.description}</DialogDescription>
          )}
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4 -mr-4 py-2">
          <div className="space-y-6">
            {currentStepConfig?.type === 'card_choice_single_ai' && currentStepConfig.options && (
                <div className="space-y-4">
                    {currentStepConfig.options.map((opt: any) => (
                        <Button
                            key={opt.id}
                            variant="outline"
                            className={cn(
                                "flex-col h-auto p-4 items-start text-left space-y-1.5 transition-all w-full",
                                formData.mainCategory === opt.id && "ring-2 ring-primary bg-accent text-accent-foreground",
                                opt.disabled && "opacity-50 cursor-not-allowed"
                            )}
                            onClick={() => !opt.disabled && handleRadioChange(opt.id)}
                            disabled={opt.disabled}
                        >
                            <div className="flex items-center gap-2">
                                <opt.icon size={22} className="text-primary"/>
                                <span className="font-semibold text-base">{opt.label}</span>
                            </div>
                            <p className="text-xs text-muted-foreground pl-1">{opt.description}</p>
                             {opt.disabled && <span className="text-xs text-amber-600 dark:text-amber-400 mt-1">(скоро)</span>}
                        </Button>
                    ))}
                </div>
            )}
            {currentStepConfig?.type === 'card_choice' && currentStepConfig.options && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {currentStepConfig.options.map((opt: any) => (
                        <Button
                            key={opt.id}
                            variant="outline"
                            className={cn(
                                "flex-col h-auto p-4 items-start text-left space-y-1 transition-all",
                                formData.mainCategory === opt.id && "ring-2 ring-primary bg-accent text-accent-foreground",
                                opt.disabled && "opacity-50 cursor-not-allowed"
                            )}
                            onClick={() => !opt.disabled && handleRadioChange(opt.id)}
                            disabled={opt.disabled}
                        >
                            <opt.icon size={24} className="mb-1 text-primary"/>
                            <span className="font-semibold text-base">{opt.label}</span>
                            <p className="text-xs text-muted-foreground">{opt.description}</p>
                             {opt.disabled && <span className="text-xs text-amber-600 dark:text-amber-400 mt-1">(скоро)</span>}
                        </Button>
                    ))}
                </div>
            )}
            {currentStepConfig?.type === 'radio' && currentStepConfig.options && (
              <RadioGroup
                value={getRadioValue()}
                onValueChange={handleRadioChange}
              >
                {currentStepConfig.options.map((opt:any) => (
                  <div key={opt.id} className="flex items-center space-x-2 p-2 border rounded-md hover:bg-muted/50 has-[:checked]:bg-accent/20 has-[:checked]:border-accent data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed" data-disabled={opt.disabled ? "true" : undefined}>
                    <RadioGroupItem value={opt.id} id={`${currentStepId}-${opt.id}`} disabled={opt.disabled}/>
                    <Label htmlFor={`${currentStepId}-${opt.id}`} className={`flex-1 py-1 text-sm ${opt.disabled ? 'cursor-not-allowed text-muted-foreground' : 'cursor-pointer'}`}>
                      {opt.icon && <opt.icon className="inline-block mr-2 h-4 w-4 text-muted-foreground" />}
                      {opt.label}
                      {opt.disabled && <span className="text-xs text-muted-foreground ml-2">(скоро)</span>}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            )}

            {currentStepConfig?.type === 'checkbox_with_input' && currentStepConfig.checkboxes && currentStepConfig.conditionalInput && (
                <div className="space-y-3">
                    {currentStepConfig.checkboxes.map((cb: any) => (
                    <div key={cb.id} className="flex items-center space-x-3 p-2 border rounded-md hover:bg-muted/50">
                        <Checkbox
                        id={`${currentStepId}-${cb.id}`}
                        checked={!!formData[cb.id as keyof WizardFormData]}
                        onCheckedChange={(checked) => handleCheckboxChange(cb.id, !!checked)}
                        />
                        <Label htmlFor={`${currentStepId}-${cb.id}`} className="flex-1 cursor-pointer text-sm font-normal">
                        {cb.label}
                        </Label>
                    </div>
                    ))}
                    <div className="flex items-center space-x-3 p-2 border rounded-md">
                        <Checkbox
                            id={`${currentStepId}-${currentStepConfig.conditionalInput.checkboxId}-enable`}
                            checked={formData[currentStepConfig.conditionalInput.inputId as keyof WizardFormData] !== undefined}
                            onCheckedChange={(checked) => {
                                const inputKey = currentStepConfig.conditionalInput!.inputId as keyof WizardFormData;
                                if (checked) {
                                    handleInputChange(inputKey, '');
                                } else {
                                    setFormData(prev => {
                                        const newState = {...prev};
                                        delete newState[inputKey];
                                        return newState;
                                    });
                                }
                            }}
                        />
                        <Label htmlFor={`${currentStepId}-${currentStepConfig.conditionalInput.checkboxId}-enable`} className="text-sm font-normal cursor-pointer">
                            {currentStepConfig.conditionalInput.checkboxLabel}
                        </Label>
                        {formData[currentStepConfig.conditionalInput.inputId as keyof WizardFormData] !== undefined && (
                            <Input
                                id={`${currentStepId}-${currentStepConfig.conditionalInput.inputId}`}
                                value={formData[currentStepConfig.conditionalInput.inputId as keyof WizardFormData] as string || ''}
                                onChange={(e) => handleInputChange(currentStepConfig.conditionalInput!.inputId, e.target.value)}
                                className="h-8 flex-1"
                                placeholder={currentStepConfig.conditionalInput.inputPlaceholder}
                            />
                        )}
                    </div>
                </div>
            )}

            {currentStepConfig?.type === 'inputs' && currentStepConfig.inputs && (
              <div className="space-y-4">
                {currentStepConfig.inputs.map((input: any) => (
                  <div key={input.id}>
                    <Label htmlFor={`${currentStepId}-${input.id}`} className="text-sm font-medium">
                      {input.label}
                    </Label>
                    {input.inputType === 'textarea' ? (
                        <Textarea
                            id={`${currentStepId}-${input.id}`}
                            value={formData[input.id as keyof WizardFormData] as string || (input.defaultValue !== undefined ? String(input.defaultValue) : '')}
                            onChange={(e) => handleInputChange(input.id, e.target.value)}
                            className="mt-1 h-24"
                            placeholder={input.placeholder}
                            autoFocus={currentStepConfig.autoFocusInputId === input.id}
                        />
                    ) : (
                        <Input
                        id={`${currentStepId}-${input.id}`}
                        type={input.inputType}
                        value={formData[input.id as keyof WizardFormData] as string || (input.defaultValue !== undefined ? String(input.defaultValue) : '')}
                        onChange={(e) => handleInputChange(input.id, input.inputType === 'number' ? parseInt(e.target.value) || 0 : e.target.value)}
                        className="mt-1 h-9"
                        min={input.inputType === 'number' ? "0" : undefined}
                        placeholder={input.placeholder}
                        autoFocus={currentStepConfig.autoFocusInputId === input.id}
                        />
                    )}
                  </div>
                ))}
              </div>
            )}


            {currentStepId === 'final_preview' && (
                <div className="space-y-3">
                    {isLoadingAI && (
                        <div className="flex flex-col items-center justify-center p-4 text-muted-foreground">
                           <Loader2 size={32} className="animate-spin text-primary mb-2" />
                           <p>AI генерирует выражение...</p>
                        </div>
                    )}
                    {!isLoadingAI && (
                        <>
                           <Label className="text-sm font-medium">
                             {formData.mainCategory === 'ai_assisted' ? "Предложение от AI:" : "Сгенерированные блоки Regex:"}
                           </Label>
                            {generatedBlocks.length > 0 ? (
                                <Card className="p-3 bg-muted/50 max-h-60 overflow-y-auto">
                                    <div className="text-xs font-mono whitespace-pre-wrap space-y-1">
                                        {generatedBlocks.map(b => {
                                            let display = `${BLOCK_CONFIGS[b.type]?.name || b.type}`;
                                            if (b.type === BlockType.LITERAL) {
                                                if (formData.mainCategory === 'ai_assisted' && generatedBlocks.length === 1) {
                                                    display = `Regex: /${(b.settings as LiteralSettings).text}/`;
                                                } else {
                                                    display += `: "${(b.settings as LiteralSettings).text}"`;
                                                }
                                            }
                                            else if (b.type === BlockType.CHARACTER_CLASS) display += `: [${(b.settings as CharacterClassSettings).negated ? '^' : ''}${(b.settings as CharacterClassSettings).pattern}]`;
                                            else if (b.type === BlockType.QUANTIFIER) {
                                                const qs = b.settings as QuantifierSettings;
                                                display += `: ${qs.type}`;
                                                if (qs.min !== undefined) display += ` (min: ${qs.min}`;
                                                if (qs.max !== undefined && qs.max !== null) display += `, max: ${qs.max}`;
                                                if (qs.min !== undefined) display += `)`;
                                                if (qs.mode) display += `, ${qs.mode}`;
                                            }
                                            else if (b.type === BlockType.ANCHOR) display += `: ${(b.settings as AnchorSettings).type}`;
                                            else if (b.type === BlockType.GROUP) {
                                            display += `: (${(b.settings as GroupSettings).type || 'capturing'})`;
                                            if((b.settings as GroupSettings).name) display += ` ?<${(b.settings as GroupSettings).name}>`;
                                            }
                                            else if (b.type === BlockType.ALTERNATION) display += `: ( | )`; 
                                            else if (b.type === BlockType.LOOKAROUND) display += `: (${(b.settings as LookaroundSettings).type})`;
                                            else if (b.type === BlockType.BACKREFERENCE) display += `: \\${(b.settings as BackreferenceSettings).ref}`;

                                            const renderChildrenPreview = (children: Block[], level: number): string => {
                                              return children.map(child => {
                                                let childDisplay = `${'  '.repeat(level)}- ${BLOCK_CONFIGS[child.type]?.name || child.type}`;
                                                if (child.type === BlockType.LITERAL) childDisplay += `: "${(child.settings as LiteralSettings).text}"`;
                                                else if (child.type === BlockType.CHARACTER_CLASS) childDisplay += `: [${(child.settings as CharacterClassSettings).negated ? '^' : ''}${(child.settings as CharacterClassSettings).pattern}]`;
                                                else if (child.type === BlockType.QUANTIFIER) {  }
                                                else if (child.type === BlockType.ANCHOR) childDisplay += `: ${(child.settings as AnchorSettings).type}`;
                                                else if (child.type === BlockType.GROUP) { childDisplay += `: (${(child.settings as GroupSettings).type || 'capturing'})`; if((child.settings as GroupSettings).name) childDisplay += ` ?<${(child.settings as GroupSettings).name}>`;}
                                                else if (child.type === BlockType.ALTERNATION) childDisplay += `: ( | )`;
                                                
                                                let nestedChildrenStr = "";
                                                if(child.children && child.children.length > 0) {
                                                  nestedChildrenStr = `\n${renderChildrenPreview(child.children, level + 1)}`;
                                                }
                                                return `${childDisplay}${nestedChildrenStr}`;
                                              }).join('\n');
                                            }
                                            let childrenStr = "";
                                            if(b.children && b.children.length > 0) {
                                                childrenStr = `\n${renderChildrenPreview(b.children, 1)}`;
                                            }

                                            return <div key={b.id}>{display}{childrenStr}</div>;
                                        })}
                                    </div>
                                </Card>
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    {formData.mainCategory === 'ai_assisted' ? 
                                        "AI не смог сгенерировать блоки для вашего запроса или произошла ошибка." :
                                        "Нет блоков для отображения."
                                    }
                                </p>
                            )}
                            {aiExplanation && formData.mainCategory === 'ai_assisted' && (
                                <div className="mt-3">
                                    <Label className="text-sm font-medium">Объяснение от AI:</Label>
                                    <Card className="p-3 bg-muted/30 text-xs max-h-40 overflow-y-auto">
                                        <p className="whitespace-pre-wrap">{aiExplanation}</p>
                                    </Card>
                                </div>
                            )}
                             {aiExampleTestText && formData.mainCategory === 'ai_assisted' && (
                                <div className="mt-3">
                                    <Label className="text-sm font-medium">Пример текста от AI:</Label>
                                    <Card className="p-3 bg-muted/30 text-xs max-h-20 overflow-y-auto">
                                        <p className="whitespace-pre-wrap">{aiExampleTestText}</p>
                                    </Card>
                                </div>
                            )}
                            {replacementString && (
                                <div className="mt-2">
                                    <Label className="text-sm font-medium">Рекомендуемая строка для замены:</Label>
                                    <p className="text-xs font-mono p-2 bg-muted/50 rounded-md">{replacementString}</p>
                                </div>
                            )}
                             <Alert className="mt-3">
                                <Lightbulb className="h-4 w-4" />
                                <AlertTitle>Подсказка</AlertTitle>
                                <AlertDescription>
                                    {formData.mainCategory === 'ai_assisted' ? 
                                    "AI предлагает Regex и, по возможности, его разбор на блоки. Вы можете добавить их в редактор." :
                                    "Это базовый набор блоков. После добавления вы сможете их детальнее настроить."
                                    }
                                </AlertDescription>
                            </Alert>
                        </>
                    )}
                </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="pt-4 border-t">
            {currentStepId !== 'start' && (
                 <Button variant="outline" onClick={handleBack} disabled={isLoadingAI}>Назад</Button>
            )}
            <div className="flex-grow"></div>
            <Button
                onClick={handleNext}
                disabled={isNextDisabled()}
            >
                {isLoadingAI ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Обработка...</> : (currentStepId === 'final_preview' ? "Добавить в выражение" : "Далее")}
            </Button>
            <DialogClose asChild>
                <Button variant="ghost" onClick={resetWizardAndClose} disabled={isLoadingAI}>Отмена</Button>
            </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RegexWizardModal;
