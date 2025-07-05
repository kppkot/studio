import type { LucideIcon } from 'lucide-react';

export enum BlockType {
  GROUP = 'GROUP',
  QUANTIFIER = 'QUANTIFIER',
  CHARACTER_CLASS = 'CHARACTER_CLASS',
  LITERAL = 'LITERAL',
  ANCHOR = 'ANCHOR',
  ALTERNATION = 'ALTERNATION',
  LOOKAROUND = 'LOOKAROUND',
  BACKREFERENCE = 'BACKREFERENCE', // Added as per proposal
  CONDITIONAL = 'CONDITIONAL', // Added as per proposal
}

export interface GroupSettings {
  type: 'capturing' | 'non-capturing' | 'named';
  name?: string;
}

export interface QuantifierSettings {
  type: '*' | '+' | '?' | '{n}' | '{n,}' | '{n,m}';
  min?: number;
  max?: number | null;
  mode: 'greedy' | 'lazy' | 'possessive';
}

export interface CharacterClassSettings {
  pattern: string;
  negated: boolean;
}

export interface LiteralSettings {
  text: string;
  isRawRegex?: boolean;
}

export interface AnchorSettings {
  type: '^' | '$' | '\\b' | '\\B';
}

export interface AlternationSettings {}

export interface LookaroundSettings {
  type: 'positive-lookahead' | 'negative-lookahead' | 'positive-lookbehind' | 'negative-lookbehind';
}

export interface BackreferenceSettings {
  ref: string | number; // Can be number or name
}

export interface ConditionalSettings {
  condition: string; // This would be a sub-expression or lookaround
  yesPattern: string; // This would be a sub-expression
  noPattern?: string; // This would be a sub-expression
}


export type BlockSettings =
  | GroupSettings
  | QuantifierSettings
  | CharacterClassSettings
  | LiteralSettings
  | AnchorSettings
  | AlternationSettings
  | LookaroundSettings
  | BackreferenceSettings
  | ConditionalSettings;

export interface Block {
  id: string;
  type: BlockType;
  settings: BlockSettings;
  children: Block[];
  isExpanded?: boolean; // Added to control expansion state from parent
}

export interface BlockConfig {
  name: string;
  icon: React.ReactNode; // string or LucideIcon
  defaultSettings: BlockSettings;
  types?: string[]; // For sub-types like in Group or Quantifier
  modes?: string[]; // For Quantifier modes
  presets?: { value: string; label: string }[];
}

export type BlockConfigs = {
  [key in BlockType]: BlockConfig;
};

export interface RegexMatch {
  match: string;
  index: number;
  groups: (string | undefined)[];
  groupIndices?: ([number, number] | undefined)[];
}

export interface GroupInfo {
  blockId: string;
  groupIndex: number; // 1-based index of the capturing group
  groupName?: string;
}

export interface SavedPattern {
  id: string;
  name: string;
  regexString: string;
  flags: string;
  testString?: string;
  description?: string;
}

export interface RegexStringPart {
  text: string;
  blockId: string;
  blockType: BlockType;
}

export interface DropIndicator {
  targetId: string;
  position: 'before' | 'after' | 'inside';
}
