
'use client';
import React from 'react';
import Head from 'next/head';
import { useRouter } from 'next/navigation';
import { AtSign, Globe, Calculator, MessageSquareQuote, TextCursorInput, Shuffle, ChevronLeft } from 'lucide-react'; // Changed CaseSensitive to Calculator
import { Inter, JetBrains_Mono } from 'next/font/google';
import '../wizard.css'; // Reuse common styles
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-inter',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600'],
  variable: '--font-jetbrains-mono',
});

interface ExtractOption {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  path: string;
  disabled?: boolean;
}

const extractOptions: ExtractOption[] = [
  {
    id: 'email',
    label: 'Все email-адреса',
    description: 'Найти и извлечь все адреса электронной почты.',
    icon: AtSign,
    path: '/wizard/extract/email/result',
  },
  {
    id: 'url',
    label: 'Все URL-адреса',
    description: 'Найти и извлечь все веб-адреса.',
    icon: Globe,
    path: '/wizard/extract/url/result',
    disabled: false,
  },
  {
    id: 'numbers',
    label: 'Все числа',
    description: 'Целые, десятичные, положительные, отрицательные.',
    icon: Calculator, // Using Calculator icon
    path: '/wizard/extract/numbers/result',
    disabled: false, // Enabled this option
  },
  {
    id: 'quotedText',
    label: 'Текст в кавычках',
    description: 'Извлечь содержимое одинарных или двойных кавычек.',
    icon: MessageSquareQuote,
    path: '/wizard/extract/quoted-text', // Needs a selection step
    disabled: true,
  },
  {
    id: 'specificWord',
    label: 'Слово/фразу (ввести)',
    description: 'Найти и извлечь конкретное слово или фразу.',
    icon: TextCursorInput,
    path: '/wizard/extract/specific-word', // Needs an input step
    disabled: true,
  },
  {
    id: 'duplicateWords',
    label: 'Повторяющиеся слова',
    description: 'Найти слова, которые повторяются в тексте.',
    icon: Shuffle,
    path: '/wizard/extract/duplicate-words/result',
    disabled: false,
  },
];

export default function ExtractCategoryPage() {
  const router = useRouter();

  const handleOptionClick = (option: ExtractOption) => {
    if (option.disabled) return;
    console.log(`Extract option clicked: ${option.id}, navigating to ${option.path}`);
    router.push(option.path);
  };

  return (
    <div className={`${inter.variable} ${jetbrainsMono.variable} wizard-body-styles wizard-step-page`}>
      <Head>
        <title>Мастер: Найти и Извлечь Данные</title>
      </Head>

      <div className="wizard-header">
        <Button
          onClick={() => router.push('/wizard')}
          variant="outline"
          className="absolute left-4 top-4 md:left-8 md:top-8 text-sm flex items-center gap-1 p-2 rounded-md transition-colors"
          aria-label="Назад к выбору категории"
        >
          <ChevronLeft size={18} /> Назад
        </Button>
        <h1>Найти и Извлечь Данные</h1>
        <p>Какой тип данных вы хотите найти и извлечь из текста?</p>
      </div>

      <div className="cards-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', maxWidth: '1024px' }}>
        {extractOptions.map((option) => (
          <Card
            key={option.id}
            className={`wizard-step-card card ${option.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={() => handleOptionClick(option)}
            aria-disabled={option.disabled}
          >
            <CardHeader className="p-4">
              <div className="card-visual wizard-step-visual mx-auto mb-2">
                <option.icon size={40} className="text-primary opacity-80" />
              </div>
              <CardTitle className="card-title wizard-step-title text-center text-lg">{option.label}</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="card-description wizard-step-description text-center text-xs">{option.description}</p>
              {option.disabled && <p className="text-xs text-amber-600 dark:text-amber-400 text-center mt-1">(скоро)</p>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
