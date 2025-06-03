
'use client';
import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Copy, CheckCircle, Eraser } from 'lucide-react';
import { Inter, JetBrains_Mono } from 'next/font/google';
import '../../../wizard.css'; // Reuse common styles from parent wizard
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import type { Block } from '@/components/regex-vision/types';
import { generateRegexString, generateBlocksForMultipleSpaces } from '@/components/regex-vision/utils';

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-inter',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600'],
  variable: '--font-jetbrains-mono',
});

export default function ReplaceMultipleSpacesResultPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [generatedRegex, setGeneratedRegex] = useState<string>('');
  const replacementString = " (один пробел)"; // Recommended replacement string

  useEffect(() => {
    const multipleSpacesBlocks: Block[] = generateBlocksForMultipleSpaces(); 
    const regexString = generateRegexString(multipleSpacesBlocks);
    setGeneratedRegex(regexString);
  }, []);

  const handleCopyToClipboard = () => {
    if (generatedRegex) {
      // For replacement, often only the regex pattern itself is copied, not the full /regex/flags format
      navigator.clipboard.writeText(generatedRegex)
        .then(() => toast({ title: "Скопировано!", description: "Regex для поиска нескольких пробелов скопирован." }))
        .catch(() => toast({ title: "Ошибка", description: "Не удалось скопировать.", variant: "destructive" }));
    }
  };
  
  const handleGoToEditor = () => {
    if (generatedRegex) {
        // Copying just the pattern to clipboard, flags and replacement are handled by the editor/user
        navigator.clipboard.writeText(generatedRegex) 
        .then(() => toast({ title: "Скопировано!", description: "Regex для поиска нескольких пробелов скопирован. Переход в редактор..." }))
        .catch(() => toast({ title: "Ошибка копирования", description: "Не удалось скопировать перед переходом."}));
    }
    router.push('/'); // Navigate to main editor page
  };

  return (
    <div className={`${inter.variable} ${jetbrainsMono.variable} wizard-body-styles wizard-step-page`}>
      <Head>
        <title>Мастер: Замена Нескольких Пробелов - Результат</title>
      </Head>

      <div className="wizard-header">
        <Button
          onClick={() => router.push('/wizard/replace')}
          variant="outline"
          className="absolute left-4 top-4 md:left-8 md:top-8 text-sm flex items-center gap-1 p-2 rounded-md transition-colors"
          aria-label="Назад к выбору типа замены"
        >
          <ChevronLeft size={18} /> Назад
        </Button>
        <h1>Замена: Несколько пробелов на один</h1>
        <p>Ниже представлено регулярное выражение для поиска последовательностей из двух и более пробельных символов.</p>
      </div>

      <Card className="w-full max-w-lg mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eraser size={20} className="text-primary" />
            Regex для поиска нескольких пробелов
          </CardTitle>
          <CardDescription>
            Это выражение находит две и более последовательности пробельных символов (пробелы, табы и т.д.).
            Рекомендуется заменять найденное на один пробел.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {generatedRegex ? (
            <div className="flex items-center gap-2 bg-muted/50 p-3 rounded-md">
              <code className="font-mono text-sm flex-1 break-all">
                {generatedRegex}
              </code>
              <Button variant="outline" size="icon" onClick={handleCopyToClipboard} title="Копировать Regex">
                <Copy size={16} />
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Генерация выражения...</p>
          )}
          <div>
            <Label className="text-xs text-muted-foreground">Рекомендуемая строка для замены:</Label>
            <p className="text-sm font-mono p-2 bg-muted/30 rounded-md mt-1">" "</p>
            <p className="text-xs text-muted-foreground mt-1"> (т.е. один символ пробела) </p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-end gap-2 pt-6">
           <Button variant="outline" onClick={() => router.push('/wizard/replace')}>
            <ChevronLeft size={16} className="mr-1" />
            К выбору типа замены
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
