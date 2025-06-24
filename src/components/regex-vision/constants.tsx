
import type { BlockConfigs } from './types';
import { BlockType } from './types';
import { Group, Asterisk, CaseSensitive, AnchorIcon, SplitSquareHorizontal, SearchCode, Repeat, HelpCircleIcon } from 'lucide-react';

export const BLOCK_CONFIGS: BlockConfigs = {
  [BlockType.GROUP]: {
    name: 'Группа',
    icon: <Group size={18}/>,
    defaultSettings: { type: 'capturing', name: '' },
    types: ['capturing', 'non-capturing', 'named'],
  },
  [BlockType.QUANTIFIER]: {
    name: 'Квантификатор',
    icon: <Asterisk size={18}/>,
    defaultSettings: { type: '*', min: 0, max: null, mode: 'greedy' },
    types: ['*', '+', '?', '{n}', '{n,}', '{n,m}'],
    modes: ['greedy', 'lazy', 'possessive'],
  },
  [BlockType.CHARACTER_CLASS]: {
    name: 'Символьный класс',
    icon: <span className="font-mono text-sm">[ ]</span>,
    defaultSettings: { pattern: 'a-z', negated: false },
    presets: [
      { value: '\\p{L}', label: 'Любая буква (Unicode)' },
      { value: 'a-zA-Z', label: 'Буквы (только латиница)' },
      { value: '0-9', label: 'Цифры (0-9)' },
      { value: '\\d', label: '\\d (любая цифра)' },
      { value: '\\w', label: 'Символ слова (\\w)' },
      { value: '\\s', label: 'Любой пробел (\\s)' },
      { value: '.', label: 'Любой символ (.)' },
    ],
  },
  [BlockType.LITERAL]: {
    name: 'Литерал',
    icon: <CaseSensitive size={18}/>,
    defaultSettings: { text: '' },
  },
  [BlockType.ANCHOR]: {
    name: 'Якорь',
    icon: <AnchorIcon size={18}/>,
    defaultSettings: { type: '^' },
    types: ['^', '$', '\\b', '\\B'],
  },
  [BlockType.ALTERNATION]: {
    name: 'Чередование',
    icon: <SplitSquareHorizontal size={18}/>,
    defaultSettings: {},
  },
  [BlockType.LOOKAROUND]: {
    name: 'Просмотр',
    icon: <SearchCode size={18}/>,
    defaultSettings: { type: 'positive-lookahead' },
    types: ['positive-lookahead', 'negative-lookahead', 'positive-lookbehind', 'negative-lookbehind'],
  },
  [BlockType.BACKREFERENCE]: {
    name: 'Обратная ссылка',
    icon: <Repeat size={18}/>,
    defaultSettings: { ref: '1' },
  },
  [BlockType.CONDITIONAL]: {
    name: 'Условие',
    icon: <HelpCircleIcon size={18}/>,
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
