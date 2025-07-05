
"use client";
import React, { useState, useEffect } from 'react';
import type { Block, BlockConfig, CharacterClassSettings, QuantifierSettings, GroupSettings, LiteralSettings, AnchorSettings, LookaroundSettings, BackreferenceSettings, ConditionalSettings } from './types';
import { BlockType } from './types';
import { BLOCK_CONFIGS } from './constants';
import { reconstructPatternFromChildren } from './utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Lightbulb } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface SettingsPanelProps {
  block: Block | null;
  onUpdate: (id: string, updatedBlock: Partial<Block>) => void;
  onClose: () => void;
}

// Helper to get a dynamic, user-friendly title for a block
const getDynamicTitle = (block: Block): string => {
    if (block.type === BlockType.CHARACTER_CLASS) {
        const settings = block.settings as CharacterClassSettings;
        const pattern = settings.pattern;
        const shorthandTitles: { [key: string]: string } = {
          '\\d': 'Любая цифра',
          '\\D': 'Не цифра',
          '\\w': 'Символ слова',
          '\\W': 'Не символ слова',
          '\\s': 'Пробельный символ',
          '\\S': 'Не пробельный символ',
          '.': 'Любой символ',
        };
        if (pattern && shorthandTitles[pattern]) {
            return shorthandTitles[pattern];
        }
        return 'Набор символов';
    }
    return BLOCK_CONFIGS[block.type]?.name || 'Блок';
};

const SettingsPanel: React.FC<SettingsPanelProps> = ({ block, onUpdate, onClose }) => {
  if (!block) return null;

  const config: BlockConfig | undefined = BLOCK_CONFIGS[block.type];
  
  const [localPattern, setLocalPattern] = useState('');

  useEffect(() => {
    if (block?.type === BlockType.CHARACTER_CLASS) {
      if (block.children && block.children.length > 0) {
        setLocalPattern(reconstructPatternFromChildren(block.children));
      } else {
        setLocalPattern((block.settings as CharacterClassSettings).pattern || '');
      }
    }
  }, [block]);


  if (!config) {
    return <div className="p-4 text-destructive">Ошибка: Неизвестный тип блока для настроек.</div>;
  }

  const handleSettingChange = (key: string, value: any) => {
    if (!block) return;

    if (key === 'pattern') {
      setLocalPattern(value);
    } else {
       onUpdate(block.id, {
        settings: {
          ...block.settings,
          [key]: value,
        },
      });
    }
  };

  const handlePatternBlur = () => {
     if (!block || localPattern === ((block.settings as CharacterClassSettings).pattern)) return;
      onUpdate(block.id, {
        settings: {
          ...block.settings,
          pattern: localPattern,
        },
      });
  }
  
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
              onChange={(e) => onUpdate(block.id, { settings: { text: e.target.value } })}
              placeholder="Введите литеральный текст"
              className="mt-1"
            />
             <p className="text-xs text-muted-foreground mt-1.5 px-1">
                Специальные символы (например, `.`, `+`, `*`) будут автоматически экранированы.
             </p>
          </div>
        );
      
      case BlockType.CHARACTER_CLASS:
        const ccSettings = settings as CharacterClassSettings;
        
        const isPresetShorthand = [
          '\\d', '\\D', '\\w', '\\W', '\\s', '\\S', '.'
        ].includes(ccSettings.pattern);

        if (isPresetShorthand) {
          const shorthandInfo: { [key: string]: string } = {
            '\\d': 'Этот блок соответствует любой цифре (0-9).',
            '\\D': 'Этот блок соответствует любому символу, КРОМЕ цифры.',
            '\\w': 'Этот блок соответствует любому "символу слова": букве, цифре или знаку подчеркивания `_`.',
            '\\W': 'Этот блок соответствует любому символу, не являющемуся символом слова.',
            '\\s': 'Этот блок соответствует любому пробельному символу: пробелу, табуляции, переносу строки и т.д.',
            '\\S': 'Этот блок соответствует любому символу, КРОМЕ пробельного.',
            '.': 'Этот блок соответствует абсолютно любому символу, кроме переноса строки.',
          };
          return (
             <Alert>
                <Lightbulb className="h-4 w-4" />
                <AlertDescription>
                    {shorthandInfo[ccSettings.pattern] || 'Это предустановленный символьный класс.'}
                    <p className="mt-3 text-xs text-muted-foreground">
                      Это неизменяемый блок. Чтобы использовать другой класс, пожалуйста, удалите этот и добавьте новый из палитры.
                    </p>
                </AlertDescription>
            </Alert>
          );
        }
        
        return (
          <>
            <div>
              <Label htmlFor="pattern" className="text-sm font-medium">Свои символы</Label>
               <div className="flex items-stretch mt-1">
                    <Input
                    id="pattern"
                    type="text"
                    value={localPattern}
                    onChange={(e) => setLocalPattern(e.target.value)}
                    onBlur={handlePatternBlur}
                    placeholder="например, a-z0-9_!@"
                    className="font-mono"
                    />
               </div>
               <p className="text-xs text-muted-foreground mt-1.5 px-1">
                 Введите символы или диапазоны (например, a-z). Для специальных классов (типа `\d`) используйте палитру, чтобы добавить их как отдельные блоки.
              </p>
            </div>
            
            <div className="flex items-center gap-2 mt-3">
              <Checkbox
                id="negated"
                checked={ccSettings.negated || false}
                onCheckedChange={(checked) => handleSettingChange('negated', checked)}
              />
              <Label htmlFor="negated" className="text-sm">Отрицание (например, [^abc])</Label>
            </div>
            
             <Alert className="mt-4 text-xs">
                <Lightbulb className="h-4 w-4" />
                <AlertDescription>
                    Для поиска букв на любом языке (включая кириллицу), используйте шаблон <strong>`\p{'{'}L{'}'}`</strong> и убедитесь, что включен флаг 'u' (Unicode).
                </AlertDescription>
            </Alert>
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
            
            <Alert className="mt-4 text-xs">
              <Lightbulb className="h-4 w-4" />
              <AlertDescription>
                {gSettings.type === 'capturing' && "Сохраняет найденный текст в отдельную пронумерованную группу (например, №1). Полезно для извлечения конкретной части совпадения. Результат виден на вкладке 'Тестирование'."}
                {gSettings.type === 'non-capturing' && "Используется для объединения блоков (например, чтобы применить к ним квантификатор `(?:a|b)+`), но не сохраняет результат. Экономит ресурсы и не засоряет вывод."}
                {gSettings.type === 'named' && "Работает как захватывающая группа, но дает ей понятное имя вместо номера. Это делает Regex более читаемым и упрощает извлечение данных в коде (например, `(?<year>\\d{4})`)."}
              </AlertDescription>
            </Alert>
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
    <Card className="h-full shadow-none border-0 border-l rounded-none flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between py-3 px-4 border-b">
        <CardTitle className="text-lg">Настройки: {getDynamicTitle(block)}</CardTitle>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
          <X size={18} />
        </Button>
      </CardHeader>
      <CardContent className="p-4 flex-1 min-h-0">
        <ScrollArea className="h-full pr-3">
          <div className="space-y-4">
           {renderSettingsFields()}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default SettingsPanel;
