
import * as React from 'react';
import type { BlockConfigs } from './types';
import { BlockType } from './types';
import { Group, Asterisk, CaseSensitive, AnchorIcon, SplitSquareHorizontal, SearchCode, Repeat, HelpCircleIcon, Brackets } from 'lucide-react';

export const BLOCK_CONFIGS: BlockConfigs = {
  [BlockType.GROUP]: {
    name: 'Группа',
    icon: React.createElement(Group, { size: 18 }),
    defaultSettings: { type: 'capturing', name: '' },
    types: ['capturing', 'non-capturing', 'named'],
  },
  [BlockType.QUANTIFIER]: {
    name: 'Квантификатор',
    icon: React.createElement(Asterisk, { size: 18 }),
    defaultSettings: { type: '*', min: 0, max: null, mode: 'greedy' },
    types: ['*', '+', '?', '{n}', '{n,}', '{n,m}'],
    modes: ['greedy', 'lazy', 'possessive'],
  },
  [BlockType.CHARACTER_CLASS]: {
    name: 'Набор символов',
    icon: React.createElement(Brackets, { size: 18 }),
    defaultSettings: { pattern: 'a-z', negated: false },
    presets: [
      { value: '\\d', label: 'Любая цифра (\\d)' },
      { value: '\\w', label: 'Символ слова (\\w)' },
      { value: '\\s', label: 'Пробельный символ (\\s)' },
      { value: '.', label: 'Любой символ (.)' },
      { value: 'a-z', label: 'Буквы a-z' },
      { value: 'A-Z', label: 'Буквы A-Z' },
      { value: '\\p{L}', label: 'Буквы (все языки)' },
    ],
  },
  [BlockType.LITERAL]: {
    name: 'Литерал',
    icon: React.createElement(CaseSensitive, { size: 18 }),
    defaultSettings: { text: '' },
  },
  [BlockType.ANCHOR]: {
    name: 'Якорь',
    icon: React.createElement(AnchorIcon, { size: 18 }),
    defaultSettings: { type: '^' },
    types: ['^', '$', '\\b', '\\B'],
  },
  [BlockType.ALTERNATION]: {
    name: 'Чередование',
    icon: React.createElement(SplitSquareHorizontal, { size: 18 }),
    defaultSettings: {},
  },
  [BlockType.LOOKAROUND]: {
    name: 'Просмотр',
    icon: React.createElement(SearchCode, { size: 18 }),
    defaultSettings: { type: 'positive-lookahead' },
    types: ['positive-lookahead', 'negative-lookahead', 'positive-lookbehind', 'negative-lookbehind'],
  },
  [BlockType.BACKREFERENCE]: {
    name: 'Обратная ссылка',
    icon: React.createElement(Repeat, { size: 18 }),
    defaultSettings: { ref: '1' },
  },
  [BlockType.CONDITIONAL]: {
    name: 'Условие',
    icon: React.createElement(HelpCircleIcon, { size: 18 }),
    defaultSettings: { condition: '', yesPattern: '', noPattern: '' },
  }
};

export const LANGUAGES = [
  { id: 'javascript', name: 'JavaScript' },
  { id: 'python', name: 'Python' },
  { id: 'php', name: 'PHP' },
  { id: 'java', name: 'Java' },
  { id: 'csharp', name: 'C#' },
];
