
'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, Copy } from 'lucide-react';
import { Inter, JetBrains_Mono } from 'next/font/google';
import '../../../wizard.css'; // Reuse common styles
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';

import type { Block, AnchorSettings, CharacterClassSettings, QuantifierSettings } from '@/components/regex-vision/types';
import { BlockType } from '@/components/regex-vision/types';
import { generateId, generateRegexString, createAnchor, createCharClass, createQuantifier, escapeRegexChars } from '@/components/regex-vision/utils';


const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-inter',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600'],
  variable: '--font-jetbrains-mono',
});

interface BasicPatternOptionsFromQuery {
  containsDigits: boolean;
  containsLettersAz: boolean;
  containsLettersAZ: boolean;
  containsSpace: boolean;
  otherChars: string;
}

interface LengthOptionsState {
  restriction: 'no' | 'yes';
  minLength?: number;
  maxLength?: number;
}

export default function BasicPatternsLengthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [basicPatternOptions, setBasicPatternOptions] = useState<BasicPatternOptionsFromQuery | null>(null);
  const [lengthOptions, setLengthOptions] = useState<LengthOptionsState>({
    restriction: 'no',
    minLength: 1,
  });
  const [generatedRegexString, setGeneratedRegexString] = useState<string | null>(null);

  useEffect(() => {
    const digits = searchParams.get('digits') === 'true';
    const az = searchParams.get('az') === 'true';
    const AZ = searchParams.get('AZ') === 'true';
    const space = searchParams.get('space') === 'true';
    const other = searchParams.get('otherChars') || '';
    setBasicPatternOptions({
      containsDigits: digits,
      containsLettersAz: az,
      containsLettersAZ: AZ,
      containsSpace: space,
      otherChars: other,
    });
  }, [searchParams]);

  const handleLengthOptionChange = (key: keyof LengthOptionsState, value: any) => {
    setLengthOptions((prev) => ({ ...prev, [key]: value }));
    setGeneratedRegexString(null); // Reset generated regex if options change
  };

  const buildRegexBlocks = useCallback((): Block[] => {
    if (!basicPatternOptions) return [];

    const blocks: Block[] = [];
    let patternChars = '';
    if (basicPatternOptions.containsDigits) patternChars += '\\d';
    if (basicPatternOptions.containsLettersAz) patternChars += 'a-z';
    if (basicPatternOptions.containsLettersAZ) patternChars += 'A-Z';
    if (basicPatternOptions.containsSpace) patternChars += '\\s';
    if (basicPatternOptions.otherChars) {
      patternChars += escapeRegexChars(basicPatternOptions.otherChars);
    }

    if (!patternChars) return []; // Should not happen if navigated correctly

    blocks.push(createAnchor('^'));
    
    const charClassBlock: Block = createCharClass(patternChars);

    let quantifierType: QuantifierSettings['type'] = '+';
    let minForQuantifier: number | undefined = undefined;
    let maxForQuantifier: number | null | undefined = undefined;

    if (lengthOptions.restriction === 'yes') {
      minForQuantifier = typeof lengthOptions.minLength === 'number' ? lengthOptions.minLength : 1;
      maxForQuantifier = typeof lengthOptions.maxLength === 'number' && lengthOptions.maxLength >= (minForQuantifier || 0) ? lengthOptions.maxLength : null;

      if (minForQuantifier === 1 && maxForQuantifier === null) quantifierType = '+';
      else if (minForQuantifier === 0 && maxForQuantifier === null) quantifierType = '*';
      else if (minForQuantifier !== undefined && maxForQuantifier === null) quantifierType = '{n,}';
      else if (minForQuantifier !== undefined && maxForQuantifier !== undefined && minForQuantifier === maxForQuantifier) quantifierType = '{n}';
      else if (minForQuantifier !== undefined && maxForQuantifier !== undefined) quantifierType = '{n,m}';
    } else {
        quantifierType = '+'; // Default to one or more if no restriction
    }
    
    blocks.push(charClassBlock);
    blocks.push(createQuantifier(quantifierType, minForQuantifier, maxForQuantifier));
    blocks.push(createAnchor('$'));
    return blocks;
  }, [basicPatternOptions, lengthOptions]);


  const handleGenerateRegex = () => {
    if (!basicPatternOptions) {
        toast({ title: "Ошибка", description: "Не удалось получить параметры базового шаблона.", variant: "destructive"});
        return;
    }
    
    const blocks = buildRegexBlocks();
    if (blocks.length === 0) {
        toast({ title: "Информация", description: "Не выбраны символы для шаблона. Regex не сгенерирован.", variant: "default"});
        setGeneratedRegexString("");
        return;
    }

    const regexStr = generateRegexString(blocks);
    setGeneratedRegexString(regexStr);

    console.log("Final Basic Pattern Options:", basicPatternOptions);
    console.log("Final Length Options:", lengthOptions);
    console.log("Generated Blocks:", blocks);
    console.log("Generated Regex String:", regexStr);
    // In a future step, these blocks would be passed back to the main editor
  };

  const handleCopyToClipboard = () => {
    if (generatedRegexString) {
      navigator.clipboard.writeText(generatedRegexString)
        .then(() => toast({ title: "Скопировано!", description: "Регулярное выражение скопировано в буфер обмена." }))
        .catch(() => toast({ title: "Ошибка", description: "Не удалось скопировать.", variant: "destructive" }));
    }
  };

  const createQueryString = (params: Record<string, string | boolean | undefined>) => {
    const q = new URLSearchParams();
    for (const key in params) {
      if (params[key] !== undefined) {
        q.set(key, String(params[key]));
      }
    }
    return q.toString();
  };
  
  const handleBack = () => {
    if (basicPatternOptions) {
        const query = createQueryString({
            digits: basicPatternOptions.containsDigits,
            az: basicPatternOptions.containsLettersAz,
            AZ: basicPatternOptions.containsLettersAZ,
            space: basicPatternOptions.containsSpace,
            otherChars: basicPatternOptions.otherChars,
        });
        router.push(`/wizard/validate/basic-patterns?${query}`);
    } else {
        router.push('/wizard/validate/basic-patterns');
    }
  };


  return (
    <div className={`${inter.variable} ${jetbrainsMono.variable} wizard-body-styles wizard-step-page`}>
      <Head>
        <title>Мастер: Простые Шаблоны - Длина строки</title>
      </Head>

      <div className="wizard-header">
         <Button
          onClick={handleBack}
          variant="outline"
          className="absolute left-4 top-4 md:left-8 md:top-8 text-sm flex items-center gap-1 p-2 rounded-md transition-colors"
          aria-label="Назад к выбору символов"
        >
          <ChevronLeft size={18} /> Назад
        </Button>
        <h1>Проверка: Простые Шаблоны - Длина строки</h1>
        <p>Укажите, если нужно ограничить длину строки.</p>
      </div>

      <Card className="w-full max-w-lg mx-auto">
        <CardHeader>
          <CardTitle>Ограничения по длине</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <RadioGroup
            value={lengthOptions.restriction}
            onValueChange={(value) => handleLengthOptionChange('restriction', value as 'no' | 'yes')}
          >
            <div className="flex items-center space-x-2 p-3 border rounded-md hover:bg-muted/50 has-[:checked]:bg-accent/20 has-[:checked]:border-accent">
              <RadioGroupItem value="no" id="length-no" />
              <Label htmlFor="length-no" className="flex-1 cursor-pointer text-sm font-normal">Нет, любая длина</Label>
            </div>
            <div className="p-3 border rounded-md hover:bg-muted/50 has-[:checked]:bg-accent/20 has-[:checked]:border-accent">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="length-yes" />
                <Label htmlFor="length-yes" className="flex-1 cursor-pointer text-sm font-normal">Да, указать минимум и/или максимум</Label>
              </div>
              {lengthOptions.restriction === 'yes' && (
                <div className="mt-4 pl-7 space-y-4">
                  <div>
                    <Label htmlFor="minLength" className="text-xs text-muted-foreground">Минимальное число символов</Label>
                    <Input
                      id="minLength"
                      type="number"
                      value={lengthOptions.minLength ?? ''}
                      onChange={(e) => handleLengthOptionChange('minLength', parseInt(e.target.value, 10) || 0)}
                      placeholder="например, 1"
                      min="0"
                      className="h-9 text-sm mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="maxLength" className="text-xs text-muted-foreground">Максимальное число символов (необязательно)</Label>
                    <Input
                      id="maxLength"
                      type="number"
                      value={lengthOptions.maxLength ?? ''}
                      onChange={(e) => handleLengthOptionChange('maxLength', e.target.value ? parseInt(e.target.value, 10) : undefined)}
                      placeholder="оставить пустым для 'без максимума'"
                      min={lengthOptions.minLength ?? 0}
                      className="h-9 text-sm mt-1"
                    />
                     {lengthOptions.maxLength !== undefined && lengthOptions.minLength !== undefined && lengthOptions.maxLength < lengthOptions.minLength && (
                        <p className="text-xs text-destructive mt-1">Максимальная длина не может быть меньше минимальной.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </RadioGroup>
        </CardContent>
        <CardFooter className="flex flex-col items-stretch gap-4 pt-6">
           <Button 
            onClick={handleGenerateRegex}
            disabled={lengthOptions.restriction === 'yes' && lengthOptions.maxLength !== undefined && lengthOptions.minLength !== undefined && lengthOptions.maxLength < lengthOptions.minLength}
          >
            Сгенерировать Regex
          </Button>

          {generatedRegexString !== null && (
            <Card className="mt-4 bg-muted/30">
              <CardHeader className="py-2 px-3 border-b">
                <CardTitle className="text-sm">Сгенерированное выражение:</CardTitle>
              </CardHeader>
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <code className="font-mono text-sm bg-background p-2 rounded-md flex-1 break-all">
                    /{generatedRegexString}/
                  </code>
                  <Button variant="outline" size="icon" onClick={handleCopyToClipboard} title="Копировать Regex">
                    <Copy size={16} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
