
"use client";
import React, { useState, useCallback, useEffect } from 'react';
import type { Block, QuantifierSettings, CharacterClassSettings, GroupSettings, LiteralSettings, AnchorSettings, BackreferenceSettings, LookaroundSettings } from './types';
import { BlockType } from './types';
import { BLOCK_CONFIGS } from './constants'; // .tsx removed

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
import { Lightbulb, CheckSquare, TextCursorInput, Replace, Eraser, Split, Wand2, Phone, AtSign, Globe, KeyRound, Shuffle, MessageSquareQuote, CaseSensitive, SearchCheck, Route, Workflow, FileText, CalendarClock, BadgeCheck, AlignLeft, Calculator, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { generateId, createAnchor, createLiteral, createCharClass, createQuantifier, createSequenceGroup, createAlternation, createLookaround, createBackreference, escapeRegexChars, generateBlocksForEmail, generateBlocksForURL, generateBlocksForIPv4, generateBlocksForIPv6, generateBlocksForDuplicateWords, generateBlocksForMultipleSpaces, generateBlocksForTabsToSpaces, generateBlocksForNumbers } from './utils';


interface RegexWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (blocks: Block[], parentId?: string | null) => void;
  initialParentId: string | null;
}

type WizardStepId =
  | 'start'
  // AI Assistant specific step
  | 'ai_natural_language_input'
  // Original wizard steps (can be part of AI assistant as guided mode)
  | 'validation_type_choice'
  | 'validation_basicPatterns_what'
  | 'validation_basicPatterns_length'
  | 'validation_basicPatterns_length_specify'
  | 'validation_standardFormats_what'
  | 'validation_standardFormats_url_protocol'
  | 'validation_standardFormats_ip_type'
  | 'validation_phone_countryCode'
  | 'validation_phone_separators'
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
  // For AI Assistant
  naturalLanguageQuery?: string;
  
  // For original wizard logic
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
  phone_hasCountryCode?: 'yes' | 'no';
  phone_allowSeparators?: 'yes' | 'no';
  password_req_digits?: boolean;
  password_req_lowercase?: boolean;
  password_req_uppercase?: boolean;
  password_req_specialChars?: boolean;
  password_minLength?: number;

  dateFormat?: 'ddmmyyyy' | 'yyyymmdd' | 'other_date';
  dateSeparators?: ('slash' | 'hyphen' | 'dot')[];
  validateTime?: 'yes' | 'no';
  timeFormat?: '24hr' | '12hr';

  extractionChoice?: 'emails' | 'urls' | 'numbers' | 'quotedText' | 'specificWord' | 'duplicateWords';
  quoteType?: 'single' | 'double';
  specificWord?: string;

  replacementChoice?: 'multipleSpaces' | 'tabsToSpaces' | 'removeHtml' | 'swapParts' | 'maskDigits' | 'otherReplace';
  maskDigits_keepLast?: number;
  swapPattern?: string;
  swapReplacement?: string;

  splittingChoice?: 'simpleChar' | 'comma' | 'space' | 'regex' | 'csv';
  splittingSimpleChar_input?: string;
  splittingRegex_input?: string;
}


