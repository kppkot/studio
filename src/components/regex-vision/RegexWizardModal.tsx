
"use client";
import React, { useState, useCallback, useEffect } from 'react';
import type { Block, QuantifierSettings, CharacterClassSettings, GroupSettings } from './types';
import { BlockType } from './types';
import { BLOCK_CONFIGS } from './constants.tsx';
import { generateId } from './utils';

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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Lightbulb } from 'lucide-react';

interface RegexWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (blocks: Block[]) => void;
}

type WizardStepId = 
  | 'start'
  | 'validation_type_choice' 
  | 'validation_basicPatterns_what'
  | 'validation_basicPatterns_length'
  | 'validation_basicPatterns_length_specify'
  | 'validation_standardFormats_what' 
  | 'validation_standardFormats_url_protocol'
  | 'validation_dateTime_dateFormat'
  | 'validation_dateTime_separators'
  | 'validation_dateTime_validateTime'
  | 'validation_dateTime_timeFormat'
  | 'extraction_whatToExtract'
  | 'extraction_quotedText_type' // New
  | 'extraction_specificWord_input' // New
  | 'final_preview';

interface WizardFormData {
  mainCategory?: 'validation' | 'extraction' | 'replacement' | 'splitting';
  
  // Validation branch
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

  dateFormat?: 'ddmmyyyy' | 'yyyymmdd' | 'other_date';
  dateSeparators?: ('slash' | 'hyphen' | 'dot')[];
  validateTime?: 'yes' | 'no';
  timeFormat?: '24hr' | '12hr';

  // Extraction branch
  extractionChoice?: 'emails' | 'urls' | 'numbers' | 'quotedText' | 'specificWord' | 'duplicateWords';
  quoteType?: 'single' | 'double'; // New
  specificWord?: string; // New
}


