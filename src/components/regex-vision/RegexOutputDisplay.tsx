
"use client";
import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Block, CharacterClassSettings, GroupSettings, LiteralSettings, QuantifierSettings, AnchorSettings, BackreferenceSettings, LookaroundSettings, ConditionalSettings } from './types';
import { BlockType } from './types';

interface RegexOutputDisplayProps {
  blocks: Block[]; // Changed from generatedRegex: string
  regexFlags: string;
  onFlagsChange: (flags: string) => void;
  generatedRegex: string; // Keep for copy functionality for now
}

const RegexOutputDisplay: React.FC<RegexOutputDisplayProps> = ({ blocks, regexFlags, onFlagsChange, generatedRegex }) => {
  const { toast } = useToast();

  const handleCopyRegex = () => {
    // Use the pre-generated flat string for copying
    navigator.clipboard.writeText(`/${generatedRegex}/${regexFlags}`)
      .then(() => {
        toast({ title: "Успех", description: "Regex скопирован в буфер обмена!" });
      })
      .catch(err => {
        toast({ title: "Ошибка", description: "Не удалось скопировать regex.", variant: "destructive" });
        console.error('Не удалось скопировать regex: ', err);
      });
  };

  const renderBlockWithStructure = React.useCallback((block: Block, keyPrefix: string): React.ReactNode => {
    const settings = block.settings;

    const renderChildren = (children: Block[] | undefined, childKeyPrefix: string): React.ReactNode[] => {
      if (!children) return [];
      return children.map((child, idx) => renderBlockWithStructure(child, `${childKeyPrefix}-child-${idx}`));
    };

    switch (block.type) {
      case BlockType.LITERAL:
        return <span key={`${keyPrefix}-lit`} className="text-green-700 dark:text-green-400">{(settings as LiteralSettings).text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') || ''}</span>;
      
      case BlockType.CHARACTER_CLASS:
        const ccSettings = settings as CharacterClassSettings;
        const escapedPattern = ccSettings.pattern.replace(/[\]\\]/g, '\\$&');
        return (
          <span key={`${keyPrefix}-cc`} className="bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 px-0.5 rounded-sm mx-px">
            [{ccSettings.negated && <span className="text-red-500 dark:text-red-400">^</span>}{escapedPattern || ''}]
          </span>
        );
      
      case BlockType.QUANTIFIER:
        const qSettings = settings as QuantifierSettings;
        const baseQuantifier = qSettings.type || '*';
        let modeModifier = '';
        if (qSettings.mode === 'lazy') modeModifier = '?';
        else if (qSettings.mode === 'possessive') modeModifier = '+';
        let qText = '';
        if (baseQuantifier.includes('{')) {
          const min = qSettings.min ?? 0;
          const max = qSettings.max;
          if (baseQuantifier === '{n}') qText = `{${min}}`;
          else if (baseQuantifier === '{n,}') qText = `{${min},}`;
          else if (baseQuantifier === '{n,m}') qText = `{${min},${max ?? ''}}`;
        } else {
          qText = baseQuantifier;
        }
        return <span key={`${keyPrefix}-q`} className="text-orange-600 dark:text-orange-400">{qText + modeModifier}</span>;
      
      case BlockType.GROUP:
        const gSettings = settings as GroupSettings;
        let groupOpen = "(";
        if (gSettings.type === 'non-capturing') groupOpen = "(?:";
        if (gSettings.type === 'named' && gSettings.name) groupOpen = `(?<${gSettings.name}>`;
        return (
          <span key={`${keyPrefix}-grp`} className="bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-0.5 rounded-sm mx-px">
            {groupOpen}
            {renderChildren(block.children, `${keyPrefix}-grpchildren`)}
            )
          </span>
        );
      
      case BlockType.ANCHOR:
        return <span key={`${keyPrefix}-anc`} className="text-red-600 dark:text-red-400">{(settings as AnchorSettings).type || '^'}</span>;
      
      case BlockType.ALTERNATION:
        if (!block.children || block.children.length === 0) return null;
        const alternatedNodes = renderChildren(block.children, `${keyPrefix}-altchildren`);
        return (
          <span key={`${keyPrefix}-alt`}>
            {alternatedNodes.reduce((acc, curr, currIdx) => {
              return acc === null ? [curr] : [...(acc as React.ReactNode[]), <span key={`${keyPrefix}-alt-sep-${currIdx}`} className="text-pink-600 dark:text-pink-400 font-bold mx-0.5">|</span>, curr];
            }, null as React.ReactNode[] | null)}
          </span>
        );
      
      case BlockType.LOOKAROUND:
        const lSettings = settings as LookaroundSettings;
        const lookaroundMap = {
          'positive-lookahead': "(?=",
          'negative-lookahead': "(?!",
          'positive-lookbehind': "(?<=",
          'negative-lookbehind': "(?<!"
        };
        return (
          <span key={`${keyPrefix}-look`} className="bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 px-0.5 rounded-sm mx-px">
            {lookaroundMap[lSettings.type]}
            {renderChildren(block.children, `${keyPrefix}-lookchildren`)}
            )
          </span>
        );
      
      case BlockType.BACKREFERENCE:
        const brSettings = settings as BackreferenceSettings;
        return <span key={`${keyPrefix}-bref`} className="text-cyan-600 dark:text-cyan-400">\\{brSettings.ref}</span>;

      case BlockType.CONDITIONAL:
        // Simplified rendering for conditionals, as full recursive rendering for its parts is complex here
        const condSettings = settings as ConditionalSettings;
        let conditionalStr = `(?(${condSettings.condition})${condSettings.yesPattern}`;
        if (condSettings.noPattern) {
          conditionalStr += `|${condSettings.noPattern}`;
        }
        conditionalStr += `)`;
        return <span key={`${keyPrefix}-cond`} className="text-indigo-600 dark:text-indigo-400">{conditionalStr}</span>;

      default:
        return renderChildren(block.children, `${keyPrefix}-defchildren`);
    }
  }, []);
  
  return (
    <div className="space-y-2">
      <Label htmlFor="generatedRegexOutput" className="text-sm font-medium">Сгенерированное регулярное выражение</Label>
      <div className="flex items-center gap-2">
        <div className="flex-1 p-2.5 bg-muted rounded-lg font-mono text-sm min-h-[2.5rem] flex items-center overflow-x-auto flex-wrap leading-relaxed">
          <span className="text-muted-foreground">/</span>
          {blocks.length > 0 
            ? blocks.map((block, index) => renderBlockWithStructure(block, `structured-${block.id}-${index}`))
            : <span className="italic text-muted-foreground">Добавьте блоки для построения выражения</span>
          }
          <span className="text-muted-foreground">/</span>
        </div>
        <Input
          id="regexFlags"
          type="text"
          value={regexFlags}
          onChange={(e) => onFlagsChange(e.target.value.replace(/[^gimsuy]/g, ''))}
          className="w-20 p-3 font-mono text-center h-10"
          placeholder="флаги"
          aria-label="Флаги Regex"
        />
        <Button
          variant="outline"
          size="icon"
          onClick={handleCopyRegex}
          title="Копировать Regex"
          className="h-10 w-10"
          disabled={!generatedRegex}
        >
          <Copy size={16} />
        </Button>
      </div>
    </div>
  );
};

export default RegexOutputDisplay;
