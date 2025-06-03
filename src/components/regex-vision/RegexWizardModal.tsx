



"use client";
import React, { useState, useCallback, useEffect } from 'react';
import type { Block, QuantifierSettings, CharacterClassSettings, GroupSettings, LookaroundSettings, LiteralSettings, AnchorSettings, BackreferenceSettings } from './types';
import { BlockType } from './types';
import { BLOCK_CONFIGS } from './constants.tsx';
// import { generateId } from './utils'; No longer needed here if helpers are moved to utils

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
import { Card } from "@/components/ui/card"; 
import { Lightbulb, CheckSquare, TextCursorInput, Replace, Eraser, Split, Wand2, Phone, AtSign, Globe, KeyRound, Shuffle, MessageSquareQuote, CaseSensitive, SearchCheck, Route, Workflow, FileText, CalendarClock, CheckBadge } from 'lucide-react';
import { cn } from '@/lib/utils';
import { generateId, createAnchor, createLiteral, createCharClass, createQuantifier, createSequenceGroup, createAlternation, createLookaround, createBackreference, escapeRegexChars, generateBlocksForEmail, generateBlocksForURL } from './utils';


interface RegexWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (blocks: Block[], parentId?: string | null) => void; // Added parentId
  initialParentId: string | null; 
}

type WizardStepId = 
  | 'start'
  | 'validation_type_choice' 
  | 'validation_basicPatterns_what'
  | 'validation_basicPatterns_length'
  | 'validation_basicPatterns_length_specify'
  | 'validation_standardFormats_what' 
  | 'validation_standardFormats_url_protocol' // Step to ask if protocol is required for URL
  | 'validation_phone_countryCode' 
  | 'validation_phone_separators' 
  | 'validation_ip_type' 
  | 'validation_password_requirements' 
  | 'validation_dateTime_dateFormat'
  | 'validation_dateTime_separators'
  | 'validation_dateTime_validateTime'
  | 'validation_dateTime_timeFormat'
  | 'extraction_whatToExtract'
  | 'extraction_quotedText_type'
  | 'extraction_specificWord_input'
  | 'replacement_whatToReplace'
  | 'replacement_maskDigits_options'
  | 'replacement_swap_input'
  | 'splitting_delimiter_choice'
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
  url_requireProtocol?: 'yes' | 'no'; // For URL, if http(s) is required
  phone_hasCountryCode?: 'yes' | 'no'; 
  phone_allowSeparators?: 'yes' | 'no'; 
  ip_type?: 'ipv4' | 'ipv6'; 
  password_req_digits?: boolean; 
  password_req_lowercase?: boolean; 
  password_req_uppercase?: boolean; 
  password_req_specialChars?: boolean; 
  password_minLength?: number; 

  dateFormat?: 'ddmmyyyy' | 'yyyymmdd' | 'other_date';
  dateSeparators?: ('slash' | 'hyphen' | 'dot')[];
  validateTime?: 'yes' | 'no';
  timeFormat?: '24hr' | '12hr';

  // Extraction branch
  extractionChoice?: 'emails' | 'urls' | 'numbers' | 'quotedText' | 'specificWord' | 'duplicateWords';
  quoteType?: 'single' | 'double';
  specificWord?: string;

  // Replacement branch
  replacementChoice?: 'multipleSpaces' | 'tabsToSpaces' | 'removeHtml' | 'swapParts' | 'maskDigits' | 'otherReplace';
  maskDigits_keepLast?: number;
  swapPattern?: string;
  swapReplacement?: string;

  // Splitting branch
  splittingChoice?: 'simpleChar' | 'comma' | 'space' | 'regex' | 'csv';
  splittingSimpleChar_input?: string;
  splittingRegex_input?: string;
}


