
'use client';
import React from 'react';
import Head from 'next/head';
import { useRouter } from 'next/navigation';
import { Eraser, Shuffle, KeyRound, Wand2, ChevronLeft } from 'lucide-react';
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

interface ReplaceOption {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  path: string;
  disabled?: boolean;
}

const replaceOptions: ReplaceOption[] = [
  {
    id: 'multipleSpaces',
    label: 'Несколько пробелов → один',
    description: 'Заменить последовательности пробелов одним пробелом.',
    icon: Eraser,
    path: '/wizard/replace/multiple-spaces/result',
  },
  {
    id: 'tabsToSpaces',
    label: 'Табуляция → пробелы',
    description: 'Заменить символы табуляции на пробелы.',
    icon: Eraser, // Using Eraser as a generic replace icon
    path: '/wizard/replace/tabs-to-spaces/result', 
    disabled: true,
  },
  {
    id: 'removeHtml',
    label: 'Удалить HTML-теги',
    description: 'Очистить текст от HTML-разметки.',
    icon: Eraser, // Using Eraser
    path: '/wizard/replace/remove-html/result',
    disabled: true,
  },
  {
    id: 'swapParts',
    label: 'Сменить порядок (swap)',
    description: 'Поменять местами части текста с помощью групп.',
    icon: Shuffle,
    path: '/wizard/replace/swap-parts', // Needs an input step
    disabled: true,
  },
  {
    id: 'maskDigits',
    label: 'Маскировать цифры',
    description: 'Скрыть часть цифровой последовательности (например, номера карт).',
    icon: KeyRound,
    path: '/wizard/replace/mask-digits', // Needs an input step
    disabled: true,
  },
  {
    id: 'otherReplace',
    label: 'Другое (ввести паттерн и замену)',
    description: 'Задать свой паттерн поиска и строку для замены.',
    icon: Wand2,
    path: '/wizard/replace/custom', // Needs input steps
    disabled: true,
  },
];

export default function ReplaceCategoryPage() {
  const router = useRouter();

  const handleOptionClick = (option: ReplaceOption) => {
    if (option.disabled) return;
    console.log(`Replace option clicked: ${option.id}, navigating to ${option.path}`);
    router.push(option.path);
  };

  return (
    <div className={`${inter.variable} ${jetbrainsMono.variable} wizard-body-styles wizard-step-page`}>
      <Head>
        <title>Мастер: Заменить или Изменить Текст</title>
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
        <h1>Заменить или Изменить Текст</h1>
        <p>Какой тип замены или трансформации текста вы хотите выполнить?</p>
      </div>

      <div className="cards-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', maxWidth: '1024px' }}>
        {replaceOptions.map((option) => (
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
