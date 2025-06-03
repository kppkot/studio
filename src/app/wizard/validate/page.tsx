
'use client';
import React from 'react';
import Head from 'next/head';
import { useRouter } from 'next/navigation';
import { FileText, BadgeCheck, CalendarClock, ChevronLeft } from 'lucide-react'; // Changed CheckBadge to BadgeCheck
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

interface ValidationOption {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  path: string; 
}

const validationOptions: ValidationOption[] = [
  {
    id: 'basic',
    label: 'Простые шаблоны',
    description: 'Цифры, буквы, длина, символы и т.д.',
    icon: FileText,
    path: '/wizard/validate/basic-patterns',
  },
  {
    id: 'standard',
    label: 'Стандартные форматы',
    description: 'Email, URL, Телефон, IP, Пароль.',
    icon: BadgeCheck, // Changed CheckBadge to BadgeCheck
    path: '/wizard/validate/standard-formats', 
  },
  {
    id: 'datetime',
    label: 'Дата и время',
    description: 'ДД/ММ/ГГГГ, ЧЧ:ММ и т.д.',
    icon: CalendarClock,
    path: '/wizard/validate/datetime-formats', // Placeholder path
  },
];

export default function ValidateCategoryPage() {
  const router = useRouter();

  const handleOptionClick = (option: ValidationOption) => {
    console.log(`Validation option clicked: ${option.id}, navigating to ${option.path}`);
    router.push(option.path);
  };

  return (
    <div className={`${inter.variable} ${jetbrainsMono.variable} wizard-body-styles`}>
      <Head>
        <title>Мастер: Проверка Формата Строки</title>
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
        <h1>Проверка Формата Строки</h1>
        <p>Какой тип проверки вам нужен? Выберите один из вариантов ниже, чтобы продолжить.</p>
      </div>

      <div className="cards-grid" style={{gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', maxWidth: '1024px'}}>
        {validationOptions.map((option) => (
          <Card
            key={option.id}
            className="wizard-step-card card" // Reusing card style for consistency
            onClick={() => handleOptionClick(option)}
          >
            <CardHeader className="p-4">
               <div className="card-visual wizard-step-visual mx-auto mb-2"> {/* Centered icon */}
                <option.icon size={48} className="text-primary opacity-80" />
              </div>
              <CardTitle className="card-title wizard-step-title text-center">{option.label}</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="card-description wizard-step-description text-center">{option.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

    