const wizardConfig = {
  start: {
    title: "Мастер Regex: Выберите основную задачу",
    type: 'card_choice', // New type for card-like selection
    options: [
      { id: 'validation', label: "Проверить Формат", description: "Валидация email, URL, дат, и т.д.", icon: CheckSquare},
      { id: 'extraction', label: "Найти и Извлечь", description: "Извлечение email, чисел, текста в кавычках.", icon: SearchCheck },
      { id: 'replacement', label: "Заменить / Изменить", description: "Удаление пробелов, маскирование, замена.", icon: Replace },
      { id: 'splitting', label: "Разделить Текст", description: "Разбивка по запятой, пробелу, символу.", icon: Split },
      { id: 'condition', label: "Проверить Условие", description: "Содержит ли текст 'ошибку', цифры, и т.п." , icon: Workflow, disabled: true },
      { id: 'pro', label: "Свой Шаблон (PRO)", description: "Для сложных задач и опытных пользователей.", icon: Wand2, disabled: true },
    ],
    next: (choice: string) => {
      if (choice === 'validation') return 'validation_type_choice'; 
      if (choice === 'extraction') return 'extraction_whatToExtract';
      if (choice === 'replacement') return 'replacement_whatToReplace';
      if (choice === 'splitting') return 'splitting_delimiter_choice';
      return 'start'; 
    }
  },
  // --- VALIDATION BRANCH ---
  validation_type_choice: {
    title: "Валидация: Какой тип проверки вам нужен?",
    type: 'radio',
    options: [
      { id: 'basic', label: "Простые шаблоны (цифры, буквы, длина и т.д.)", icon: FileText },
      { id: 'standard', label: "Стандартные форматы (Email, URL, Телефон, IP, Пароль)", icon: CheckBadge },
      { id: 'datetime', label: "Дата и время (ДД/ММ/ГГГГ, ЧЧ:ММ и т.д.)", icon: CalendarClock },
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
      { id: 'phone', label: "Телефон", icon: Phone, disabled: true }, // Re-disable for now
      { id: 'ip', label: "IP-адрес (IPv4/IPv6)", icon: Route, disabled: false }, // IP was re-enabled
      { id: 'password', label: "Пароль (проверка сложности)", icon: KeyRound, disabled: true }, // Re-disable for now
    ],
    next: (choice: string) => {
      if (choice === 'email') return 'final_preview';
      if (choice === 'url') return 'validation_standardFormats_url_protocol';
      if (choice === 'phone') return 'validation_phone_countryCode';
      if (choice === 'ip') return 'validation_ip_type';
      if (choice === 'password') return 'validation_password_requirements';
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
  validation_phone_countryCode: { 
    title: "Проверка Телефона: Есть ли код страны?",
    type: 'radio',
    options: [
        { id: 'yes', label: "Да (например, +7)" },
        { id: 'no', label: "Нет" },
    ],
    nextStep: 'validation_phone_separators'
  },
  validation_phone_separators: { 
    title: "Проверка Телефона: Разрешены ли разделители (пробелы, дефисы)?",
    type: 'radio',
    options: [
        { id: 'yes', label: "Да, могут быть пробелы или дефисы" },
        { id: 'no', label: "Нет, только цифры (и + если код страны)" },
    ],
    nextStep: 'final_preview'
  },
  validation_ip_type: { 
    title: "Проверка IP-адреса: Какой тип IP-адреса?",
    type: 'radio',
    options: [
        { id: 'ipv4', label: "IPv4 (например, 192.168.0.1)" },
        { id: 'ipv6', label: "IPv6 (например, 2001:0db8:...)"}, 
    ],
    next: (choice: string) => {
        if (choice === 'ipv4' || choice === 'ipv6') return 'final_preview';
        return 'validation_ip_type'; 
    }
  },
  validation_password_requirements: { 
    title: "Проверка Пароля: Укажите требования к сложности",
    type: 'checkbox_and_input',
    checkboxes: [
        { id: 'password_req_digits', label: "Наличие цифр (0-9)" },
        { id: 'password_req_lowercase', label: "Наличие строчных букв (a-z)" },
        { id: 'password_req_uppercase', label: "Наличие заглавных букв (A-Z)" },
        { id: 'password_req_specialChars', label: "Наличие спецсимволов (например, !@#$%)" },
    ],
    input: { id: 'password_minLength', label: "Минимальная длина пароля:", inputType: 'number', defaultValue: 8 },
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
      { id: 'emails', label: "Все email-адреса", icon: AtSign },
      { id: 'urls', label: "Все URL-адреса", icon: Globe },
      { id: 'numbers', label: "Все числа (целые/десятичные)", icon: CaseSensitive }, // Reusing, could be #
      { id: 'quotedText', label: "Текст в кавычках", icon: MessageSquareQuote },
      { id: 'specificWord', label: "Слово/фразу (ввести)", icon: TextCursorInput },
      { id: 'duplicateWords', label: "Повторяющиеся слова", icon: Shuffle },
    ],
    next: (choice: string) => {
      if (['emails', 'urls', 'numbers', 'duplicateWords'].includes(choice)) {
        return 'final_preview';
      }
      if (choice === 'quotedText') return 'extraction_quotedText_type';
      if (choice === 'specificWord') return 'extraction_specificWord_input';
      return 'extraction_whatToExtract';
    }
  },
  extraction_quotedText_type: {
    title: "Извлечение текста в кавычках: Какой тип кавычек?",
    type: 'radio',
    options: [
        { id: 'double', label: 'Двойные кавычки ("...")' },
        { id: 'single', label: "Одинарные кавычки ('...')" }
    ],
    nextStep: 'final_preview'
  },
  extraction_specificWord_input: {
    title: "Извлечение слова/фразы: Введите слово или фразу",
    type: 'inputs',
    inputs: [
        { id: 'specificWord', label: "Искомый текст:", inputType: 'text', defaultValue: '' },
    ],
    autoFocusInputId: 'specificWord',
    nextStep: 'final_preview'
  },
  // --- REPLACEMENT BRANCH ---
  replacement_whatToReplace: {
    title: "Замена/Трансформация: Что нужно заменить?",
    type: 'radio',
    options: [
        { id: 'multipleSpaces', label: "Несколько пробелов → один", icon: Eraser },
        { id: 'tabsToSpaces', label: "Табуляция → пробелы", icon: Eraser },
        { id: 'removeHtml', label: "Удалить HTML-теги", icon: Eraser },
        { id: 'swapParts', label: "Сменить порядок (swap)", icon: Shuffle },
        { id: 'maskDigits', label: "Маскировать цифры", icon: KeyRound }, // Reusing KeyRound
        { id: 'otherReplace', label: "Другое (написать паттерн и замену) (скоро)", icon: Wand2, disabled: true },
    ],
    next: (choice: string) => {
      if (['multipleSpaces', 'tabsToSpaces', 'removeHtml'].includes(choice)) {
        return 'final_preview';
      }
      if (choice === 'maskDigits') return 'replacement_maskDigits_options';
      if (choice === 'swapParts') return 'replacement_swap_input';
      return 'replacement_whatToReplace';
    }
  },
  replacement_maskDigits_options: {
    title: "Маскирование цифр: Сколько последних цифр оставить видимыми?",
    type: 'inputs',
    inputs: [
        { id: 'maskDigits_keepLast', label: "Количество видимых последних цифр:", inputType: 'number', defaultValue: 4 },
    ],
    autoFocusInputId: 'maskDigits_keepLast',
    nextStep: 'final_preview'
  },
  replacement_swap_input: {
    title: "Смена порядка (Swap): Укажите паттерн и замену",
    type: 'inputs',
    inputs: [
      { id: 'swapPattern', label: "Шаблон для поиска с группами захвата:", inputType: 'text', defaultValue: '(\\w+) (\\w+)', placeholder: "например, (.*) - (.*)"},
      { id: 'swapReplacement', label: "Строка замены с использованием групп:", inputType: 'text', defaultValue: '$2 $1', placeholder: "например, $2 - $1"},
    ],
    description: "Используйте круглые скобки () в шаблоне для создания групп захвата. Затем используйте $1, $2 и т.д. в строке замены, чтобы сослаться на эти группы.",
    autoFocusInputId: 'swapPattern',
    nextStep: 'final_preview'
  },
  // --- SPLITTING BRANCH ---
  splitting_delimiter_choice: {
    title: "Разделение текста: По какому символу/шаблону нужно разбить текст?",
    type: 'radio_with_conditional_input',
    options: [
      { id: 'simpleChar', label: "Простой символ (указать)", inputId: 'splittingSimpleChar_input', inputLabel: "Символ-разделитель:", inputPlaceholder: "например, ; или |" },
      { id: 'comma', label: "Запятая (,)" },
      { id: 'space', label: "Пробел(ы) (один или несколько)" },
      { id: 'regex', label: "Регулярное выражение (указать)", inputId: 'splittingRegex_input', inputLabel: "Regex-разделитель:", inputPlaceholder: "например, [,-;]" },
      { id: 'csv', label: "CSV (запятая, с учетом кавычек) (скоро)", disabled: true },
    ],
    nextStep: 'final_preview'
  },
  final_preview: {
    title: "Предпросмотр и добавление",
    type: 'preview',
  }
};


const RegexWizardModal: React.FC<RegexWizardModalProps> = ({ isOpen, onClose, onComplete, initialParentId }) => {
  const [currentStepId, setCurrentStepId] = useState<WizardStepId>('start');
  const [formData, setFormData] = useState<WizardFormData>({});
  const [generatedBlocks, setGeneratedBlocks] = useState<Block[]>([]);
  const [replacementString, setReplacementString] = useState<string | null>(null);


  useEffect(() => {
    if (isOpen) {
        setCurrentStepId('start');
        setFormData({});
        setGeneratedBlocks([]);
        setReplacementString(null);
    }
  }, [isOpen]);

  const currentStepConfig = wizardConfig[currentStepId as keyof typeof wizardConfig];

  const handleCardChoice = (value: string) => { 
    const newFormData: Partial<WizardFormData> = {}; 
    newFormData.mainCategory = value as WizardFormData['mainCategory'];
    setFormData(newFormData as WizardFormData);
  };
  
  const handleRadioChange = (value: string) => {
    const newFormData : Partial<WizardFormData> = { ...formData };
    
    const resetSubsequentFields = (keysToKeep: (keyof WizardFormData)[]) => {
        const currentMainCategory = newFormData.mainCategory;
        const currentValidationType = newFormData.validationTypeChoice;
        const currentStandardFormat = newFormData.standardFormatChoice;
        const currentExtractionChoice = newFormData.extractionChoice;
        const currentReplacementChoice = newFormData.replacementChoice;
        const currentSplittingChoice = newFormData.splittingChoice;
        const currentDateTimeFormat = newFormData.dateFormat;
        const currentIpType = newFormData.ip_type;


        Object.keys(newFormData).forEach(keyStr => {
            const key = keyStr as keyof WizardFormData;
            if (!keysToKeep.includes(key)) {
                 delete (newFormData as any)[key];
            }
        });
        
        if (keysToKeep.includes('mainCategory') && currentMainCategory) newFormData.mainCategory = currentMainCategory;
        if (keysToKeep.includes('validationTypeChoice') && currentValidationType) newFormData.validationTypeChoice = currentValidationType;
        if (keysToKeep.includes('standardFormatChoice') && currentStandardFormat) newFormData.standardFormatChoice = currentStandardFormat;
        if (keysToKeep.includes('extractionChoice') && currentExtractionChoice) newFormData.extractionChoice = currentExtractionChoice;
        if (keysToKeep.includes('replacementChoice') && currentReplacementChoice) newFormData.replacementChoice = currentReplacementChoice;
        if (keysToKeep.includes('splittingChoice') && currentSplittingChoice) newFormData.splittingChoice = currentSplittingChoice;
        if (keysToKeep.includes('dateFormat') && currentDateTimeFormat) newFormData.dateFormat = currentDateTimeFormat;
        if (keysToKeep.includes('ip_type') && currentIpType) newFormData.ip_type = currentIpType;


    };
    
    if (currentStepId === 'start') {
        resetSubsequentFields([]);
        newFormData.mainCategory = value as WizardFormData['mainCategory'];
    } else if (currentStepId === 'validation_type_choice') {
        resetSubsequentFields(['mainCategory']);
        newFormData.validationTypeChoice = value as WizardFormData['validationTypeChoice'];
    } else if (currentStepId === 'validation_standardFormats_what') {
        resetSubsequentFields(['mainCategory','validationTypeChoice']);
        newFormData.standardFormatChoice = value as WizardFormData['standardFormatChoice'];
    } else if (currentStepId === 'validation_dateTime_dateFormat') {
        resetSubsequentFields(['mainCategory','validationTypeChoice']);
        newFormData.dateFormat = value as WizardFormData['dateFormat'];
    } else if (currentStepId === 'extraction_whatToExtract') {
        resetSubsequentFields(['mainCategory']);
        newFormData.extractionChoice = value as WizardFormData['extractionChoice'];
    } else if (currentStepId === 'replacement_whatToReplace') {
        resetSubsequentFields(['mainCategory']);
        newFormData.replacementChoice = value as WizardFormData['replacementChoice'];
    } else if (currentStepId === 'splitting_delimiter_choice') {
        resetSubsequentFields(['mainCategory']);
        newFormData.splittingChoice = value as WizardFormData['splittingChoice'];
    } else if (currentStepId === 'validation_ip_type') {
        resetSubsequentFields(['mainCategory', 'validationTypeChoice', 'standardFormatChoice']);
        newFormData.ip_type = value as WizardFormData['ip_type'];
    }
     else {
       (newFormData as any)[currentStepId as keyof WizardFormData] = value as any;
    }
    
    if (currentStepId === 'validation_standardFormats_url_protocol') newFormData.url_requireProtocol = value as WizardFormData['url_requireProtocol'];
    else if (currentStepId === 'validation_basicPatterns_length') newFormData.basicPattern_restrictLength = value as WizardFormData['basicPattern_restrictLength'];
    else if (currentStepId === 'validation_dateTime_validateTime') newFormData.validateTime = value as WizardFormData['validateTime'];
    else if (currentStepId === 'validation_dateTime_timeFormat') newFormData.timeFormat = value as WizardFormData['timeFormat'];
    else if (currentStepId === 'extraction_quotedText_type') newFormData.quoteType = value as WizardFormData['quoteType'];
    else if (currentStepId === 'validation_phone_countryCode') newFormData.phone_hasCountryCode = value as WizardFormData['phone_hasCountryCode'];
    else if (currentStepId === 'validation_phone_separators') newFormData.phone_allowSeparators = value as WizardFormData['phone_allowSeparators'];
    // else if (currentStepId === 'validation_ip_type') newFormData.ip_type = value as WizardFormData['ip_type']; // Already handled above
    
    setFormData(newFormData as WizardFormData);
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
    if (currentStepId === 'validation_phone_countryCode') return formData.phone_hasCountryCode;
    if (currentStepId === 'validation_phone_separators') return formData.phone_allowSeparators;
    if (currentStepId === 'validation_ip_type') return formData.ip_type;
    if (currentStepId === 'replacement_whatToReplace') return formData.replacementChoice;
    if (currentStepId === 'splitting_delimiter_choice') return formData.splittingChoice;
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


  const generateBlocksForBasicPattern = useCallback((): Block[] => {
    const blocks: Block[] = [];
    let patternChars = '';
    if (formData.basicPattern_contains_digits) patternChars += '\\d';
    if (formData.basicPattern_contains_letters_az) patternChars += 'a-z';
    if (formData.basicPattern_contains_letters_AZ) patternChars += 'A-Z';
    if (formData.basicPattern_contains_space) patternChars += '\\s';
    if (formData.basicPattern_contains_otherChars) {
      patternChars += escapeRegexChars(formData.basicPattern_contains_otherChars);
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



  const generateBlocksForPhone = useCallback((): Block[] => {
    const blocks: Block[] = [createAnchor('^')];
    if (formData.phone_hasCountryCode === 'yes') {
        blocks.push(createLiteral('\\+', true)); 
        blocks.push(createQuantifier('?'));
        blocks.push(createCharClass('\\d', false));
        blocks.push(createQuantifier('{n,m}', 1, 3));
        if (formData.phone_allowSeparators === 'yes') {
          blocks.push(createCharClass(' -', false)); // space and hyphen allowed as separators
          blocks.push(createQuantifier('?'));
        }
    }
    
    const digitPattern = '\\d';
    const separatorPattern = formData.phone_allowSeparators === 'yes' ? '[ -]' : '';
    
    const mainNumberPart: Block[] = [
      createCharClass(digitPattern), 
      createQuantifier(formData.phone_hasCountryCode === 'yes' ? '{6,14}' : '{7,15}'),
    ];

    if (formData.phone_allowSeparators === 'yes' && separatorPattern) {
      // More flexible: allow digits and optional separators throughout
      const digitAndOptionalSep = createSequenceGroup([
          createCharClass(digitPattern),
          createSequenceGroup([createCharClass(separatorPattern.slice(1,-1), false)], 'non-capturing'), // remove [ and ]
          createQuantifier('?')
      ], 'non-capturing');
      blocks.push(digitAndOptionalSep);
      blocks.push(createQuantifier(formData.phone_hasCountryCode === 'yes' ? '{6,14}' : '{7,15}'));

    } else { 
        blocks.push(createCharClass(digitPattern, false));
        blocks.push(createQuantifier(formData.phone_hasCountryCode === 'yes' ? '{6,14}' : '{7,15}'));
    }

    blocks.push(createAnchor('$'));
    return blocks;
  }, [formData.phone_hasCountryCode, formData.phone_allowSeparators]);

  const generateBlocksForIPv4 = useCallback((): Block[] => {
    const octet = "(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)"; 
    const ipv4Regex = `${octet}\\.${octet}\\.${octet}\\.${octet}`;
    return [createAnchor('^'), createLiteral(ipv4Regex, false), createAnchor('$')];
  }, []);
  
  const generateBlocksForIPv6 = useCallback((): Block[] => {
    const ipv6Regex = "(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))";
    return [createAnchor('^'), createLiteral(ipv6Regex, false), createAnchor('$')];
  }, []);

  const generateBlocksForPassword = useCallback((): Block[] => {
    const blocks: Block[] = [createAnchor('^')];
    if (formData.password_req_digits) {
        blocks.push(createLookaround('positive-lookahead', [createCharClass('.*\\d.*', false)])); 
    }
    if (formData.password_req_lowercase) {
        blocks.push(createLookaround('positive-lookahead', [createCharClass('.*[a-z].*', false)]));
    }
    if (formData.password_req_uppercase) {
        blocks.push(createLookaround('positive-lookahead', [createCharClass('.*[A-Z].*', false)]));
    }
    if (formData.password_req_specialChars) {
        blocks.push(createLookaround('positive-lookahead', [createCharClass('.*[\\W_].*', false)])); 
    }
    const minLength = formData.password_minLength !== undefined ? Math.max(1, formData.password_minLength) : 8;
    blocks.push(createCharClass('.', false)); 
    blocks.push(createQuantifier('{n,}', minLength, null));
    blocks.push(createAnchor('$'));
    return blocks;
  }, [formData.password_req_digits, formData.password_req_lowercase, formData.password_req_uppercase, formData.password_req_specialChars, formData.password_minLength]);

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
    const separatorClassBlock = separatorPattern ? createCharClass(separatorPattern.length > 1 ? `[${separatorPattern}]` : separatorPattern, false) : null;


    if (formData.dateFormat === 'ddmmyyyy') {
        blocks.push(createSequenceGroup([createAlternation([ 
            [createLiteral("0", false), createCharClass("1-9", false)],
            [createCharClass("12", false), createCharClass("0-9", false)],
            [createLiteral("3", false), createCharClass("01", false)]
        ])])); 
        if (separatorClassBlock) blocks.push(separatorClassBlock);
        blocks.push(createSequenceGroup([createAlternation([ 
            [createLiteral("0", false), createCharClass("1-9", false)],
            [createLiteral("1", false), createCharClass("012", false)]
        ])])); 
        if (separatorClassBlock) blocks.push(separatorClassBlock);
        blocks.push(createSequenceGroup([ 
            createAlternation([[createLiteral("19", false)], [createLiteral("20", false)]]),
            createCharClass("\\d", false), createQuantifier("{n}", 2, 2)
        ]));
    } else if (formData.dateFormat === 'yyyymmdd') {
         blocks.push(createSequenceGroup([ 
            createAlternation([[createLiteral("19", false)], [createLiteral("20", false)]]),
            createCharClass("\\d", false), createQuantifier("{n}", 2, 2)
        ]));
        if (separatorClassBlock) blocks.push(separatorClassBlock);
        blocks.push(createSequenceGroup([createAlternation([ 
            [createLiteral("0", false), createCharClass("1-9", false)],
            [createLiteral("1", false), createCharClass("012", false)]
        ])]));
        if (separatorClassBlock) blocks.push(separatorClassBlock);
        blocks.push(createSequenceGroup([createAlternation([ 
            [createLiteral("0", false), createCharClass("1-9", false)],
            [createCharClass("12", false), createCharClass("0-9", false)],
            [createLiteral("3", false), createCharClass("01", false)]
        ])]));
    }

    if (formData.validateTime === 'yes') {
        blocks.push(createCharClass("\\s", false)); 
        blocks.push(createQuantifier("?")); 

        if (formData.timeFormat === '24hr') { 
            blocks.push(createSequenceGroup([createAlternation([ 
                [createCharClass("01", false), createCharClass("\\d", false)],
                [createLiteral("2", false), createCharClass("0-3", false)]
            ])]));
            blocks.push(createLiteral(":", false));
            blocks.push(createSequenceGroup([createCharClass("0-5", false), createCharClass("\\d", false)])); 
        } else if (formData.timeFormat === '12hr') { 
            blocks.push(createSequenceGroup([createAlternation([ 
                [createSequenceGroup([createLiteral("0", false), createQuantifier("?")]), createCharClass("1-9", false)],
                [createLiteral("1", false), createCharClass("0-2", false)]
            ])]));
            blocks.push(createLiteral(":", false));
            blocks.push(createSequenceGroup([createCharClass("0-5", false), createCharClass("\\d", false)])); 
            blocks.push(createCharClass("\\s", false)); 
            blocks.push(createQuantifier("?"));
            blocks.push(createSequenceGroup([createAlternation([ 
                [createLiteral("AM", false)], 
                [createLiteral("PM", false)]
            ])], 'non-capturing')); 
        }
    }
    
    blocks.push(createAnchor('$'));
    return blocks;
  }, [formData.dateFormat, formData.dateSeparators, formData.validateTime, formData.timeFormat]);

  const generateBlocksForExtractEmails = useCallback((): Block[] => {
      return generateBlocksForEmail(true);
  }, []); // Removed dependency on generateBlocksForEmail

  const generateBlocksForExtractURLs = useCallback((): Block[] => {
      return generateBlocksForURL(true, false); // For extraction, protocol requirement is less strict
  }, []); // Removed dependency on generateBlocksForURL

  const generateBlocksForExtractNumbers = useCallback((): Block[] => {
    return [
        createAnchor('\\b'),
        createSequenceGroup([ 
            createCharClass('\\d', false),
            createQuantifier('+'),
            createSequenceGroup([
                createLiteral('\\.', false),
                createCharClass('\\d', false),
                createQuantifier('+')
            ], 'non-capturing'),
            createQuantifier('?'), 
        ], 'capturing'),
        createAnchor('\\b')
    ];
  }, []);

  const generateBlocksForQuotedText = useCallback((): Block[] => {
    const quoteChar = formData.quoteType === 'single' ? "'" : '"';
    const escapedQuoteCharPattern = escapeRegexChars(quoteChar);
    const nonQuotePattern = `[^${escapedQuoteCharPattern}]`; 

    return [
        createLiteral(quoteChar, true), 
        createSequenceGroup([ 
            createCharClass(nonQuotePattern, false), 
            createQuantifier('*', undefined, undefined, 'greedy')
        ], 'capturing'), 
        createLiteral(quoteChar, true)
    ];
  }, [formData.quoteType]);

  const generateBlocksForSpecificWord = useCallback((): Block[] => {
    if (!formData.specificWord?.trim()) return [];
    return [
        createAnchor('\\b'),
        createLiteral(formData.specificWord, true), 
        createAnchor('\\b')
    ];
  }, [formData.specificWord]);

  const generateBlocksForDuplicateWords = useCallback((): Block[] => {
    const wordCaptureGroup: Block = createSequenceGroup( 
        [
            createCharClass('\\w', false),
            createQuantifier('+')
        ],
        'capturing' 
    );

    const lookaheadContent: Block[] = [
        createCharClass('.', false), 
        createQuantifier('*'), 
        createAnchor('\\b'),   
        createBackreference(1), 
        createAnchor('\\b')    
    ];

    return [
        createAnchor('\\b'),
        wordCaptureGroup,
        createLookaround('positive-lookahead', lookaheadContent)
    ];
  }, []);

  const generateBlocksForMultipleSpaces = useCallback((): Block[] => {
    return [
        createCharClass('\\s', false),
        createQuantifier('{n,}', 2, null) 
    ];
  }, []);
  
  const generateBlocksForTabsToSpaces = useCallback((): Block[] => {
    return [createLiteral('\\t', false)];
  }, []);
  
  const generateBlocksForRemoveHtmlTags = useCallback((): Block[] => {
    return [
        createLiteral('<', false),
        createCharClass('[^>]', false), 
        createQuantifier('*'),   
        createLiteral('>', false)
    ];
  }, []);

  const generateBlocksForMaskDigits = useCallback((): Block[] => {
    const keepLastN = formData.maskDigits_keepLast !== undefined ? Math.max(0, formData.maskDigits_keepLast) : 4;
    return [
        createLiteral("\\d", false), 
        createLookaround("positive-lookahead", [ 
            createLiteral(`\\d{${keepLastN}}`, false) 
        ])
    ];
  }, [formData.maskDigits_keepLast]);

  const generateBlocksForSwapParts = useCallback((): Block[] => {
    if (!formData.swapPattern?.trim()) return [];
    return [createLiteral(formData.swapPattern, false)];
  }, [formData.swapPattern]);


  const generateBlocksForSplitting = useCallback((): Block[] => {
    switch(formData.splittingChoice) {
        case 'comma':
            return [createLiteral(',', false)]; 
        case 'space':
            return [createCharClass('\\s', false), createQuantifier('+')];
        case 'simpleChar':
            if (formData.splittingSimpleChar_input && formData.splittingSimpleChar_input.trim()) {
                return [createLiteral(formData.splittingSimpleChar_input.trim(), true)]; 
            }
            return [];
        case 'regex':
            if (formData.splittingRegex_input && formData.splittingRegex_input.trim()) {
                return [createLiteral(formData.splittingRegex_input.trim(), false)]; 
            }
            return [];
        default:
            return [];
    }
  }, [formData.splittingChoice, formData.splittingSimpleChar_input, formData.splittingRegex_input]);


  const handleNext = () => {
    if (!currentStepConfig) return;
    setReplacementString(null); 
    setGeneratedBlocks([]);

    if (currentStepId === 'final_preview') {
        if (generatedBlocks.length > 0 || (formData.mainCategory === 'replacement' && replacementString)) {
          onComplete(generatedBlocks, initialParentId); 
        }
        return;
    }
    
    let nextStepTargetId: WizardStepId | undefined = undefined;
    let choice: string | undefined = getRadioValue(); 

    if ('next' in currentStepConfig && typeof currentStepConfig.next === 'function') {
      if (choice) {
        nextStepTargetId = currentStepConfig.next(choice) as WizardStepId;
      } else if (currentStepConfig.type === 'radio' && !choice && !currentStepConfig.options?.find(o => o.id === getRadioValue())?.disabled) {
          console.warn("Wizard: No choice made on radio step", currentStepId);
          return; 
      }
    } else if ('nextStep' in currentStepConfig) {
      nextStepTargetId = currentStepConfig.nextStep as WizardStepId;
    }
    
    if (nextStepTargetId === 'final_preview') {
        let blocksToSet: Block[] = [];
        if(formData.mainCategory === 'validation'){
            if(formData.validationTypeChoice === 'basic'){
                 blocksToSet = generateBlocksForBasicPattern();
            } else if (formData.validationTypeChoice === 'standard') {
                if(formData.standardFormatChoice === 'email') blocksToSet = generateBlocksForEmail(false);
                else if (formData.standardFormatChoice === 'url') blocksToSet = generateBlocksForURL(false, formData.url_requireProtocol === 'yes');
                else if (formData.standardFormatChoice === 'phone') blocksToSet = generateBlocksForPhone();
                else if (formData.standardFormatChoice === 'ip') {
                    if (formData.ip_type === 'ipv4') blocksToSet = generateBlocksForIPv4();
                    else if (formData.ip_type === 'ipv6') blocksToSet = generateBlocksForIPv6();
                    else blocksToSet = [];
                } else if (formData.standardFormatChoice === 'password') blocksToSet = generateBlocksForPassword();
                else blocksToSet = []; 
            } else if (formData.validationTypeChoice === 'datetime') {
                blocksToSet = generateBlocksForDateTime();
            }
             else blocksToSet = [];
        } else if (formData.mainCategory === 'extraction') {
            if (formData.extractionChoice === 'emails') blocksToSet = generateBlocksForExtractEmails();
            else if (formData.extractionChoice === 'urls') blocksToSet = generateBlocksForExtractURLs();
            else if (formData.extractionChoice === 'numbers') blocksToSet = generateBlocksForExtractNumbers();
            else if (formData.extractionChoice === 'quotedText') blocksToSet = generateBlocksForQuotedText();
            else if (formData.extractionChoice === 'specificWord') blocksToSet = generateBlocksForSpecificWord();
            else if (formData.extractionChoice === 'duplicateWords') blocksToSet = generateBlocksForDuplicateWords();
            else blocksToSet = [];
        } else if (formData.mainCategory === 'replacement') {
            if (formData.replacementChoice === 'multipleSpaces') {
                 blocksToSet = generateBlocksForMultipleSpaces();
                 setReplacementString(" (один пробел)");
            } else if (formData.replacementChoice === 'tabsToSpaces') {
                 blocksToSet = generateBlocksForTabsToSpaces();
                 setReplacementString(" (один или несколько пробелов, по вашему выбору)");
            } else if (formData.replacementChoice === 'removeHtml') {
                 blocksToSet = generateBlocksForRemoveHtmlTags();
                 setReplacementString(" (пустая строка)");
            } else if (formData.replacementChoice === 'maskDigits') {
                 blocksToSet = generateBlocksForMaskDigits();
                 setReplacementString(" (символ маски, например 'X' или '*')");
            } else if (formData.replacementChoice === 'swapParts') {
                blocksToSet = generateBlocksForSwapParts();
                setReplacementString(formData.swapReplacement || "$2 $1 (пример)");
            }
            else blocksToSet = [];
        } else if (formData.mainCategory === 'splitting') {
            blocksToSet = generateBlocksForSplitting();
        }
         else {
            blocksToSet = []; 
        }
        setGeneratedBlocks(blocksToSet);
    }

    if (nextStepTargetId) {
      setCurrentStepId(nextStepTargetId);
    } else {
      console.warn("Wizard: No next step defined for", currentStepId, "with choice", choice);
    }
  };

  const handleBack = () => {
    let prevStep: WizardStepId | null = null;
    setGeneratedBlocks([]); 
    setReplacementString(null);
    
    switch (currentStepId) {
        case 'validation_type_choice': 
        case 'extraction_whatToExtract': 
        case 'replacement_whatToReplace':
        case 'splitting_delimiter_choice':
            prevStep = 'start'; break;

        case 'validation_basicPatterns_what': prevStep = 'validation_type_choice'; break;
        case 'validation_basicPatterns_length': prevStep = 'validation_basicPatterns_what'; break;
        case 'validation_basicPatterns_length_specify': prevStep = 'validation_basicPatterns_length'; break;
        
        case 'validation_standardFormats_what': prevStep = 'validation_type_choice'; break;
        case 'validation_standardFormats_url_protocol': prevStep = 'validation_standardFormats_what'; break;
        case 'validation_phone_countryCode': prevStep = 'validation_standardFormats_what'; break;
        case 'validation_phone_separators': prevStep = 'validation_phone_countryCode'; break;
        case 'validation_ip_type': prevStep = 'validation_standardFormats_what'; break;
        case 'validation_password_requirements': prevStep = 'validation_standardFormats_what'; break;
        
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
        
        case 'replacement_maskDigits_options': prevStep = 'replacement_whatToReplace'; break;
        case 'replacement_swap_input': prevStep = 'replacement_whatToReplace'; break;


        case 'final_preview':
            if (formData.mainCategory === 'validation') {
                if (formData.validationTypeChoice === 'basic') {
                    prevStep = formData.basicPattern_restrictLength === 'yes' ? 'validation_basicPatterns_length_specify' : 'validation_basicPatterns_length';
                } else if (formData.validationTypeChoice === 'standard') {
                    if (formData.standardFormatChoice === 'email') prevStep = 'validation_standardFormats_what';
                    else if (formData.standardFormatChoice === 'url') prevStep = 'validation_standardFormats_url_protocol';
                    else if (formData.standardFormatChoice === 'phone') prevStep = 'validation_phone_separators';
                    else if (formData.standardFormatChoice === 'ip') prevStep = 'validation_ip_type';
                    else if (formData.standardFormatChoice === 'password') prevStep = 'validation_password_requirements';
                    else prevStep = 'validation_standardFormats_what'; 
                } else if (formData.validationTypeChoice === 'datetime') {
                    if (formData.validateTime === 'yes') prevStep = 'validation_dateTime_timeFormat';
                    else prevStep = 'validation_dateTime_validateTime';
                }
                 else prevStep = 'validation_type_choice'; 
            } else if (formData.mainCategory === 'extraction') {
                 if (formData.extractionChoice === 'quotedText') prevStep = 'extraction_quotedText_type';
                 else if (formData.extractionChoice === 'specificWord') prevStep = 'extraction_specificWord_input';
                 else if (['emails', 'urls', 'numbers', 'duplicateWords'].includes(formData.extractionChoice || '')) prevStep = 'extraction_whatToExtract';
                 else prevStep = 'extraction_whatToExtract';
            } else if (formData.mainCategory === 'replacement') {
                if (formData.replacementChoice === 'maskDigits') prevStep = 'replacement_maskDigits_options';
                else if (formData.replacementChoice === 'swapParts') prevStep = 'replacement_swap_input';
                else if (['multipleSpaces', 'tabsToSpaces', 'removeHtml'].includes(formData.replacementChoice || '')) prevStep = 'replacement_whatToReplace';
                else prevStep = 'replacement_whatToReplace';
            } else if (formData.mainCategory === 'splitting') {
                prevStep = 'splitting_delimiter_choice';
            }
            else prevStep = 'start'; 
            break;
        default: prevStep = 'start';
    }
    
    if (prevStep) setCurrentStepId(prevStep);
    else setCurrentStepId('start'); 
  };

  const resetWizardAndClose = () => {
    setCurrentStepId('start');
    setFormData({});
    setGeneratedBlocks([]);
    setReplacementString(null);
    onClose();
  }

  const isNextDisabled = () => {
    const currentChoice = getRadioValue();
    if (currentStepConfig.type === 'radio' && !currentChoice) {
      if (currentStepConfig.options?.every(opt => opt.disabled)) return false;
      return true;
    }
    if (currentStepConfig.type === 'radio' && currentStepConfig.options) {
        const selectedOption = currentStepConfig.options.find(opt => opt.id === currentChoice);
        if (selectedOption?.disabled) return true;
    }
     if (currentStepConfig.type === 'radio_with_conditional_input' && !currentChoice) {
      if (currentStepConfig.options?.every(opt => opt.disabled)) return false;
      return true;
    }
    if (currentStepConfig.type === 'radio_with_conditional_input' && currentStepConfig.options) {
        const selectedOption = currentStepConfig.options.find(opt => opt.id === currentChoice);
        if (selectedOption?.disabled) return true;
        if (selectedOption && selectedOption.inputId && !formData[selectedOption.inputId as keyof WizardFormData]?.toString().trim()) {
            return true; 
        }
    }

    if (currentStepId === 'validation_dateTime_separators' && (!formData.dateSeparators || formData.dateSeparators.length === 0)) {
        return true; 
    }
    if (currentStepId === 'extraction_specificWord_input' && !formData.specificWord?.trim()) {
        return true;
    }
    if (currentStepId === 'replacement_maskDigits_options' && (formData.maskDigits_keepLast === undefined || formData.maskDigits_keepLast < 0)) {
        return true;
    }
     if (currentStepId === 'replacement_swap_input' && (!formData.swapPattern?.trim() || !formData.swapReplacement?.trim())) {
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
      <DialogContent className="sm:max-w-xl md:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{currentStepConfig.title}</DialogTitle>
          {currentStepConfig.description && (
            <DialogDescription>{currentStepConfig.description}</DialogDescription>
          )}
        </DialogHeader>
        
        <ScrollArea className="flex-1 pr-4 -mr-4 py-2">
          <div className="space-y-6">
            {currentStepConfig.type === 'card_choice' && currentStepConfig.options && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {currentStepConfig.options.map(opt => (
                        <Button
                            key={opt.id}
                            variant="outline"
                            className={cn(
                                "flex-col h-auto p-4 items-start text-left space-y-1 transition-all",
                                formData.mainCategory === opt.id && "ring-2 ring-primary bg-accent text-accent-foreground",
                                opt.disabled && "opacity-50 cursor-not-allowed"
                            )}
                            onClick={() => !opt.disabled && handleCardChoice(opt.id)}
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
            {currentStepConfig.type === 'radio' && currentStepConfig.options && (
              <RadioGroup 
                value={getRadioValue()} 
                onValueChange={handleRadioChange}
              >
                {currentStepConfig.options.map(opt => (
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
            
            {currentStepConfig.type === 'radio_with_conditional_input' && currentStepConfig.options && (
              <RadioGroup 
                value={getRadioValue()} 
                onValueChange={handleRadioChange}
                className="space-y-3"
              >
                {currentStepConfig.options.map(opt => (
                  <div key={opt.id} className={cn("p-2 border rounded-md hover:bg-muted/50 has-[:checked]:bg-accent/20 has-[:checked]:border-accent data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed", opt.disabled && "opacity-50 cursor-not-allowed")} data-disabled={opt.disabled ? "true" : undefined}>
                    <div className="flex items-center space-x-2 ">
                        <RadioGroupItem value={opt.id} id={`${currentStepId}-${opt.id}`} disabled={opt.disabled}/>
                        <Label htmlFor={`${currentStepId}-${opt.id}`} className={`flex-1 py-1 text-sm ${opt.disabled ? 'cursor-not-allowed text-muted-foreground' : 'cursor-pointer'}`}>
                        {opt.label}
                        {opt.disabled && <span className="text-xs text-muted-foreground ml-2">(скоро)</span>}
                        </Label>
                    </div>
                    {opt.inputId && getRadioValue() === opt.id && !opt.disabled && (
                        <div className="mt-2 pl-6">
                            {opt.inputLabel && <Label htmlFor={`${currentStepId}-${opt.inputId}`} className="text-xs text-muted-foreground mb-1 block">{opt.inputLabel}</Label>}
                            <Input
                                id={`${currentStepId}-${opt.inputId}`}
                                type={opt.inputType || 'text'}
                                value={formData[opt.inputId as keyof WizardFormData] as string || ''}
                                onChange={(e) => handleInputChange(opt.inputId!, e.target.value)}
                                placeholder={opt.inputPlaceholder}
                                className="h-9 text-sm"
                                autoFocus
                            />
                        </div>
                    )}
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
              </div>
            )}

            {currentStepConfig.type === 'checkbox_with_input' && currentStepConfig.checkboxes && currentStepConfig.conditionalInput && (
                <div className="space-y-3">
                    {currentStepConfig.checkboxes.map(cb => (
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
                      placeholder={input.placeholder}
                      autoFocus={currentStepConfig.autoFocusInputId === input.id}
                    />
                  </div>
                ))}
                 {currentStepConfig.description && (
                    <p className="text-xs text-muted-foreground">{currentStepConfig.description}</p>
                )}
              </div>
            )}

            {currentStepConfig.type === 'checkbox_and_input' && currentStepConfig.checkboxes && currentStepConfig.input && (
                <div className="space-y-3">
                    {currentStepConfig.checkboxes.map(cb => (
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
                    <div className="mt-4">
                        <Label htmlFor={`${currentStepId}-${currentStepConfig.input.id}`} className="text-sm font-medium">
                        {currentStepConfig.input.label}
                        </Label>
                        <Input 
                        id={`${currentStepId}-${currentStepConfig.input.id}`}
                        type={currentStepConfig.input.inputType}
                        value={String(formData[currentStepConfig.input.id as keyof WizardFormData] ?? currentStepConfig.input.defaultValue ?? '8')}
                        onChange={(e) => handleInputChange(currentStepConfig.input.id, currentStepConfig.input.inputType === 'number' ? parseInt(e.target.value) || 0 : e.target.value)}
                        className="mt-1 h-9"
                        min={currentStepConfig.input.inputType === 'number' ? "1" : undefined}
                        />
                    </div>
                </div>
            )}


            {currentStepId === 'final_preview' && (
                <div className="space-y-3">
                    <Label className="text-sm font-medium">Сгенерированные блоки Regex для поиска:</Label>
                    {generatedBlocks.length > 0 ? (
                        <Card className="p-3 bg-muted/50 max-h-60 overflow-y-auto">
                            <div className="text-xs font-mono whitespace-pre-wrap space-y-1">
                                {generatedBlocks.map(b => {
                                    let display = `${BLOCK_CONFIGS[b.type]?.name || b.type}`;
                                    if (b.type === BlockType.LITERAL) display += `: "${(b.settings as LiteralSettings).text}"`;
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
                                        else if (child.type === BlockType.QUANTIFIER) {
                                            const qs = child.settings as QuantifierSettings;
                                            childDisplay += `: ${qs.type}`;
                                            if (qs.min !== undefined) childDisplay += ` (min: ${qs.min}`;
                                            if (qs.max !== undefined && qs.max !== null) childDisplay += `, max: ${qs.max}`;
                                            if (qs.min !== undefined) childDisplay += `)`;
                                            if (qs.mode) childDisplay += `, ${qs.mode}`;
                                        }
                                        else if (child.type === BlockType.ANCHOR) childDisplay += `: ${(child.settings as AnchorSettings).type}`;
                                        else if (child.type === BlockType.GROUP) {
                                            childDisplay += `: (${(child.settings as GroupSettings).type || 'capturing'})`;
                                            if((child.settings as GroupSettings).name) childDisplay += ` ?<${(child.settings as GroupSettings).name}>`;
                                        }
                                         else if (child.type === BlockType.LOOKAROUND) childDisplay += `: (${(child.settings as LookaroundSettings).type})`;
                                         else if (child.type === BlockType.BACKREFERENCE) childDisplay += `: \\${(child.settings as BackreferenceSettings).ref}`;
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
                        <p className="text-sm text-muted-foreground">Нет блоков для отображения. Возможно, этот путь Мастера еще не полностью реализован, не все параметры были выбраны, или выбранная опция помечена как "(скоро)".</p>
                    )}
                    {replacementString && (
                        <div className="mt-2">
                             <Label className="text-sm font-medium">Рекомендуемая строка для замены:</Label>
                             <p className="text-xs font-mono p-2 bg-muted/50 rounded-md">{replacementString}</p>
                        </div>
                    )}
                    <Alert>
                        <Lightbulb className="h-4 w-4" />
                        <AlertTitle>Подсказка</AlertTitle>
                        <AlertDescription>
                            Это базовый набор блоков. После добавления вы сможете их детальнее настроить, сгруппировать или добавить другие элементы в основном редакторе. 
                            {formData.mainCategory === 'extraction' && " Для сценариев извлечения часто используется флаг 'g' (глобальный поиск), который можно установить в панели вывода Regex."}
                            {formData.mainCategory === 'replacement' && " Для сценариев замены, мастер предлагает паттерн для поиска; сама операция замены выполняется средствами вашего языка программирования или текстового редактора."}
                            {formData.mainCategory === 'splitting' && " Для сценариев разделения, этот паттерн обычно используется с функцией `split()` вашего языка программирования."}
                            Для проверки паролей и IP-адресов, имеющих сложную структуру, Мастер может предложить один блок 'Литерал', содержащий всё регулярное выражение.
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



