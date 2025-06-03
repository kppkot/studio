
'use client';
import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Copy, CheckCircle, Shuffle } from 'lucide-react';
import { Inter, JetBrains_Mono } from 'next/font/google';
import '../../../wizard.css'; // Reuse common styles from parent wizard
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import type { Block } from '@/components/regex-vision/types';
import { generateRegexString, generateBlocksForDuplicateWords } from '@/components/regex-vision/utils';

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-inter',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600'],
  variable: '--font-jetbrains-mono',
});

export default function ExtractDuplicateWordsResultPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [generatedRegex, setGeneratedRegex] = useState<string>('');

  useEffect(() => {
    const duplicateWordsBlocks: Block[] = generateBlocksForDuplicateWords(); 
    const regexString = generateRegexString(duplicateWordsBlocks);
    setGeneratedRegex(regexString);
  }, []);

  const handleCopyToClipboard = () => {
    if (generatedRegex) {
      navigator.clipboard.writeText(`/${generatedRegex}/g`) // Assuming global flag for extraction
        .then(() => toast({ title: "Скопировано!", description: "Регулярное выражение для повторяющихся слов скопировано." }))
        .catch(() => toast({ title: "Ошибка", description: "Не удалось скопировать.", variant: "destructive" }));
    }
  };
  
  const handleGoToEditor = () => {
    if (generatedRegex) {
        navigator.clipboard.writeText(`/${generatedRegex}/g`) 
        .then(() => toast({ title: "Скопировано!", description: "Regex для повторяющихся слов скопирован. Переход в редактор..." }))
        .catch(() => toast({ title: "Ошибка копирования", description: "Не удалось скопировать перед переходом."}));
    }
    router.push('/'); // Navigate to main editor page
  };

  return (
    <div className={`${inter.variable} ${jetbrainsMono.variable} wizard-body-styles wizard-step-page`}>
      <Head>
        <title>Мастер: Повторяющиеся слова - Результат</title>
      </Head>

      <div className="wizard-header">
        <Button
          onClick={() => router.push('/wizard/extract')}
          variant="outline"
          className="absolute left-4 top-4 md:left-8 md:top-8 text-sm flex items-center gap-1 p-2 rounded-md transition-colors"
          aria-label="Назад к выбору типа извлечения"
        >
          <ChevronLeft size={18} /> Назад
        </Button>
        <h1>Извлечение: Повторяющиеся слова - Готовое выражение</h1>
        <p>Ниже представлено регулярное выражение для поиска слов, которые повторяются в тексте. Оно захватывает первое вхождение такого слова.</p>
      </div>

      <Card className="w-full max-w-lg mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shuffle size={20} className="text-primary" />
            Regex для повторяющихся слов
          </CardTitle>
          <CardDescription>
            Это выражение находит первое вхождение слова, которое встречается в тексте более одного раза. Слово захватывается в группу.
            Рекомендуется использовать с флагом 'g' (глобальный поиск) для нахождения всех таких слов.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {generatedRegex ? (
            <div className="flex items-center gap-2 bg-muted/50 p-3 rounded-md">
              <code className="font-mono text-sm flex-1 break-all">
                /{generatedRegex}/g
              </code>
              <Button variant="outline" size="icon" onClick={handleCopyToClipboard} title="Копировать Regex">
                <Copy size={16} />
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Генерация выражения...</p>
          )}
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-end gap-2 pt-6">
           <Button variant="outline" onClick={() => router.push('/wizard/extract')}>
            <ChevronLeft size={16} className="mr-1" />
            К выбору типа извлечения
          </Button>
          <Button onClick={handleGoToEditor}>
            Скопировать и в редактор
            <CheckCircle size={16} className="ml-1" />
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
