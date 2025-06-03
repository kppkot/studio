
'use client';
import React from 'react';
import Head from 'next/head';
import { useRouter } from 'next/navigation';
import { AtSign, Globe, Phone, Route, KeyRound, ChevronLeft } from 'lucide-react';
import { Inter, JetBrains_Mono } from 'next/font/google';
import '../../wizard.css'; // Reuse common styles
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

interface StandardFormatOption {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  path: string;
  disabled?: boolean;
}

const standardFormatOptions: StandardFormatOption[] = [
  {
    id: 'email',
    label: 'Email (эл. почта)',
    description: 'Проверка корректности адреса электронной почты.',
    icon: AtSign,
    path: '/wizard/validate/standard-formats/email',
  },
  {
    id: 'url',
    label: 'URL (веб-адрес)',
    description: 'Проверка корректности URL-адреса.',
    icon: Globe,
    path: '/wizard/validate/standard-formats/url',
    disabled: true,
  },
  {
    id: 'phone',
    label: 'Телефон',
    description: 'Проверка различных форматов телефонных номеров.',
    icon: Phone,
    path: '/wizard/validate/standard-formats/phone',
    disabled: true,
  },
  {
    id: 'ip',
    label: 'IP-адрес',
    description: 'Проверка адресов IPv4 или IPv6.',
    icon: Route,
    path: '/wizard/validate/standard-formats/ip',
    disabled: true,
  },
  {
    id: 'password',
    label: 'Пароль',
    description: 'Проверка сложности пароля по заданным критериям.',
    icon: KeyRound,
    path: '/wizard/validate/standard-formats/password',
    disabled: true,
  },
];

export default function StandardFormatsPage() {
  const router = useRouter();

  const handleOptionClick = (option: StandardFormatOption) => {
    if (option.disabled) return;
    console.log(`Standard format option clicked: ${option.id}, navigating to ${option.path}`);
    router.push(option.path);
  };

  return (
    <div className={`${inter.variable} ${jetbrainsMono.variable} wizard-body-styles wizard-step-page`}>
      <Head>
        <title>Мастер: Проверка Стандартных Форматов</title>
      </Head>

      <div className="wizard-header">
        <Button 
          onClick={() => router.push('/wizard/validate')} 
          variant="outline"
          className="absolute left-4 top-4 md:left-8 md:top-8 text-sm flex items-center gap-1 p-2 rounded-md transition-colors"
          aria-label="Назад к выбору типа валидации"
        >
          <ChevronLeft size={18} /> Назад
        </Button>
        <h1>Проверка: Стандартные Форматы</h1>
        <p>Какой стандартный формат данных вы хотите проверить?</p>
      </div>

      <div className="cards-grid" style={{gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', maxWidth: '1024px'}}>
        {standardFormatOptions.map((option) => (
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
