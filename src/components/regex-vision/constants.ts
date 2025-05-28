import type { BlockConfigs } from './types';
import { BlockType } from './types';
import { Group, Asterisk, CaseSensitive, AnchorIcon, SplitSquareHorizontal, SearchCode, Repeat, HelpCircleIcon } from 'lucide-react';

export const BLOCK_CONFIGS: BlockConfigs = {
  [BlockType.GROUP]: {
    name: 'Group',
    icon: <Group size={18}/>,
    defaultSettings: { type: 'capturing', name: '' },
    types: ['capturing', 'non-capturing', 'named'],
  },
  [BlockType.QUANTIFIER]: {
    name: 'Quantifier',
    icon: <Asterisk size={18}/>,
    defaultSettings: { type: '*', min: 0, max: null, mode: 'greedy' },
    types: ['*', '+', '?', '{n}', '{n,}', '{n,m}'],
    modes: ['greedy', 'lazy', 'possessive'],
  },
  [BlockType.CHARACTER_CLASS]: {
    name: 'Character Class',
    icon: <span className="font-mono text-sm">[ ]</span>,
    defaultSettings: { pattern: 'a-z', negated: false },
    presets: ['a-z', 'A-Z', '0-9', '\\d', '\\w', '\\s', '.'],
  },
  [BlockType.LITERAL]: {
    name: 'Literal',
    icon: <CaseSensitive size={18}/>,
    defaultSettings: { text: '' },
  },
  [BlockType.ANCHOR]: {
    name: 'Anchor',
    icon: <AnchorIcon size={18}/>,
    defaultSettings: { type: '^' },
    types: ['^', '$', '\\b', '\\B'],
  },
  [BlockType.ALTERNATION]: {
    name: 'Alternation',
    icon: <SplitSquareHorizontal size={18}/>,
    defaultSettings: {},
  },
  [BlockType.LOOKAROUND]: {
    name: 'Lookaround',
    icon: <SearchCode size={18}/>,
    defaultSettings: { type: 'positive-lookahead' },
    types: ['positive-lookahead', 'negative-lookahead', 'positive-lookbehind', 'negative-lookbehind'],
  },
  [BlockType.BACKREFERENCE]: {
    name: 'Backreference',
    icon: <Repeat size={18}/>,
    defaultSettings: { ref: '1' },
  },
  [BlockType.CONDITIONAL]: {
    name: 'Conditional',
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
