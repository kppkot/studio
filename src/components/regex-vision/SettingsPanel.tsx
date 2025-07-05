
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, Lightbulb } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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
          '\\p{L}': 'Любая буква',
        };
        if (pattern && shorthandTitles[pattern]) {
            return shorthandTitles[pattern];
        }
        return 'Набор символов';
    }
    return BLOCK_CONFIGS[block.type]?.name || 'Блок';
};

const SettingsPanel: React.FC<SettingsPanelProps> = ({ block, onUpdate, onClose }) => {
  // Hooks must be called at the top level, before any conditional returns.
  const [localPattern, setLocalPattern] = useState('');

  useEffect(() => {
    if (block?.type === BlockType.CHARACTER_CLASS) {
      if (block.children && block.children.length > 0) {
        setLocalPattern(reconstructPatternFromChildren(block.children));
      } else {
        setLocalPattern((block.settings as CharacterClassSettings).pattern || '');
      }
    } else if (!block) {
      // Clear local state when no block is selected
      setLocalPattern('');
    }
  }, [block]);


  // Conditional return is fine after all hooks have been called.
  if (!block) {
    return (
        <Card className="h-full flex flex-col shadow-md border-primary/20 overflow-hidden">
            <CardHeader className="py-3 px-4 border-b">
                <CardTitle className="text-base flex items-center gap-2">
                    <Settings size={18} className="text-primary"/> Настройки
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-center gap-4 p-4">
                <Settings size={48} className="opacity-50" />
                <p>Выберите блок из дерева слева, чтобы увидеть его настройки.</p>
            </CardContent>
        </Card>
    );
  }

  const config: BlockConfig | undefined = BLOCK_CONFIGS[block.type];
  
  if (!config) {
     return (
        <Card className="h-full flex flex-col shadow-md border-primary/20 overflow-hidden">
            <CardHeader className="py-3 px-4 border-b">
                <CardTitle className="text-base flex items-center gap-2">
                    <Settings size={18} className="text-primary"/> Ошибка
                </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
                <Alert variant="destructive">
                    <AlertTitle>Ошибка</AlertTitle>
                    <AlertDescription>Неизвестный тип блока для настроек.</AlertDescription>
                </Alert>
            </CardContent>
        </Card>
    );
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
              onChange={(e) => onUpdate(block.id, { settings: { text: e.target.value, isRawRegex: literalSettings.isRawRegex } })}
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
          '\\d', '\\D', '\\w', '\\W', '\\s', '\\S', '.', '\\p{L}'
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
            '\\p{L}': "Этот блок находит одну букву любого алфавита: кириллицы, латиницы и других. Для корректной работы убедитесь, что в поле флагов включена буква 'u' (обычно она там по умолчанию).",
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
                 Введите символы или диапазоны (например, a-z). Для специальных классов (типа `\\d`) используйте палитру, чтобы добавить их как отдельные блоки.
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
                    Для поиска букв на любом языке (включая кириллицу), используйте блок **"Любая буква"** из палитры и убедитесь, что включен флаг 'u'.
                </AlertDescription>
            </Alert>
          </>
        );

      case BlockType.QUANTIFIER:
        const qSettings = settings as QuantifierSettings;

        const quantifierOptions = [
            { value: '*', label: '* (ноль или более)' },
            { value: '+', label: '+ (один или более)' },
            { value: '?', label: '? (ноль или один)' },
            { value: '{n}', label: '{n} (ровно n раз)' },
            { value: '{n,}', label: '{n,} (минимум n раз)' },
            { value: '{n,m}', label: '{n,m} (от n до m раз)' },
        ];

        const qExplanation: { [key: string]: { title: string, description: string} } = {
          '*': { title: 'Звезда (ноль или более)', description: 'Совпадает с предыдущим элементом 0 или более раз. Например, /a*/ найдет "", "a", "aa".' },
          '+': { title: 'Плюс (один или более)', description: 'Совпадает с предыдущим элементом 1 или более раз. Например, /a+/ найдет "a", "aa", но не "".' },
          '?': { title: 'Вопросительный знак (ноль или один)', description: 'Совпадает с предыдущим элементом 0 или 1 раз. Делает элемент необязательным. Например, /colou?r/ найдет "color" и "colour".' },
          '{n}': { title: 'Точное количество {n}', description: 'Совпадает с предыдущим элементом ровно N раз.' },
          '{n,}': { title: 'Минимум {n,}', description: 'Совпадает с предыдущим элементом как минимум N раз.' },
          '{n,m}': { title: 'Диапазон {n,m}', description: 'Совпадает с предыдущим элементом от N до M раз включительно.' },
        };

        const modeExplanation: { [key:string]: { title: string, description: string }} = {
            'greedy': { title: 'Жадный режим (по умолчанию)', description: 'Квантификатор захватывает как можно больше символов.' },
            'lazy': { title: 'Ленивый режим', description: 'Квантификатор захватывает как можно меньше символов. Добавляет ? после квантификатора (например, *?).' },
            'possessive': { title: 'Ревнивый (сверхжадный) режим', description: 'Захватывает как можно больше, не "отдавая" символы для остальной части выражения (не поддерживает откат). Добавляет + после квантификатора (например, *+). Поддерживается не всеми движками.' },
        }
        
        const selectedQuantifierInfo = qExplanation[qSettings.type];
        const selectedModeInfo = modeExplanation[qSettings.mode || 'greedy'];

        return (
          <>
            <div>
              <Label htmlFor="quantifierType" className="text-sm font-medium">Тип</Label>
              <Select value={qSettings.type || '*'} onValueChange={(value) => handleSettingChange('type', value)}>
                <SelectTrigger id="quantifierType" className="mt-1">
                  <SelectValue placeholder="Выберите тип" />
                </SelectTrigger>
                <SelectContent>
                  {quantifierOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            
            {(qSettings.type?.includes('{')) && (
              <>
                <div className="mt-3">
                  <Label htmlFor="min" className="text-sm font-medium">Минимум (n)</Label>
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
                    <Label htmlFor="max" className="text-sm font-medium">Максимум (m)</Label>
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

            <Alert className="mt-4 text-xs">
                <Lightbulb className="h-4 w-4" />
                {selectedQuantifierInfo && (
                    <>
                    <AlertTitle>{selectedQuantifierInfo.title}</AlertTitle>
                    <AlertDescription>
                        {selectedQuantifierInfo.description}
                        {selectedModeInfo && (
                            <div className="mt-2 pt-2 border-t border-border/50">
                                <p className="font-semibold">{selectedModeInfo.title}</p>
                                <p>{selectedModeInfo.description}</p>
                            </div>
                        )}
                    </AlertDescription>
                    </>
                )}
            </Alert>
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
            
            {gSettings.type === 'capturing' && (
              <Alert className="mt-4">
                <Lightbulb className="h-4 w-4" />
                <AlertTitle>Захватывающая группа</AlertTitle>
                <AlertDescription className="flex flex-col gap-2 mt-2">
                    <p>Сохраняет найденный текст в отдельную пронумерованную группу (например, №1), которую можно использовать для обратных ссылок или извлечения данных.</p>
                    <p className="text-xs text-muted-foreground">Результаты захвата видны на вкладке "Тестирование".</p>
                </AlertDescription>
              </Alert>
            )}
            {gSettings.type === 'non-capturing' && (
              <Alert className="mt-4">
                <Lightbulb className="h-4 w-4" />
                <AlertTitle>Незахватывающая группа (?:...)</AlertTitle>
                <AlertDescription className="flex flex-col gap-2 mt-2">
                    <p>Эта группа объединяет несколько блоков, но **не сохраняет** найденный текст.</p>
                    <p className="font-semibold text-xs">Зачем это нужно?</p>
                    <p className="text-xs">Идеально, когда нужно применить квантификатор (например, `*`, `+`) к целой последовательности, а не к одному символу.</p>
                    <div>
                        <p className="text-xs font-semibold">Пример:</p>
                        <p className="text-xs italic text-muted-foreground">Чтобы найти слово "ha" повторяющееся один или более раз (в "hahaha"), вы используете `(?:ha)+`. Без этой группы, выражение `ha+` искало бы "haaaa...".</p>
                    </div>
                </AlertDescription>
              </Alert>
            )}
            {gSettings.type === 'named' && (
              <Alert className="mt-4">
                <Lightbulb className="h-4 w-4" />
                <AlertTitle>Именованная группа (?&lt;имя&gt;...)</AlertTitle>
                <AlertDescription className="flex flex-col gap-2 mt-2">
                    <p>Работает как захватывающая группа, но дает результату понятное имя вместо номера.</p>
                    <p className="font-semibold text-xs">Зачем это нужно?</p>
                    <p className="text-xs">Делает Regex более читаемым и упрощает извлечение данных в коде.</p>
                    <div>
                        <p className="text-xs font-semibold">Пример:</p>
                        <p className="text-xs italic text-muted-foreground">В выражении `(?&lt;year&gt;\d{4})` вы можете получить найденный год по имени "year", а не по номеру группы.</p>
                    </div>
                </AlertDescription>
              </Alert>
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
        const lookaroundExplanations: Record<LookaroundSettings['type'], { title: string, description: string, example: string }> = {
            'positive-lookahead': {
            title: 'Позитивный просмотр вперёд (?=...)',
            description: 'Проверяет, что сразу после текущей позиции в тексте следует определённый шаблон, но НЕ ВКЛЮЧАЕТ его в итоговое совпадение. Это "заглядывание" вперёд.',
            example: 'Пример: `q(?=u)` найдёт букву `q` только в слове "queen", но не в слове "qat". Само `u` в результат не попадёт.'
            },
            'negative-lookahead': {
            title: 'Негативный просмотр вперёд (?!...)',
            description: 'Проверяет, что сразу после текущей позиции НЕ следует определённый шаблон. Также не включает символы в результат.',
            example: 'Пример: `q(?!u)` найдёт `q` в "qat", но не в "queen".'
            },
            'positive-lookbehind': {
            title: 'Позитивный просмотр назад (?<=...)',
            description: 'Проверяет, что перед текущей позицией есть определённый шаблон, не включая его в результат. Это "оглядывание" назад.',
            example: 'Пример: `(?<=\\$)d+` найдёт число `123` только в строке "$123", но не в "€123". Знак `$` в результат не попадёт.'
            },
            'negative-lookbehind': {
            title: 'Негативный просмотр назад (?<!...)',
            description: 'Проверяет, что перед текущей позицией НЕТ определённого шаблона.',
            example: 'Пример: `(?<!\\$)d+` найдёт `123` в "€123", но не в "$123".'
            }
        };

        const currentExplanation = lookaroundExplanations[lookSettings.type];
        return (
          <>
            <div>
              <Label htmlFor="lookaroundType" className="text-sm font-medium">Тип просмотра</Label>
              <Select value={lookSettings.type || 'positive-lookahead'} onValueChange={(value) => handleSettingChange('type', value)}>
                <SelectTrigger id="lookaroundType" className="mt-1">
                  <SelectValue placeholder="Выберите тип просмотра" />
                </SelectTrigger>
                <SelectContent>
                  {config.types?.map(type => (
                    <SelectItem key={type} value={type}>
                      {type === 'positive-lookahead' ? 'Позитивный просмотр вперёд (?=...)' :
                       type === 'negative-lookahead' ? 'Негативный просмотр вперёд (?!...)' :
                       type === 'positive-lookbehind' ? 'Позитивный просмотр назад (?<=...)' : 
                       'Негативный просмотр назад (?<!...)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {currentExplanation && (
              <Alert className="mt-4">
                  <Lightbulb className="h-4 w-4" />
                  <AlertTitle className="font-semibold">{currentExplanation.title}</AlertTitle>
                  <AlertDescription className="flex flex-col gap-2 mt-2">
                      <p>{currentExplanation.description}</p>
                      <p className="italic text-muted-foreground">{currentExplanation.example}</p>
                  </AlertDescription>
              </Alert>
            )}
          </>
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
    <Card className="h-full flex flex-col shadow-md border-primary/20 overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between py-3 px-4 border-b">
        <CardTitle className="text-base truncate flex items-center gap-2">
            <Settings size={18} className="text-primary"/> Настройки: {getDynamicTitle(block)}
        </CardTitle>
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
