"use client";
import React from 'react';
import type { Block, BlockConfig, CharacterClassSettings, QuantifierSettings, GroupSettings, LiteralSettings, AnchorSettings, LookaroundSettings, BackreferenceSettings, ConditionalSettings } from './types';
import { BlockType } from './types';
import { BLOCK_CONFIGS } from './constants';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X } from 'lucide-react';

interface SettingsPanelProps {
  block: Block | null;
  onUpdate: (id: string, updatedBlock: Block) => void;
  onClose: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ block, onUpdate, onClose }) => {
  if (!block) return null;

  const config: BlockConfig | undefined = BLOCK_CONFIGS[block.type];

  if (!config) {
    return <div className="p-4 text-destructive">Error: Unknown block type for settings.</div>;
  }

  const handleSettingChange = (key: string, value: any) => {
    if (!block) return;
    onUpdate(block.id, {
      ...block,
      settings: {
        ...block.settings,
        [key]: value,
      },
    });
  };
  
  const renderSettingsFields = () => {
    const settings = block.settings;
    switch (block.type) {
      case BlockType.LITERAL:
        const literalSettings = settings as LiteralSettings;
        return (
          <div>
            <Label htmlFor="text" className="text-sm font-medium">Text</Label>
            <Input
              id="text"
              type="text"
              value={literalSettings.text || ''}
              onChange={(e) => handleSettingChange('text', e.target.value)}
              placeholder="Enter literal text"
              className="mt-1"
            />
          </div>
        );
      
      case BlockType.CHARACTER_CLASS:
        const ccSettings = settings as CharacterClassSettings;
        return (
          <>
            <div>
              <Label htmlFor="pattern" className="text-sm font-medium">Pattern</Label>
              <Input
                id="pattern"
                type="text"
                value={ccSettings.pattern || ''}
                onChange={(e) => handleSettingChange('pattern', e.target.value)}
                placeholder="e.g., a-z, 0-9, \\d"
                className="mt-1"
              />
            </div>
            <div className="flex items-center gap-2 mt-3">
              <Checkbox
                id="negated"
                checked={ccSettings.negated || false}
                onCheckedChange={(checked) => handleSettingChange('negated', checked)}
              />
              <Label htmlFor="negated" className="text-sm">Negate (e.g. [^abc])</Label>
            </div>
            {config.presets && (
              <div className="mt-3">
                <Label className="text-sm font-medium">Presets</Label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {config.presets.map(preset => (
                    <Button
                      key={preset}
                      variant="outline"
                      size="sm"
                      onClick={() => handleSettingChange('pattern', preset)}
                      className="font-mono"
                    >
                      {preset}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </>
        );

      case BlockType.QUANTIFIER:
        const qSettings = settings as QuantifierSettings;
        return (
          <>
            <div>
              <Label htmlFor="quantifierType" className="text-sm font-medium">Type</Label>
              <Select value={qSettings.type || '*'} onValueChange={(value) => handleSettingChange('type', value)}>
                <SelectTrigger id="quantifierType" className="mt-1">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {config.types?.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            
            {(qSettings.type?.includes('{')) && (
              <>
                <div className="mt-3">
                  <Label htmlFor="min" className="text-sm font-medium">Minimum</Label>
                  <Input
                    id="min"
                    type="number"
                    value={qSettings.min ?? 0}
                    onChange={(e) => handleSettingChange('min', parseInt(e.target.value, 10) || 0)}
                    min="0"
                    className="mt-1"
                  />
                </div>
                {qSettings.type === '{n,m}' && (
                  <div className="mt-3">
                    <Label htmlFor="max" className="text-sm font-medium">Maximum (optional)</Label>
                    <Input
                      id="max"
                      type="number"
                      value={qSettings.max ?? ''}
                      onChange={(e) => handleSettingChange('max', e.target.value ? parseInt(e.target.value, 10) : null)}
                      min={qSettings.min ?? 0}
                      placeholder="Infinity"
                      className="mt-1"
                    />
                  </div>
                )}
              </>
            )}

            <div className="mt-3">
              <Label htmlFor="quantifierMode" className="text-sm font-medium">Mode</Label>
              <Select value={qSettings.mode || 'greedy'} onValueChange={(value) => handleSettingChange('mode', value)}>
                <SelectTrigger id="quantifierMode" className="mt-1">
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent>
                  {config.modes?.map(mode => (
                    <SelectItem key={mode} value={mode}>
                      {mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        );
        
      case BlockType.GROUP:
        const gSettings = settings as GroupSettings;
        return (
          <>
            <div>
              <Label htmlFor="groupType" className="text-sm font-medium">Group Type</Label>
              <Select value={gSettings.type || 'capturing'} onValueChange={(value) => handleSettingChange('type', value)}>
                <SelectTrigger id="groupType" className="mt-1">
                  <SelectValue placeholder="Select group type" />
                </SelectTrigger>
                <SelectContent>
                  {config.types?.map(type => (
                    <SelectItem key={type} value={type}>
                      {type === 'capturing' ? 'Capturing' : 
                       type === 'non-capturing' ? 'Non-capturing (?:...)' : 'Named (?<name>...)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {gSettings.type === 'named' && (
              <div className="mt-3">
                <Label htmlFor="groupName" className="text-sm font-medium">Group Name</Label>
                <Input
                  id="groupName"
                  type="text"
                  value={gSettings.name || ''}
                  onChange={(e) => handleSettingChange('name', e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                  placeholder="e.g., myGroup"
                  className="mt-1"
                />
              </div>
            )}
          </>
        );

      case BlockType.ANCHOR:
        const anchorSettings = settings as AnchorSettings;
        return (
          <div>
            <Label htmlFor="anchorType" className="text-sm font-medium">Anchor Type</Label>
            <Select value={anchorSettings.type || '^'} onValueChange={(value) => handleSettingChange('type', value)}>
              <SelectTrigger id="anchorType" className="mt-1">
                <SelectValue placeholder="Select anchor type" />
              </SelectTrigger>
              <SelectContent>
                {config.types?.map(type => (
                  <SelectItem key={type} value={type}>
                    {type === '^' ? 'Start of string (^)' :
                     type === '$' ? 'End of string ($)' :
                     type === '\\b' ? 'Word boundary (\\b)' : 'Non-word boundary (\\B)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      
      case BlockType.LOOKAROUND:
        const lookSettings = settings as LookaroundSettings;
        return (
          <div>
            <Label htmlFor="lookaroundType" className="text-sm font-medium">Lookaround Type</Label>
            <Select value={lookSettings.type || 'positive-lookahead'} onValueChange={(value) => handleSettingChange('type', value)}>
              <SelectTrigger id="lookaroundType" className="mt-1">
                <SelectValue placeholder="Select lookaround type" />
              </SelectTrigger>
              <SelectContent>
                {config.types?.map(type => (
                  <SelectItem key={type} value={type}>
                    {type === 'positive-lookahead' ? 'Positive Lookahead (?=...)' :
                     type === 'negative-lookahead' ? 'Negative Lookahead (?!...)' :
                     type === 'positive-lookbehind' ? 'Positive Lookbehind (?<=...)' : 
                     'Negative Lookbehind (?<!...)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case BlockType.BACKREFERENCE:
        const brSettings = settings as BackreferenceSettings;
        return (
          <div>
            <Label htmlFor="backreferenceRef" className="text-sm font-medium">Reference (Number or Name)</Label>
            <Input
              id="backreferenceRef"
              type="text"
              value={brSettings.ref || '1'}
              onChange={(e) => handleSettingChange('ref', e.target.value)}
              placeholder="e.g., 1 or groupName"
              className="mt-1"
            />
          </div>
        );

      case BlockType.CONDITIONAL:
        const condSettings = settings as ConditionalSettings;
        return (
          <>
            <div>
              <Label htmlFor="conditionRegex" className="text-sm font-medium">Condition (Regex or Group Name/Number)</Label>
              <Input
                id="conditionRegex"
                type="text"
                value={condSettings.condition || ''}
                onChange={(e) => handleSettingChange('condition', e.target.value)}
                placeholder="e.g., (?=foo) or 1 or group_name"
                className="mt-1"
              />
            </div>
            <div className="mt-3">
              <Label htmlFor="yesPattern" className="text-sm font-medium">Yes-Pattern (Regex)</Label>
              <Input
                id="yesPattern"
                type="text"
                value={condSettings.yesPattern || ''}
                onChange={(e) => handleSettingChange('yesPattern', e.target.value)}
                placeholder="Regex if condition is true"
                className="mt-1"
              />
            </div>
            <div className="mt-3">
              <Label htmlFor="noPattern" className="text-sm font-medium">No-Pattern (Regex, optional)</Label>
              <Input
                id="noPattern"
                type="text"
                value={condSettings.noPattern || ''}
                onChange={(e) => handleSettingChange('noPattern', e.target.value)}
                placeholder="Regex if condition is false"
                className="mt-1"
              />
            </div>
          </>
        );
      
      default:
        return <div className="text-sm text-muted-foreground">No specific settings for this block type.</div>;
    }
  };

  return (
    <Card className="h-full shadow-none border-0 border-l rounded-none">
      <CardHeader className="flex flex-row items-center justify-between py-3 px-4 border-b">
        <CardTitle className="text-lg">Settings: {config.name}</CardTitle>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
          <X size={18} />
        </Button>
      </CardHeader>
      <CardContent className="p-4">
        <ScrollArea className="h-[calc(100vh_-_var(--header-height)_-_var(--output-panel-height)_-_var(--settings-header-height)_-_2rem)] pr-3"> {/* Adjust height as needed */}
          <div className="space-y-4">
           {renderSettingsFields()}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default SettingsPanel;
