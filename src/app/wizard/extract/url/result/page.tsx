
'use client';
import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Copy, CheckCircle, Globe } from 'lucide-react';
import { Inter, JetBrains_Mono } from 'next/font/google';
import '../../../wizard.css'; // Reuse common styles from parent wizard
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import type { Block } from '@/components/regex-vision/types';
import { generateRegexString, generateBlocksForURL } from '@/components/regex-vision/utils';

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-inter',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600'],
  variable: '--font-jetbrains-mono',
});

export default function ExtractURLResultPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [generatedRegex, setGeneratedRegex] = useState<string>('');

  useEffect(() => {
    // Pass `true` for extraction, `false` for not requiring protocol in extraction
    const urlBlocks: Block[] = generateBlocksForURL(true, false); 
    const regexString = generateRegexString(urlBlocks);
    setGeneratedRegex(regexString);
  }, []);

  const handleCopyToClipboard = () => {
    if (generatedRegex) {
      navigator.clipboard.writeText(`/${generatedRegex}/g`) // Assuming global flag for extraction
        .then(() => toast({ title: "Скопировано!", description: "Регулярное выражение для извлечения URL скопировано." }))
        .catch(() => toast({ title: "Ошибка", description: "Не удалось скопировать.", variant: "destructive" }));
    }
  };
  
  const handleGoToEditor = () => {
    if (generatedRegex) {
        navigator.clipboard.writeText(`/${generatedRegex}/g`) 
        .then(() => toast({ title: "Скопировано!", description: "Regex для извлечения URL скопирован. Переход в редактор..." }))
        .catch(() => toast({ title: "Ошибка копирования", description: "Не удалось скопировать перед переходом."}));
    }
    router.push('/'); // Navigate to main editor page
  };

  return (
    <div className={`${inter.variable} ${jetbrainsMono.variable} wizard-body-styles wizard-step-page`}>
      <Head>
        <title>Мастер: Извлечение URL - Результат</title>
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
        <h1>Извлечение: URL - Готовое выражение</h1>
        <p>Ниже представлено регулярное выражение для поиска и извлечения URL-адресов из текста.</p>
      </div>

      <Card className="w-full max-w-2xl mx-auto"> {/* Max-width adjusted for potentially long URL regex */}
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe size={20} className="text-primary" />
            Regex для извлечения URL
          </CardTitle>
          <CardDescription>
            Это выражение предназначено для поиска URL-адресов в тексте. Оно включает захватывающую группу вокруг всего URL. 
            Протокол (http/https) является необязательным. Рекомендуется использовать с флагом 'g' (глобальный поиск).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {generatedRegex ? (
            <div className="flex items-center gap-2 bg-muted/50 p-3 rounded-md">
              <code className="font-mono text-xs sm:text-sm flex-1 break-all">
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
