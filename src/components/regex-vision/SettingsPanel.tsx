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
    return <div className="p-4 text-destructive">Ошибка: Неизвестный тип блока для настроек.</div>;
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
            <Label htmlFor="text" className="text-sm font-medium">Текст</Label>
            <Input
              id="text"
              type="text"
              value={literalSettings.text || ''}
              onChange={(e) => handleSettingChange('text', e.target.value)}
              placeholder="Введите литеральный текст"
              className="mt-1"
            />
          </div>
        );
      
      case BlockType.CHARACTER_CLASS:
        const ccSettings = settings as CharacterClassSettings;
        return (
          <>
            <div>
              <Label htmlFor="pattern" className="text-sm font-medium">Шаблон</Label>
              <Input
                id="pattern"
                type="text"
                value={ccSettings.pattern || ''}
                onChange={(e) => handleSettingChange('pattern', e.target.value)}
                placeholder="например, a-z, 0-9, \\d"
                className="mt-1"
              />
            </div>
            <div className="flex items-center gap-2 mt-3">
              <Checkbox
                id="negated"
                checked={ccSettings.negated || false}
                onCheckedChange={(checked) => handleSettingChange('negated', checked)}
              />
              <Label htmlFor="negated" className="text-sm">Отрицание (например, [^abc])</Label>
            </div>
            {config.presets && (
              <div className="mt-3">
                <Label className="text-sm font-medium">Предустановки</Label>
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
              <Label htmlFor="quantifierType" className="text-sm font-medium">Тип</Label>
              <Select value={qSettings.type || '*'} onValueChange={(value) => handleSettingChange('type', value)}>
                <SelectTrigger id="quantifierType" className="mt-1">
                  <SelectValue placeholder="Выберите тип" />
                </SelectTrigger>
                <SelectContent>
                  {config.types?.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            
            {(qSettings.type?.includes('{')) && (
              <>
                <div className="mt-3">
                  <Label htmlFor="min" className="text-sm font-medium">Минимум</Label>
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
                    <Label htmlFor="max" className="text-sm font-medium">Максимум (необязательно)</Label>
                    <Input
                      id="max"
                      type="number"
                      value={qSettings.max ?? ''}
                      onChange={(e) => handleSettingChange('max', e.target.value ? parseInt(e.target.value, 10) : null)}
                      min={qSettings.min ?? 0}
                      placeholder="Бесконечность"
                      className="mt-1"
                    />
                  </div>
                )}
              </>
            )}

            <div className="mt-3">
              <Label htmlFor="quantifierMode" className="text-sm font-medium">Режим</Label>
              <Select value={qSettings.mode || 'greedy'} onValueChange={(value) => handleSettingChange('mode', value)}>
                <SelectTrigger id="quantifierMode" className="mt-1">
                  <SelectValue placeholder="Выберите режим" />
                </SelectTrigger>
                <SelectContent>
                  {config.modes?.map(mode => (
                    <SelectItem key={mode} value={mode}>
                      {mode === 'greedy' ? 'Жадный' : mode === 'lazy' ? 'Ленивый' : 'Ревнивый'}
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
              <Label htmlFor="groupType" className="text-sm font-medium">Тип группы</Label>
              <Select value={gSettings.type || 'capturing'} onValueChange={(value) => handleSettingChange('type', value)}>
                <SelectTrigger id="groupType" className="mt-1">
                  <SelectValue placeholder="Выберите тип группы" />
                </SelectTrigger>
                <SelectContent>
                  {config.types?.map(type => (
                    <SelectItem key={type} value={type}>
                      {type === 'capturing' ? 'Захватывающая' : 
                       type === 'non-capturing' ? 'Незахватывающая (?:...)' : 'Именованная (?<name>...)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {gSettings.type === 'named' && (
              <div className="mt-3">
                <Label htmlFor="groupName" className="text-sm font-medium">Имя группы</Label>
                <Input
                  id="groupName"
                  type="text"
                  value={gSettings.name || ''}
                  onChange={(e) => handleSettingChange('name', e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                  placeholder="например, мояГруппа"
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
            <Label htmlFor="anchorType" className="text-sm font-medium">Тип якоря</Label>
            <Select value={anchorSettings.type || '^'} onValueChange={(value) => handleSettingChange('type', value)}>
              <SelectTrigger id="anchorType" className="mt-1">
                <SelectValue placeholder="Выберите тип якоря" />
              </SelectTrigger>
              <SelectContent>
                {config.types?.map(type => (
                  <SelectItem key={type} value={type}>
                    {type === '^' ? 'Начало строки (^)' :
                     type === '$' ? 'Конец строки ($)' :
                     type === '\\b' ? 'Граница слова (\\b)' : 'Не граница слова (\\B)'}
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
            <Label htmlFor="lookaroundType" className="text-sm font-medium">Тип просмотра</Label>
            <Select value={lookSettings.type || 'positive-lookahead'} onValueChange={(value) => handleSettingChange('type', value)}>
              <SelectTrigger id="lookaroundType" className="mt-1">
                <SelectValue placeholder="Выберите тип просмотра" />
              </SelectTrigger>
              <SelectContent>
                {config.types?.map(type => (
                  <SelectItem key={type} value={type}>
                    {type === 'positive-lookahead' ? 'Позитивный просмотр вперед (?=...)' :
                     type === 'negative-lookahead' ? 'Негативный просмотр вперед (?!...)' :
                     type === 'positive-lookbehind' ? 'Позитивный просмотр назад (?<=...)' : 
                     'Негативный просмотр назад (?<!...)'}
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
            <Label htmlFor="backreferenceRef" className="text-sm font-medium">Ссылка (номер или имя)</Label>
            <Input
              id="backreferenceRef"
              type="text"
              value={brSettings.ref || '1'}
              onChange={(e) => handleSettingChange('ref', e.target.value)}
              placeholder="например, 1 или имяГруппы"
              className="mt-1"
            />
          </div>
        );

      case BlockType.CONDITIONAL:
        const condSettings = settings as ConditionalSettings;
        return (
          <>
            <div>
              <Label htmlFor="conditionRegex" className="text-sm font-medium">Условие (Regex или имя/номер группы)</Label>
              <Input
                id="conditionRegex"
                type="text"
                value={condSettings.condition || ''}
                onChange={(e) => handleSettingChange('condition', e.target.value)}
                placeholder="например, (?=foo) или 1 или имя_группы"
                className="mt-1"
              />
            </div>
            <div className="mt-3">
              <Label htmlFor="yesPattern" className="text-sm font-medium">Да-шаблон (Regex)</Label>
              <Input
                id="yesPattern"
                type="text"
                value={condSettings.yesPattern || ''}
                onChange={(e) => handleSettingChange('yesPattern', e.target.value)}
                placeholder="Regex, если условие истинно"
                className="mt-1"
              />
            </div>
            <div className="mt-3">
              <Label htmlFor="noPattern" className="text-sm font-medium">Нет-шаблон (Regex, необязательно)</Label>
              <Input
                id="noPattern"
                type="text"
                value={condSettings.noPattern || ''}
                onChange={(e) => handleSettingChange('noPattern', e.target.value)}
                placeholder="Regex, если условие ложно"
                className="mt-1"
              />
            </div>
          </>
        );
      
      default:
        return <div className="text-sm text-muted-foreground">Для этого типа блока нет особых настроек.</div>;
    }
  };

  return (
    <Card className="h-full shadow-none border-0 border-l rounded-none">
      <CardHeader className="flex flex-row items-center justify-between py-3 px-4 border-b">
        <CardTitle className="text-lg">Настройки: {config.name}</CardTitle>
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
