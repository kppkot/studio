
'use client';
import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, Copy, CheckCircle } from 'lucide-react';
import { Inter, JetBrains_Mono } from 'next/font/google';
import '../../../../wizard.css'; // Reuse common styles
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

export default function UrlValidationResultPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [generatedRegex, setGeneratedRegex] = useState<string>('');

  useEffect(() => {
    const requireProtocolParam = searchParams.get('requireProtocol');
    if (requireProtocolParam === null) {
      // Handle missing param, maybe redirect or show error
      toast({ title: "Ошибка", description: "Параметр requireProtocol отсутствует.", variant: "destructive" });
      router.push('/wizard/validate/standard-formats/url'); // Go back to selection
      return;
    }
    const requireProtocol = requireProtocolParam === 'true';
    const urlBlocks: Block[] = generateBlocksForURL(false, requireProtocol);
    const regexString = generateRegexString(urlBlocks);
    setGeneratedRegex(regexString);
  }, [searchParams, router, toast]);

  const handleCopyToClipboard = () => {
    if (generatedRegex) {
      navigator.clipboard.writeText(`/${generatedRegex}/g`)
        .then(() => toast({ title: "Скопировано!", description: "Регулярное выражение для URL скопировано." }))
        .catch(() => toast({ title: "Ошибка", description: "Не удалось скопировать.", variant: "destructive" }));
    }
  };

  const handleGoToEditor = () => {
    if (generatedRegex) {
      navigator.clipboard.writeText(`/${generatedRegex}/g`)
        .then(() => toast({ title: "Скопировано!", description: "Regex для URL скопирован. Переход в редактор..." }))
        .catch(() => toast({ title: "Ошибка копирования", description: "Не удалось скопировать перед переходом."}));
    }
    router.push('/'); // Navigate to main editor page
  };
  
  const handleBack = () => {
     const requireProtocolParam = searchParams.get('requireProtocol');
     router.push(`/wizard/validate/standard-formats/url${requireProtocolParam ? `?requireProtocol=${requireProtocolParam}` : '' }`);
  }

  return (
    <div className={`${inter.variable} ${jetbrainsMono.variable} wizard-body-styles wizard-step-page`}>
      <Head>
        <title>Мастер: Проверка URL - Результат</title>
      </Head>

      <div className="wizard-header">
        <Button
          onClick={handleBack}
          variant="outline"
          className="absolute left-4 top-4 md:left-8 md:top-8 text-sm flex items-center gap-1 p-2 rounded-md transition-colors"
          aria-label="Назад к выбору опций URL"
        >
          <ChevronLeft size={18} /> Назад
        </Button>
        <h1>Проверка: URL - Готовое выражение</h1>
        <p>Ниже представлено регулярное выражение для проверки корректности URL.</p>
      </div>

      <Card className="w-full max-w-lg mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle size={20} className="text-green-500" />
            Regex для URL
          </CardTitle>
          <CardDescription>
            Это выражение соответствует общепринятым стандартам для URL адресов.
            Оно ожидает, что вся строка является валидным URL.
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
           <Button variant="outline" onClick={() => router.push('/wizard/validate/standard-formats')}>
            <ChevronLeft size={16} className="mr-1" />
            К выбору формата
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