const wizardConfig = {
  start: {
    title: "AI Помощник RegexVision Pro",
    description: "Как вы хотите создать регулярное выражение?",
    type: 'card_choice',
    options: [
      { id: 'ai_assisted', label: "Ввести запрос на естественном языке", description: "Опишите, что вы хотите найти, и AI предложит варианты.", icon: Sparkles },
      { id: 'validation', label: "Проверить Формат (по шагам)", description: "Валидация email, URL, дат и т.д.", icon: CheckSquare},
      { id: 'extraction', label: "Найти и Извлечь (по шагам)", description: "Извлечение email, чисел, текста в кавычках.", icon: SearchCheck },
      { id: 'replacement', label: "Заменить / Изменить (по шагам)", description: "Удаление пробелов, маскирование, замена.", icon: Replace },
      { id: 'splitting', label: "Разделить Текст (по шагам)", description: "Разбивка по запятой, пробелу, символу.", icon: Split },
    ],
    next: (choice: string) => {
      if (choice === 'ai_assisted') return 'ai_natural_language_input';
      if (choice === 'validation') return 'validation_type_choice';
      if (choice === 'extraction') return 'extraction_whatToExtract';
      if (choice === 'replacement') return 'replacement_whatToReplace';
      if (choice === 'splitting') return 'splitting_delimiter_choice';
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
    nextStep: 'final_preview', // This will eventually trigger AI generation
    autoFocusInputId: 'naturalLanguageQuery'
  },
  validation_type_choice: {
    title: "Валидация: Какой тип проверки вам нужен?",
    type: 'radio',
    options: [
      { id: 'basic', label: "Простые шаблоны (цифры, буквы, длина и т.д.)", icon: FileText },
      { id: 'standard', label: "Стандартные форматы (Email, URL, Телефон, IP, Пароль)", icon: BadgeCheck },
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
      { id: 'phone', label: "Телефон", icon: Phone, disabled: true },
      { id: 'ip', label: "IP-адрес (IPv4/IPv6)", icon: Route, disabled: false },
      { id: 'password', label: "Пароль (проверка сложности)", icon: KeyRound, disabled: true },
    ],
    next: (choice: string) => {
      if (choice === 'email') return 'final_preview';
      if (choice === 'url') return 'validation_standardFormats_url_protocol';
      if (choice === 'phone') return 'validation_phone_countryCode';
      if (choice === 'ip') return 'validation_standardFormats_ip_type';
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
  validation_standardFormats_ip_type: {
    title: "Проверка IP-адреса: Какой тип IP-адреса?",
    type: 'radio',
    options: [
        { id: 'ipv4', label: "IPv4 (например, 192.168.0.1)" },
        { id: 'ipv6', label: "IPv6 (например, 2001:0db8:...)"},
    ],
    next: (choice: string) => {
        if (choice === 'ipv4' || choice === 'ipv6') return 'final_preview';
        return 'validation_standardFormats_ip_type';
    }
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
  extraction_whatToExtract: {
    title: "Извлечение/Поиск: Что нужно найти в тексте?",
    type: 'radio',
    options: [
      { id: 'emails', label: "Все email-адреса", icon: AtSign },
      { id: 'urls', label: "Все URL-адреса", icon: Globe },
      { id: 'numbers', label: "Все числа (целые/десятичные)", icon: Calculator, disabled: false },
      { id: 'quotedText', label: "Текст в кавычках", icon: MessageSquareQuote, disabled: true },
      { id: 'specificWord', label: "Слово/фразу (ввести)", icon: TextCursorInput, disabled: true },
      { id: 'duplicateWords', label: "Повторяющиеся слова", icon: Shuffle, disabled: false },
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
  replacement_whatToReplace: {
    title: "Замена/Трансформация: Что нужно заменить?",
    type: 'radio',
    options: [
        { id: 'multipleSpaces', label: "Несколько пробелов → один", icon: Eraser },
        { id: 'tabsToSpaces', label: "Табуляция → пробелы", icon: AlignLeft },
        { id: 'removeHtml', label: "Удалить HTML-теги", icon: Eraser, disabled: true },
        { id: 'swapParts', label: "Сменить порядок (swap)", icon: Shuffle, disabled: true },
        { id: 'maskDigits', label: "Маскировать цифры", icon: KeyRound, disabled: true },
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
    title: "Результат Помощника",
    type: 'preview',
  }
};


const RegexWizardModal: React.FC<RegexWizardModalProps> = ({ isOpen, onClose, onComplete, initialParentId }) => {
  const [currentStepId, setCurrentStepId] = useState<WizardStepId>('start');
  const [formData, setFormData] = useState<WizardFormData>({});
  const [generatedBlocks, setGeneratedBlocks] = useState<Block[]>([]);
  const [replacementString, setReplacementString] = useState<string | null>(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false); // For AI interaction

  useEffect(() => {
    if (isOpen) {
        setCurrentStepId('start');
        setFormData({});
        setGeneratedBlocks([]);
        setReplacementString(null);
        setIsLoadingAI(false);
    }
  }, [isOpen]);

  const currentStepConfig = wizardConfig[currentStepId as keyof typeof wizardConfig];

  const handleRadioChange = (value: string) => {
    const newFormData : Partial<WizardFormData> = { ...formData };

    const resetSubsequentFields = (keysToKeep: (keyof WizardFormData)[]) => {
        const currentMainCategory = newFormData.mainCategory;
        // ... (keep existing logic for resetting fields based on mainCategory and other high-level choices)
        Object.keys(newFormData).forEach(keyStr => {
            const key = keyStr as keyof WizardFormData;
            if (!keysToKeep.includes(key)) {
                 delete (newFormData as any)[key];
            }
        });
        if (keysToKeep.includes('mainCategory') && currentMainCategory) newFormData.mainCategory = currentMainCategory;
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
    } else if (currentStepId === 'validation_standardFormats_ip_type') {
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

    setFormData(newFormData as WizardFormData);
  };

  const getRadioValue = () => {
    if (currentStepId === 'start') return formData.mainCategory;
    if (currentStepId === 'validation_type_choice') return formData.validationTypeChoice;
    if (currentStepId === 'validation_standardFormats_what') return formData.standardFormatChoice;
    if (currentStepId === 'validation_standardFormats_url_protocol') return formData.url_requireProtocol;
    if (currentStepId === 'validation_standardFormats_ip_type') return formData.ip_type;
    if (currentStepId === 'validation_basicPatterns_length') return formData.basicPattern_restrictLength;
    if (currentStepId === 'validation_dateTime_dateFormat') return formData.dateFormat;
    if (currentStepId === 'validation_dateTime_validateTime') return formData.validateTime;
    if (currentStepId === 'validation_dateTime_timeFormat') return formData.timeFormat;
    if (currentStepId === 'extraction_whatToExtract') return formData.extractionChoice;
    if (currentStepId === 'extraction_quotedText_type') return formData.quoteType;
    if (currentStepId === 'validation_phone_countryCode') return formData.phone_hasCountryCode;
    if (currentStepId === 'validation_phone_separators') return formData.phone_allowSeparators;
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

  const generateBlocksFromFormData = useCallback((): Block[] => {
    if(formData.mainCategory === 'validation'){
        if(formData.validationTypeChoice === 'basic'){
             return generateBlocksForBasicPattern();
        } else if (formData.validationTypeChoice === 'standard') {
            if(formData.standardFormatChoice === 'email') return generateBlocksForEmail(false);
            if (formData.standardFormatChoice === 'url') return generateBlocksForURL(false, formData.url_requireProtocol === 'yes');
            // if (formData.standardFormatChoice === 'phone') return generateBlocksForPhone(); // Disabled
            if (formData.standardFormatChoice === 'ip') {
                if (formData.ip_type === 'ipv4') return generateBlocksForIPv4();
                if (formData.ip_type === 'ipv6') return generateBlocksForIPv6();
                return [];
            }
            // if (formData.standardFormatChoice === 'password') return generateBlocksForPassword(); // Disabled
            return [];
        }
        // if (formData.validationTypeChoice === 'datetime') return generateBlocksForDateTime(); // Disabled
         return [];
    } else if (formData.mainCategory === 'extraction') {
        if (formData.extractionChoice === 'emails') return generateBlocksForEmail(true);
        if (formData.extractionChoice === 'urls') return generateBlocksForURL(true, false);
        if (formData.extractionChoice === 'numbers') return generateBlocksForNumbers();
        // if (formData.extractionChoice === 'quotedText') return generateBlocksForQuotedText(); // Disabled
        // if (formData.extractionChoice === 'specificWord') return generateBlocksForSpecificWord(); // Disabled
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
        // Other replacement types are disabled or need specific handling
        return [];
    }
    // if (formData.mainCategory === 'splitting') return generateBlocksForSplitting(); // Disabled
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


  const handleNext = async () => {
    if (!currentStepConfig) return;
    setReplacementString(null);
    setGeneratedBlocks([]);
    setIsLoadingAI(false);

    if (currentStepId === 'final_preview') {
        if (generatedBlocks.length > 0 || (formData.mainCategory === 'replacement' && replacementString)) {
          onComplete(generatedBlocks, initialParentId);
        }
        return;
    }

    let nextStepTargetId: WizardStepId | undefined = undefined;
    let choice: string | undefined = getRadioValue();

    if (currentStepId === 'ai_natural_language_input' && formData.naturalLanguageQuery) {
        setIsLoadingAI(true);
        // TODO: Implement actual AI call here using Genkit flow
        // For now, simulate with a placeholder and go to preview
        try {
            // const aiResult = await callGenkitFlow(formData.naturalLanguageQuery);
            // const parsedBlocks = parseRegexToBlocks(aiResult.regex); // This is a complex function to write
            // setGeneratedBlocks(parsedBlocks);
            // For demo purposes:
            await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API call
            const placeholderRegex = formData.naturalLanguageQuery.toLowerCase().includes("email") ? 
                                     generateBlocksForEmail(true) : 
                                     [createLiteral(formData.naturalLanguageQuery, true)]; // Very basic placeholder
            setGeneratedBlocks(placeholderRegex);

        } catch (error) {
            console.error("AI Regex Generation Error:", error);
            setGeneratedBlocks([createLiteral("Ошибка AI-генерации", false)]);
        } finally {
            setIsLoadingAI(false);
        }
        nextStepTargetId = 'final_preview';

    } else if ('next' in currentStepConfig && typeof currentStepConfig.next === 'function') {
      if (choice) {
        nextStepTargetId = currentStepConfig.next(choice) as WizardStepId;
      } else if (currentStepConfig.type === 'radio' && !choice && !currentStepConfig.options?.find(o => o.id === getRadioValue())?.disabled) {
          console.warn("Wizard: No choice made on radio step", currentStepId);
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
    } else {
      console.warn("Wizard: No next step defined for", currentStepId, "with choice", choice);
    }
  };

  const handleBack = () => {
    let prevStep: WizardStepId | null = null;
    setGeneratedBlocks([]);
    setReplacementString(null);
    setIsLoadingAI(false);

    if (currentStepId === 'ai_natural_language_input') {
        prevStep = 'start';
    } else if (currentStepId === 'final_preview') {
        if (formData.mainCategory === 'ai_assisted') {
            prevStep = 'ai_natural_language_input';
        } else if (formData.mainCategory === 'validation') {
            if (formData.validationTypeChoice === 'basic') {
                prevStep = formData.basicPattern_restrictLength === 'yes' ? 'validation_basicPatterns_length_specify' : 'validation_basicPatterns_length';
            } else if (formData.validationTypeChoice === 'standard') {
                if (formData.standardFormatChoice === 'email') prevStep = 'validation_standardFormats_what';
                else if (formData.standardFormatChoice === 'url') prevStep = 'validation_standardFormats_url_protocol';
                else if (formData.standardFormatChoice === 'ip') prevStep = 'validation_standardFormats_ip_type';
                else prevStep = 'validation_standardFormats_what';
            }
             else prevStep = 'validation_type_choice';
        } else if (formData.mainCategory === 'extraction') {
             if (['emails', 'urls', 'numbers', 'duplicateWords'].includes(formData.extractionChoice || '')) prevStep = 'extraction_whatToExtract';
             else prevStep = 'extraction_whatToExtract';
        } else if (formData.mainCategory === 'replacement') {
            if (['multipleSpaces', 'tabsToSpaces'].includes(formData.replacementChoice || '')) prevStep = 'replacement_whatToReplace';
            else prevStep = 'replacement_whatToReplace';
        }
        else prevStep = 'start'; // Fallback to start for other main categories
    } else {
        // Existing back logic for non-final_preview, non-AI steps
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
            case 'validation_standardFormats_ip_type': prevStep = 'validation_standardFormats_what'; break;
            
            default: prevStep = 'start';
        }
    }


    if (prevStep) setCurrentStepId(prevStep);
    else setCurrentStepId('start');
  };

  const resetWizardAndClose = () => {
    setCurrentStepId('start');
    setFormData({});
    setGeneratedBlocks([]);
    setReplacementString(null);
    setIsLoadingAI(false);
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

    if (currentStepId === 'ai_natural_language_input' && !formData.naturalLanguageQuery?.trim()) {
        return true;
    }

    if (currentStepId === 'final_preview') {
        if (isLoadingAI) return true;
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
                    {input.inputType === 'textarea' ? (
                        <textarea
                            id={`${currentStepId}-${input.id}`}
                            value={formData[input.id as keyof WizardFormData] as string || (input.defaultValue !== undefined ? String(input.defaultValue) : '')}
                            onChange={(e) => handleInputChange(input.id, e.target.value)}
                            className="mt-1 h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
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
                    {isLoadingAI && (
                        <div className="flex flex-col items-center justify-center p-4 text-muted-foreground">
                           <Sparkles size={32} className="animate-pulse text-primary mb-2" />
                           <p>AI генерирует выражение...</p>
                        </div>
                    )}
                    {!isLoadingAI && (
                        <>
                           <Label className="text-sm font-medium">
                             {formData.mainCategory === 'ai_assisted' ? "Предложенные AI блоки:" : "Сгенерированные блоки Regex:"}
                           </Label>
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
                                <p className="text-sm text-muted-foreground">
                                    {formData.mainCategory === 'ai_assisted' ? 
                                        "AI не смог сгенерировать блоки для вашего запроса или произошла ошибка." :
                                        "Нет блоков для отображения. Возможно, этот путь Мастера еще не полностью реализован, не все параметры были выбраны, или выбранная опция помечена как \"(скоро)\"."
                                    }
                                </p>
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
                                    {formData.mainCategory === 'ai_assisted' ? 
                                    "AI предлагает базовую структуру. Вы можете доработать ее в редакторе." :
                                    "Это базовый набор блоков. После добавления вы сможете их детальнее настроить, сгруппировать или добавить другие элементы в основном редакторе."
                                    }
                                    {formData.mainCategory === 'extraction' && " Для сценариев извлечения часто используется флаг 'g' (глобальный поиск), который можно установить в панели вывода Regex."}
                                    {formData.mainCategory === 'replacement' && " Для сценариев замены, мастер предлагает паттерн для поиска; сама операция замены выполняется средствами вашего языка программирования или текстового редактора."}
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
                {isLoadingAI ? "Обработка..." : (currentStepId === 'final_preview' ? "Добавить в выражение" : "Далее")}
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

    