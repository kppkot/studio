'use client';
import React from 'react';
import Head from 'next/head';
import { useRouter } from 'next/navigation';
import { FileText, CheckBadge, CalendarClock, ChevronLeft } from 'lucide-react';
import { Inter, JetBrains_Mono } from 'next/font/google';
import '../wizard.css'; // Reuse common styles

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
  nextStep?: string; // Placeholder for future navigation
}

const validationOptions: ValidationOption[] = [
  {
    id: 'basic',
    label: 'Простые шаблоны',
    description: 'Цифры, буквы, длина, символы и т.д.',
    icon: FileText,
    nextStep: '/wizard/validate/basic-patterns', // Example next step
  },
  {
    id: 'standard',
    label: 'Стандартные форматы',
    description: 'Email, URL, Телефон, IP, Пароль.',
    icon: CheckBadge,
    nextStep: '/wizard/validate/standard-formats', // Example next step
  },
  {
    id: 'datetime',
    label: 'Дата и время',
    description: 'ДД/ММ/ГГГГ, ЧЧ:ММ и т.д.',
    icon: CalendarClock,
    nextStep: '/wizard/validate/datetime-formats', // Example next step
  },
];

export default function ValidateCategoryPage() {
  const router = useRouter();

  const handleOptionClick = (option: ValidationOption) => {
    console.log(`Validation option clicked: ${option.id}`);
    if (option.nextStep) {
      // router.push(option.nextStep); // Enable when next pages are ready
      console.log(`Would navigate to: ${option.nextStep}`);
    }
  };

  return (
    <div className={`${inter.variable} ${jetbrainsMono.variable} wizard-body-styles`}>
      <Head>
        <title>Мастер: Проверка Формата Строки</title>
      </Head>

      <div className="wizard-header">
        <button 
          onClick={() => router.push('/wizard')} 
          className="absolute left-4 top-4 md:left-8 md:top-8 text-sm text-gray-600 hover:text-primary flex items-center gap-1 p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          aria-label="Назад к выбору категории"
        >
          <ChevronLeft size={18} /> Назад
        </button>
        <h1>Проверка Формата Строки</h1>
        <p>Какой тип проверки вам нужен? Выберите один из вариантов ниже, чтобы продолжить.</p>
      </div>

      <div className="cards-grid" style={{gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', maxWidth: '1024px'}}>
        {validationOptions.map((option) => (
          <div
            key={option.id}
            className="card wizard-step-card" // Added wizard-step-card for potential specific styling
            onClick={() => handleOptionClick(option)}
          >
            <div className="card-visual wizard-step-visual">
              <option.icon size={48} className="text-primary opacity-80" />
            </div>
            <h3 className="card-title wizard-step-title">{option.label}</h3>
            <p className="card-description wizard-step-description">{option.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