const wizardConfig = {
  start: {
    title: "Мастер Regex: Какова ваша основная цель?",
    type: 'radio',
    options: [
      { id: 'validation', label: "Валидация: проверить формат строки, соответствие шаблону." },
      { id: 'extraction', label: "Извлечение/Поиск: найти или выделить данные из текста." },
      { id: 'replacement', label: "Замена/Трансформация: заменить или форматировать части строки.", disabled: true },
      { id: 'splitting', label: "Разделение: разбить текст по разделителю.", disabled: true },
    ],
    next: (choice: string) => {
      if (choice === 'validation') return 'validation_type_choice'; 
      if (choice === 'extraction') return 'extraction_whatToExtract';
      return 'start'; 
    }
  },
  // --- VALIDATION BRANCH ---
  validation_type_choice: {
    title: "Валидация: Какой тип проверки вам нужен?",
    type: 'radio',
    options: [
      { id: 'basic', label: "Простые шаблоны (цифры, буквы, длина и т.д.)" },
      { id: 'standard', label: "Стандартные форматы (Email, URL и т.д., кроме даты/времени)" },
      { id: 'datetime', label: "Дата и время (ДД/ММ/ГГГГ, ЧЧ:ММ и т.д.)" },
    ],
    next: (choice: string) => {
      if (choice === 'basic') return 'validation_basicPatterns_what';
      if (choice === 'standard') return 'validation_standardFormats_what';
      if (choice === 'datetime') return 'validation_dateTime_dateFormat';
      return 'validation_type_choice';
    }
  },
  validation_basicPatterns_what: {
    title: "Проверка простых шаблонов: Что должно быть в строке?",
    description: "Выберите один или несколько типов символов, которые должна содержать строка.",
    type: 'checkbox',
    checkboxes: [
      { id: 'basicPattern_contains_digits', label: "Цифры (0-9)" },
      { id: 'basicPattern_contains_letters_az', label: "Буквы (a-z)" },
      { id: 'basicPattern_contains_letters_AZ', label: "Большие буквы (A-Z)" },
      { id: 'basicPattern_contains_space', label: "Пробелы" },
    ],
    otherCharsInput: { id: 'basicPattern_contains_otherChars', label: "Другие символы (укажите):" },
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
      { id: 'email', label: "Email (электронная почта)" },
      { id: 'url', label: "URL (веб-адрес)" },
      { id: 'phone', label: "Телефон", disabled: true },
      { id: 'ip', label: "IP-адрес (IPv4/IPv6)", disabled: true },
      { id: 'password', label: "Пароль (проверка сложности)", disabled: true },
    ],
    next: (choice: string) => {
      if (choice === 'email') return 'final_preview';
      if (choice === 'url') return 'validation_standardFormats_url_protocol';
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
  validation_dateTime_dateFormat: {
    title: "Проверка Даты и Времени: Какой формат даты?",
    type: 'radio',
    options: [
        { id: 'ddmmyyyy', label: "ДД/ММ/ГГГГ или ДД.ММ.ГГГГ" },
        { id: 'yyyymmdd', label: "ГГГГ-ММ-ДД" },
        { id: 'other_date', label: "Другой (скоро)", disabled: true },
    ],
    next: (choice: string) => {
        if (choice === 'ddmmyyyy') return 'validation_dateTime_separators';
        if (choice === 'yyyymmdd') return 'validation_dateTime_validateTime'; 
        return 'validation_dateTime_dateFormat';
    }
  },
  validation_dateTime_separators: {
      title: "Проверка Даты (ДД/ММ/ГГГГ): Какие разделители разрешены?",
      description: "Выберите один или несколько разделителей.",
      type: 'checkbox',
      checkboxes: [
          { id: 'slash', label: "/ (слэш)" },
          { id: 'hyphen', label: "- (дефис)" },
          { id: 'dot', label: ". (точка)" },
      ],
      nextStep: 'validation_dateTime_validateTime',
  },
  validation_dateTime_validateTime: {
      title: "Проверка Даты и Времени: Нужно ли также проверять время?",
      type: 'radio',
      options: [
          { id: 'yes', label: "Да" },
          { id: 'no', label: "Нет" },
      ],
      next: (choice: string) => {
          if (choice === 'yes') return 'validation_dateTime_timeFormat';
          return 'final_preview';
      }
  },
  validation_dateTime_timeFormat: {
      title: "Проверка Времени: Какой формат времени?",
      type: 'radio',
      options: [
          { id: '24hr', label: "24-часовой (ЧЧ:ММ)" },
          { id: '12hr', label: "12-часовой (ЧЧ:ММ AM/PM)" },
      ],
      nextStep: 'final_preview',
  },
  // --- EXTRACTION BRANCH ---
  extraction_whatToExtract: {
    title: "Извлечение/Поиск: Что нужно найти в тексте?",
    type: 'radio',
    options: [
      { id: 'emails', label: "Все email-адреса" },
      { id: 'urls', label: "Все URL-адреса" },
      { id: 'numbers', label: "Все числа (целые/десятичные)" },
      { id: 'quotedText', label: "Текст в кавычках" }, // Enabled
      { id: 'specificWord', label: "Слово/фразу (ввести)" }, // Enabled
      { id: 'duplicateWords', label: "Повторяющиеся слова", disabled: true },
    ],
    next: (choice: string) => {
      if (['emails', 'urls', 'numbers'].includes(choice)) {
        return 'final_preview';
      }
      if (choice === 'quotedText') return 'extraction_quotedText_type';
      if (choice === 'specificWord') return 'extraction_specificWord_input';
      return 'extraction_whatToExtract';
    }
  },
  extraction_quotedText_type: { // New step
    title: "Извлечение текста в кавычках: Какой тип кавычек?",
    type: 'radio',
    options: [
        { id: 'double', label: 'Двойные кавычки ("...")' },
        { id: 'single', label: "Одинарные кавычки ('...')" }
    ],
    nextStep: 'final_preview'
  },
  extraction_specificWord_input: { // New step
    title: "Извлечение слова/фразы: Введите слово или фразу",
    type: 'inputs',
    inputs: [
        { id: 'specificWord', label: "Искомый текст:", inputType: 'text', defaultValue: '' },
    ],
    nextStep: 'final_preview'
  },
  final_preview: {
    title: "Предпросмотр и добавление",
    type: 'preview',
  }
};


const RegexWizardModal: React.FC<RegexWizardModalProps> = ({ isOpen, onClose, onComplete }) => {
  const [currentStepId, setCurrentStepId] = useState<WizardStepId>('start');
  const [formData, setFormData] = useState<WizardFormData>({});
  const [generatedBlocks, setGeneratedBlocks] = useState<Block[]>([]);

  useEffect(() => {
    if (isOpen) {
        setCurrentStepId('start');
        setFormData({});
        setGeneratedBlocks([]);
    }
  }, [isOpen]);

  const currentStepConfig = wizardConfig[currentStepId as keyof typeof wizardConfig];

  const handleRadioChange = (value: string) => {
    const newFormData = { ...formData };
    
    // Clear subsequent choices if a major category/type choice changes
    if (currentStepId === 'start') {
        Object.keys(newFormData).forEach(key => {
            if (key !== 'mainCategory') delete newFormData[key as keyof WizardFormData];
        });
        newFormData.mainCategory = value as WizardFormData['mainCategory'];
    } else if (currentStepId === 'validation_type_choice') {
        Object.keys(newFormData).forEach(key => {
            if (!['mainCategory', 'validationTypeChoice'].includes(key)) delete newFormData[key as keyof WizardFormData];
        });
        newFormData.validationTypeChoice = value as WizardFormData['validationTypeChoice'];
    } else if (currentStepId === 'extraction_whatToExtract') {
        Object.keys(newFormData).forEach(key => {
            if (!['mainCategory', 'extractionChoice'].includes(key)) delete newFormData[key as keyof WizardFormData];
        });
        newFormData.extractionChoice = value as WizardFormData['extractionChoice'];
    } else {
       newFormData[currentStepId as keyof WizardFormData] = value as any;
    }
    
    if (currentStepId === 'validation_standardFormats_what') newFormData.standardFormatChoice = value as WizardFormData['standardFormatChoice'];
    else if (currentStepId === 'validation_standardFormats_url_protocol') newFormData.url_requireProtocol = value as WizardFormData['url_requireProtocol'];
    else if (currentStepId === 'validation_basicPatterns_length') newFormData.basicPattern_restrictLength = value as WizardFormData['basicPattern_restrictLength'];
    else if (currentStepId === 'validation_dateTime_dateFormat') newFormData.dateFormat = value as WizardFormData['dateFormat'];
    else if (currentStepId === 'validation_dateTime_validateTime') newFormData.validateTime = value as WizardFormData['validateTime'];
    else if (currentStepId === 'validation_dateTime_timeFormat') newFormData.timeFormat = value as WizardFormData['timeFormat'];
    else if (currentStepId === 'extraction_quotedText_type') newFormData.quoteType = value as WizardFormData['quoteType'];
    
    setFormData(newFormData);
  };

  const getRadioValue = () => {
    if (currentStepId === 'start') return formData.mainCategory;
    if (currentStepId === 'validation_type_choice') return formData.validationTypeChoice;
    if (currentStepId === 'validation_standardFormats_what') return formData.standardFormatChoice;
    if (currentStepId === 'validation_standardFormats_url_protocol') return formData.url_requireProtocol;
    if (currentStepId === 'validation_basicPatterns_length') return formData.basicPattern_restrictLength;
    if (currentStepId === 'validation_dateTime_dateFormat') return formData.dateFormat;
    if (currentStepId === 'validation_dateTime_validateTime') return formData.validateTime;
    if (currentStepId === 'validation_dateTime_timeFormat') return formData.timeFormat;
    if (currentStepId === 'extraction_whatToExtract') return formData.extractionChoice;
    if (currentStepId === 'extraction_quotedText_type') return formData.quoteType;
    return formData[currentStepId as keyof WizardFormData] as string || '';
  }

  const handleCheckboxChange = (checkboxId: string, checked: boolean) => {
    if (currentStepId === 'validation_dateTime_separators') {
        const currentSeparators = formData.dateSeparators || [];
        let newSeparators: ('slash' | 'hyphen' | 'dot')[];
        if (checked) {
            newSeparators = [...currentSeparators, checkboxId as ('slash' | 'hyphen' | 'dot')];
        } else {
            newSeparators = currentSeparators.filter(sep => sep !== checkboxId);
        }
        setFormData(prev => ({ ...prev, dateSeparators: newSeparators }));
    } else {
        setFormData(prev => ({ ...prev, [checkboxId]: checked }));
    }
  };
  
  const handleInputChange = (inputId: string, value: string | number) => {
     setFormData(prev => ({ ...prev, [inputId]: value }));
  };

  // --- Block Generation Helper Functions ---
  const createAnchor = (type: '^' | '$' | '\\b' | '\\B'): Block => ({
    id: generateId(), type: BlockType.ANCHOR, settings: { type }, children: [], isExpanded: false
  });

  const createSequenceGroup = (children: Block[], type: GroupSettings['type'] = 'non-capturing', name?:string): Block => ({
    id: generateId(), type: BlockType.GROUP, settings: {type, name}, children, isExpanded: true
  });

  const createAlternation = (options: Block[][]): Block => ({
    id: generateId(), type: BlockType.ALTERNATION, children: options.map(optChildren => createSequenceGroup(optChildren)), isExpanded: true
  });
  
  const createLiteral = (text: string): Block => ({
    id: generateId(), type: BlockType.LITERAL, settings: {text}, children: [], isExpanded: false
  });

  const createCharClass = (pattern: string, negated = false): Block => ({
    id: generateId(), type: BlockType.CHARACTER_CLASS, settings: {pattern, negated} as CharacterClassSettings, children: [], isExpanded: false
  });
  
  const createQuantifier = (type: QuantifierSettings['type'], min?: number, max?: number | null, mode: QuantifierSettings['mode'] = 'greedy'): Block => ({
    id: generateId(), type: BlockType.QUANTIFIER, settings: {type, min, max, mode} as QuantifierSettings, children: [], isExpanded: false
  });


  const generateBlocksForBasicPattern = useCallback((): Block[] => {
    const blocks: Block[] = [];
    let patternChars = '';
    if (formData.basicPattern_contains_digits) patternChars += '\\d';
    if (formData.basicPattern_contains_letters_az) patternChars += 'a-z';
    if (formData.basicPattern_contains_letters_AZ) patternChars += 'A-Z';
    if (formData.basicPattern_contains_space) patternChars += '\\s';
    if (formData.basicPattern_contains_otherChars) {
      patternChars += formData.basicPattern_contains_otherChars.replace(/[\]\-\^]/g, '\\$&');
    }

    if (!patternChars) return [];

    blocks.push(createAnchor('^'));
    
    const charClassBlock: Block = createCharClass(patternChars);

    let quantifierType: QuantifierSettings['type'] = '+';
    let min: number | undefined = undefined;
    let max: number | null | undefined = undefined;

    if (formData.basicPattern_restrictLength === 'yes') {
      min = typeof formData.basicPattern_minLength === 'number' ? formData.basicPattern_minLength : 1;
      max = typeof formData.basicPattern_maxLength === 'number' ? formData.basicPattern_maxLength : null;

      if (min !== undefined && max === null) quantifierType = '{n,}';
      else if (min !== undefined && max !== undefined && min === max) quantifierType = '{n}';
      else if (min !== undefined && max !== undefined) quantifierType = '{n,m}';
    }
    
    blocks.push(charClassBlock);
    blocks.push(createQuantifier(quantifierType, min, max));
    blocks.push(createAnchor('$'));
    return blocks;
  }, [formData]);

  const generateBlocksForEmail = useCallback((forExtraction: boolean = false): Block[] => {
    const emailBlocks: Block[] = [
      createCharClass('\\w._%+-'),
      createQuantifier('+'),
      createLiteral('@'),
      createCharClass('[\\w.-]'), 
      createQuantifier('+'),
      createLiteral('\\.'), 
      createCharClass('A-Za-z'),
      createQuantifier('{n,}', 2, null),
    ];
    if(forExtraction) {
        return [createAnchor('\\b'), ...emailBlocks, createAnchor('\\b')];
    }
    return [createAnchor('^'), ...emailBlocks, createAnchor('$')];
  }, []);

  const generateBlocksForURL = useCallback((forExtraction: boolean = false): Block[] => {
    const blocks: Block[] = [];
    let protocolIsRequiredForValidation = formData.url_requireProtocol === 'yes';

    if (protocolIsRequiredForValidation || forExtraction) { 
      const protocolPart: Block[] = [
        createLiteral('http'),
        createSequenceGroup([createLiteral('s')], 'non-capturing'), // group for 's'
        createQuantifier('?'), // 's' is optional
        createLiteral('://')
      ];
      if (!protocolIsRequiredForValidation && forExtraction) { // if not required for validation, make it optional for extraction
         blocks.push(createSequenceGroup(protocolPart, 'non-capturing')); // Wrap entire http(s):// part
         blocks.push(createQuantifier('?')); // Make the entire protocol optional
      } else { // Protocol is required (either for validation or because forExtraction is true and we include it)
         blocks.push(...protocolPart);
      }
    }
    
    blocks.push(createSequenceGroup([createLiteral('www\\.')], 'non-capturing'));
    blocks.push(createQuantifier('?'));

    blocks.push(createCharClass('A-Za-z0-9._%+-'));
    blocks.push(createQuantifier('+'));
    blocks.push(createLiteral('\\.'));

    blocks.push(createCharClass('A-Za-z'));
    blocks.push(createQuantifier('{n,m}', 2, 6));

    const pathSegment = createSequenceGroup([
        createLiteral('/'),
        createCharClass('[\\w.-]'), 
        createQuantifier('*')
    ], 'non-capturing');
    blocks.push(pathSegment);
    blocks.push(createQuantifier('*'));
    
    blocks.push(createLiteral('/'));
    blocks.push(createQuantifier('?'));
    
    if (forExtraction) {
        return [createAnchor('\\b'), ...blocks, createAnchor('\\b')];
    }
    return [createAnchor('^'), ...blocks, createAnchor('$')];
  }, [formData.url_requireProtocol]);

  const generateBlocksForNumbers = useCallback((): Block[] => {
    return [
        createAnchor('\\b'),
        createCharClass('\\d'),
        createQuantifier('+'),
        createSequenceGroup([
            createLiteral('\\.'),
            createCharClass('\\d'),
            createQuantifier('+')
        ], 'non-capturing'),
        createQuantifier('?'), 
        createAnchor('\\b')
    ];
  }, []);

  const generateBlocksForQuotedText = useCallback((): Block[] => {
    const quoteChar = formData.quoteType === 'single' ? "'" : '"';
    const escapedQuoteChar = formData.quoteType === 'single' ? "\\'" : '\\"';
    const nonQuotePattern = formData.quoteType === 'single' ? "[^']" : '[^"]';

    return [
        createLiteral(escapedQuoteChar),
        createSequenceGroup([ // Capturing group for the content
            createCharClass(nonQuotePattern),
            createQuantifier('*')
        ], 'capturing'),
        createLiteral(escapedQuoteChar)
    ];
  }, [formData.quoteType]);

  const generateBlocksForSpecificWord = useCallback((): Block[] => {
    if (!formData.specificWord?.trim()) return [];
    // Basic escaping for the literal text to avoid issues if user types regex metacharacters
    const escapedWord = formData.specificWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return [
        createAnchor('\\b'),
        createLiteral(escapedWord),
        createAnchor('\\b')
    ];
  }, [formData.specificWord]);

  const generateBlocksForDateTime = useCallback((): Block[] => {
    const blocks: Block[] = [];
    blocks.push(createAnchor('^'));

    let separatorPattern = "";
    if (formData.dateFormat === 'ddmmyyyy' && formData.dateSeparators && formData.dateSeparators.length > 0) {
        separatorPattern = formData.dateSeparators.map(s => {
            if (s === 'slash') return '/';
            if (s === 'hyphen') return '-';
            if (s === 'dot') return '\\.';
            return '';
        }).join('');
    } else if (formData.dateFormat === 'yyyymmdd') {
        separatorPattern = '-'; 
    }
    const separatorClassBlock = separatorPattern ? createCharClass(separatorPattern.length > 1 ? `[${separatorPattern.replace(/\[|\]/g, '')}]` : separatorPattern) : null;


    if (formData.dateFormat === 'ddmmyyyy') {
        blocks.push(createSequenceGroup([createAlternation([
            [createLiteral("0"), createCharClass("1-9")],
            [createCharClass("12"), createCharClass("0-9")],
            [createLiteral("3"), createCharClass("01")]
        ])]));
        if (separatorClassBlock) blocks.push(separatorClassBlock);
        blocks.push(createSequenceGroup([createAlternation([
            [createLiteral("0"), createCharClass("1-9")],
            [createLiteral("1"), createCharClass("012")]
        ])]));
        if (separatorClassBlock) blocks.push(separatorClassBlock);
        blocks.push(createSequenceGroup([
            createAlternation([[createLiteral("19")], [createLiteral("20")]]),
            createCharClass("\\d"), createQuantifier("{n}", 2, 2)
        ]));
    } else if (formData.dateFormat === 'yyyymmdd') {
         blocks.push(createSequenceGroup([
            createAlternation([[createLiteral("19")], [createLiteral("20")]]),
            createCharClass("\\d"), createQuantifier("{n}", 2, 2)
        ]));
        if (separatorClassBlock) blocks.push(separatorClassBlock);
        blocks.push(createSequenceGroup([createAlternation([
            [createLiteral("0"), createCharClass("1-9")],
            [createLiteral("1"), createCharClass("012")]
        ])]));
        if (separatorClassBlock) blocks.push(separatorClassBlock);
        blocks.push(createSequenceGroup([createAlternation([
            [createLiteral("0"), createCharClass("1-9")],
            [createCharClass("12"), createCharClass("0-9")],
            [createLiteral("3"), createCharClass("01")]
        ])]));
    }

    if (formData.validateTime === 'yes') {
        blocks.push(createCharClass("\\s")); 
        blocks.push(createQuantifier("?")); 

        if (formData.timeFormat === '24hr') {
            blocks.push(createSequenceGroup([createAlternation([
                [createCharClass("01"), createCharClass("\\d")],
                [createLiteral("2"), createCharClass("0-3")]
            ])]));
            blocks.push(createLiteral(":"));
            blocks.push(createSequenceGroup([createCharClass("0-5"), createCharClass("\\d")]));
        } else if (formData.timeFormat === '12hr') {
            blocks.push(createSequenceGroup([createAlternation([
                [createSequenceGroup([createLiteral("0"), createQuantifier("?")]), createCharClass("1-9")],
                [createLiteral("1"), createCharClass("0-2")]
            ])]));
            blocks.push(createLiteral(":"));
            blocks.push(createSequenceGroup([createCharClass("0-5"), createCharClass("\\d")]));
            blocks.push(createCharClass("\\s")); 
            blocks.push(createQuantifier("?"));
            blocks.push(createSequenceGroup([createAlternation([
                [createLiteral("AM")],
                [createLiteral("PM")]
            ])], 'non-capturing')); 
        }
    }
    
    blocks.push(createAnchor('$'));
    return blocks;
  }, [formData]);


  const handleNext = () => {
    if (!currentStepConfig) return;

    if (currentStepId === 'final_preview') {
        if (generatedBlocks.length > 0) {
          onComplete(generatedBlocks);
        }
        return;
    }
    
    let nextStepTargetId: WizardStepId | undefined = undefined;
    let choice: string | undefined = undefined;

    if ('next' in currentStepConfig && typeof currentStepConfig.next === 'function') {
      if (currentStepId === 'start') choice = formData.mainCategory;
      else if (currentStepId === 'validation_type_choice') choice = formData.validationTypeChoice;
      else if (currentStepId === 'validation_basicPatterns_length') choice = formData.basicPattern_restrictLength;
      else if (currentStepId === 'validation_standardFormats_what') choice = formData.standardFormatChoice;
      else if (currentStepId === 'validation_dateTime_dateFormat') choice = formData.dateFormat;
      else if (currentStepId === 'validation_dateTime_validateTime') choice = formData.validateTime;
      else if (currentStepId === 'extraction_whatToExtract') choice = formData.extractionChoice;
      
      if (choice) {
        nextStepTargetId = currentStepConfig.next(choice) as WizardStepId;
      } else {
        return; 
      }
    } else if ('nextStep' in currentStepConfig) {
      nextStepTargetId = currentStepConfig.nextStep as WizardStepId;
    }
    
    if (nextStepTargetId === 'final_preview') {
        if(formData.mainCategory === 'validation'){
            if(formData.validationTypeChoice === 'basic'){
                 setGeneratedBlocks(generateBlocksForBasicPattern());
            } else if (formData.validationTypeChoice === 'standard') {
                if(formData.standardFormatChoice === 'email') {
                    setGeneratedBlocks(generateBlocksForEmail(false));
                } else if (formData.standardFormatChoice === 'url') {
                    setGeneratedBlocks(generateBlocksForURL(false));
                } else {
                     setGeneratedBlocks([]); 
                }
            } else if (formData.validationTypeChoice === 'datetime') {
                setGeneratedBlocks(generateBlocksForDateTime());
            }
             else {
                 setGeneratedBlocks([]);
            }
        } else if (formData.mainCategory === 'extraction') {
            if (formData.extractionChoice === 'emails') {
                setGeneratedBlocks(generateBlocksForEmail(true));
            } else if (formData.extractionChoice === 'urls') {
                const tempFormData = {...formData}; 
                if(tempFormData.url_requireProtocol === undefined) tempFormData.url_requireProtocol = 'no';
                setGeneratedBlocks(generateBlocksForURL(true));
            } else if (formData.extractionChoice === 'numbers') {
                setGeneratedBlocks(generateBlocksForNumbers());
            } else if (formData.extractionChoice === 'quotedText') {
                setGeneratedBlocks(generateBlocksForQuotedText());
            } else if (formData.extractionChoice === 'specificWord') {
                setGeneratedBlocks(generateBlocksForSpecificWord());
            } else {
                setGeneratedBlocks([]);
            }
        } else {
            setGeneratedBlocks([]); 
        }
    }

    if (nextStepTargetId) {
      setCurrentStepId(nextStepTargetId);
    } else {
      console.warn("Wizard: No next step defined for", currentStepId, "with choice", choice);
    }
  };

  const handleBack = () => {
    let prevStep: WizardStepId | null = null;
    // This needs to be a more robust history or explicit parent mapping for complex wizards
    switch (currentStepId) {
        case 'validation_type_choice': prevStep = 'start'; break;
        case 'extraction_whatToExtract': prevStep = 'start'; break;

        case 'validation_basicPatterns_what': prevStep = 'validation_type_choice'; break;
        case 'validation_basicPatterns_length': prevStep = 'validation_basicPatterns_what'; break;
        case 'validation_basicPatterns_length_specify': prevStep = 'validation_basicPatterns_length'; break;
        
        case 'validation_standardFormats_what': prevStep = 'validation_type_choice'; break;
        case 'validation_standardFormats_url_protocol': prevStep = 'validation_standardFormats_what'; break;
        
        case 'validation_dateTime_dateFormat': prevStep = 'validation_type_choice'; break;
        case 'validation_dateTime_separators': prevStep = 'validation_dateTime_dateFormat'; break;
        case 'validation_dateTime_validateTime': 
            if (formData.dateFormat === 'ddmmyyyy') prevStep = 'validation_dateTime_separators';
            else if (formData.dateFormat === 'yyyymmdd') prevStep = 'validation_dateTime_dateFormat';
            else prevStep = 'validation_dateTime_dateFormat'; 
            break;
        case 'validation_dateTime_timeFormat': prevStep = 'validation_dateTime_validateTime'; break;

        case 'extraction_quotedText_type': prevStep = 'extraction_whatToExtract'; break;
        case 'extraction_specificWord_input': prevStep = 'extraction_whatToExtract'; break;

        case 'final_preview':
            if (formData.mainCategory === 'validation') {
                if (formData.validationTypeChoice === 'basic') {
                    prevStep = formData.basicPattern_restrictLength === 'yes' ? 'validation_basicPatterns_length_specify' : 'validation_basicPatterns_length';
                } else if (formData.validationTypeChoice === 'standard') {
                    if (formData.standardFormatChoice === 'email') prevStep = 'validation_standardFormats_what';
                    else if (formData.standardFormatChoice === 'url') prevStep = 'validation_standardFormats_url_protocol';
                    else prevStep = 'validation_standardFormats_what'; 
                } else if (formData.validationTypeChoice === 'datetime') {
                    if (formData.validateTime === 'yes') prevStep = 'validation_dateTime_timeFormat';
                    else prevStep = 'validation_dateTime_validateTime';
                }
                 else {
                    prevStep = 'validation_type_choice'; 
                }
            } else if (formData.mainCategory === 'extraction') {
                 if (formData.extractionChoice === 'quotedText') prevStep = 'extraction_quotedText_type';
                 else if (formData.extractionChoice === 'specificWord') prevStep = 'extraction_specificWord_input';
                 else prevStep = 'extraction_whatToExtract';
            }
            else {
                prevStep = 'start'; 
            }
            break;
        default: prevStep = 'start';
    }
    
    if (prevStep) {
        setCurrentStepId(prevStep);
    } else {
        setCurrentStepId('start'); 
    }
    setGeneratedBlocks([]); 
  };

  const resetWizardAndClose = () => {
    setCurrentStepId('start');
    setFormData({});
    setGeneratedBlocks([]);
    onClose();
  }

  if (!isOpen || !currentStepConfig) return null;

  const isNextDisabled = () => {
    if (currentStepConfig.type === 'radio' && !getRadioValue()) {
      return true;
    }
    if (currentStepId === 'validation_dateTime_separators' && (!formData.dateSeparators || formData.dateSeparators.length === 0)) {
        return true; 
    }
    if (currentStepId === 'extraction_specificWord_input' && !formData.specificWord?.trim()) {
        return true;
    }
    if (currentStepId === 'final_preview' && generatedBlocks.length === 0) {
        if(formData.mainCategory === 'validation'){
            if(formData.validationTypeChoice === 'standard' && (formData.standardFormatChoice === 'phone' || formData.standardFormatChoice === 'ip' || formData.standardFormatChoice === 'password')){
                return true; 
            }
            if(formData.validationTypeChoice === 'datetime' && formData.dateFormat === 'other_date') {
                return true;
            }
        } else if (formData.mainCategory === 'extraction') {
            if (['duplicateWords'].includes(formData.extractionChoice || '')) {
                return true;
            }
            // If specific word was chosen but not entered, disable next on preview
            if (formData.extractionChoice === 'specificWord' && !formData.specificWord?.trim()) {
                return true;
            }
        }
    }
    return false;
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) resetWizardAndClose(); }}>
      <DialogContent className="sm:max-w-xl md:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{currentStepConfig.title}</DialogTitle>
          {currentStepConfig.description && (
            <DialogDescription>{currentStepConfig.description}</DialogDescription>
          )}
        </DialogHeader>
        
        <ScrollArea className="flex-1 pr-4 -mr-4 py-2">
          <div className="space-y-6">
            {currentStepConfig.type === 'radio' && currentStepConfig.options && (
              <RadioGroup 
                value={getRadioValue()} 
                onValueChange={handleRadioChange}
              >
                {currentStepConfig.options.map(opt => (
                  <div key={opt.id} className="flex items-center space-x-2 p-2 border rounded-md hover:bg-muted/50 has-[:checked]:bg-accent/20 has-[:checked]:border-accent data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed" data-disabled={opt.disabled ? "true" : undefined}>
                    <RadioGroupItem value={opt.id} id={`${currentStepId}-${opt.id}`} disabled={opt.disabled}/>
                    <Label htmlFor={`${currentStepId}-${opt.id}`} className={`flex-1 py-1 text-sm ${opt.disabled ? 'cursor-not-allowed text-muted-foreground' : 'cursor-pointer'}`}>
                      {opt.label}
                      {opt.disabled && <span className="text-xs text-muted-foreground ml-2">(скоро)</span>}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            )}

            {currentStepConfig.type === 'checkbox' && currentStepConfig.checkboxes && (
              <div className="space-y-3">
                {currentStepConfig.checkboxes.map(cb => (
                  <div key={cb.id} className="flex items-center space-x-3 p-2 border rounded-md hover:bg-muted/50">
                    <Checkbox 
                      id={`${currentStepId}-${cb.id}`} 
                      checked={currentStepId === 'validation_dateTime_separators' ? formData.dateSeparators?.includes(cb.id as any) : !!formData[cb.id as keyof WizardFormData]}
                      onCheckedChange={(checked) => handleCheckboxChange(cb.id, !!checked)}
                    />
                    <Label htmlFor={`${currentStepId}-${cb.id}`} className="flex-1 cursor-pointer text-sm font-normal">
                      {cb.label}
                    </Label>
                  </div>
                ))}
                {currentStepConfig.otherCharsInput && (
                  <div className="flex items-center space-x-3 p-2 border rounded-md">
                     <Checkbox 
                      id={`${currentStepId}-${currentStepConfig.otherCharsInput.id}-enable`} 
                      checked={formData[currentStepConfig.otherCharsInput.id as keyof WizardFormData] !== undefined}
                      onCheckedChange={(checked) => {
                        if (checked) {
                            handleInputChange(currentStepConfig.otherCharsInput!.id, ''); 
                        } else {
                            const newFormData = {...formData};
                            delete newFormData[currentStepConfig.otherCharsInput!.id as keyof WizardFormData];
                            setFormData(newFormData);
                        }
                      }}
                    />
                    <Label htmlFor={`${currentStepId}-${currentStepConfig.otherCharsInput.id}-enable`} className="text-sm font-normal">
                        {currentStepConfig.otherCharsInput.label}
                    </Label>
                    {formData[currentStepConfig.otherCharsInput.id as keyof WizardFormData] !== undefined && (
                         <Input 
                            id={`${currentStepId}-${currentStepConfig.otherCharsInput.id}`}
                            value={formData[currentStepConfig.otherCharsInput.id as keyof WizardFormData] as string || ''}
                            onChange={(e) => handleInputChange(currentStepConfig.otherCharsInput!.id, e.target.value)}
                            className="h-8 flex-1"
                            placeholder='например, _-!'
                        />
                    )}
                  </div>
                )}
              </div>
            )}
            
            {currentStepConfig.type === 'inputs' && currentStepConfig.inputs && (
              <div className="space-y-4">
                {currentStepConfig.inputs.map(input => (
                  <div key={input.id}>
                    <Label htmlFor={`${currentStepId}-${input.id}`} className="text-sm font-medium">
                      {input.label}
                    </Label>
                    <Input 
                      id={`${currentStepId}-${input.id}`}
                      type={input.inputType}
                      value={formData[input.id as keyof WizardFormData] as string || (input.defaultValue !== undefined ? String(input.defaultValue) : '')}
                      onChange={(e) => handleInputChange(input.id, input.inputType === 'number' ? parseInt(e.target.value) || 0 : e.target.value)}
                      className="mt-1 h-9"
                      min={input.inputType === 'number' ? "0" : undefined}
                      autoFocus={currentStepId === 'extraction_specificWord_input'}
                    />
                  </div>
                ))}
              </div>
            )}

            {currentStepId === 'final_preview' && (
                <div className="space-y-3">
                    <Label className="text-sm font-medium">Сгенерированные блоки Regex:</Label>
                    {generatedBlocks.length > 0 ? (
                        <Card className="p-3 bg-muted/50 max-h-60 overflow-y-auto">
                            <div className="text-xs font-mono whitespace-pre-wrap space-y-1">
                                {generatedBlocks.map(b => {
                                    let display = `${BLOCK_CONFIGS[b.type]?.name || b.type}`;
                                    if (b.type === BlockType.LITERAL) display += `: "${(b.settings as any).text}"`;
                                    else if (b.type === BlockType.CHARACTER_CLASS) display += `: [${(b.settings as any).negated ? '^' : ''}${(b.settings as any).pattern}]`;
                                    else if (b.type === BlockType.QUANTIFIER) {
                                        const qs = b.settings as QuantifierSettings;
                                        display += `: ${qs.type}`;
                                        if (qs.min !== undefined) display += ` (min: ${qs.min}`;
                                        if (qs.max !== undefined && qs.max !== null) display += `, max: ${qs.max}`;
                                        if (qs.min !== undefined) display += `)`;
                                        display += `, ${qs.mode}`;
                                    }
                                    else if (b.type === BlockType.ANCHOR) display += `: ${(b.settings as any).type}`;
                                    else if (b.type === BlockType.GROUP) {
                                      display += `: (${(b.settings as any).type || 'capturing'})`;
                                      if((b.settings as any).name) display += ` ?<${(b.settings as any).name}>`;
                                    }
                                    else if (b.type === BlockType.ALTERNATION) display += `: ( | )`;


                                    const renderChildren = (children: Block[], level: number): string => {
                                      return children.map(child => {
                                        let childDisplay = `${'  '.repeat(level)}- ${BLOCK_CONFIGS[child.type]?.name || child.type}`;
                                        if (child.type === BlockType.LITERAL) childDisplay += `: "${(child.settings as any).text}"`;
                                        else if (child.type === BlockType.CHARACTER_CLASS) childDisplay += `: [${(child.settings as any).negated ? '^' : ''}${(child.settings as any).pattern}]`;
                                        else if (child.type === BlockType.QUANTIFIER) {
                                            const qs = child.settings as QuantifierSettings;
                                            childDisplay += `: ${qs.type}`;
                                            if (qs.min !== undefined) childDisplay += ` (min: ${qs.min}`;
                                            if (qs.max !== undefined && qs.max !== null) childDisplay += `, max: ${qs.max}`;
                                            if (qs.min !== undefined) childDisplay += `)`;
                                        }
                                        else if (child.type === BlockType.GROUP) {
                                            childDisplay += `: (${(child.settings as GroupSettings).type || 'capturing'})`;
                                            if((child.settings as GroupSettings).name) childDisplay += ` ?<${(child.settings as GroupSettings).name}>`;
                                        }

                                        let nestedChildrenStr = "";
                                        if(child.children && child.children.length > 0) {
                                           nestedChildrenStr = `\n${renderChildren(child.children, level + 1)}`;
                                        }
                                        return `${childDisplay}${nestedChildrenStr}`;
                                      }).join('\n');
                                    }
                                    let childrenStr = "";
                                    if(b.children && b.children.length > 0) {
                                        childrenStr = `\n${renderChildren(b.children, 1)}`;
                                    }

                                    return <div key={b.id}>{display}{childrenStr}</div>;
                                })}
                            </div>
                        </Card>
                    ) : (
                        <p className="text-sm text-muted-foreground">Нет блоков для отображения. Возможно, этот путь Мастера еще не полностью реализован, не все параметры были выбраны, или выбранная опция помечена как "(скоро)".</p>
                    )}
                    <Alert>
                        <Lightbulb className="h-4 w-4" />
                        <AlertTitle>Подсказка</AlertTitle>
                        <AlertDescription>
                            Это базовый набор блоков. После добавления вы сможете их детальнее настроить, сгруппировать или добавить другие элементы в основном редакторе. Для сценариев извлечения часто используется флаг 'g' (глобальный поиск), который можно установить в панели вывода Regex.
                        </AlertDescription>
                    </Alert>
                </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="pt-4 border-t">
            {currentStepId !== 'start' && (
                 <Button variant="outline" onClick={handleBack}>Назад</Button>
            )}
            <div className="flex-grow"></div>
            <Button 
                onClick={handleNext} 
                disabled={isNextDisabled()}
            >
                {currentStepId === 'final_preview' ? "Добавить в выражение" : "Далее"}
            </Button>
            <DialogClose asChild>
                <Button variant="ghost" onClick={resetWizardAndClose}>Отмена</Button>
            </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RegexWizardModal;
