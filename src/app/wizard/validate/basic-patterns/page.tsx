
'use client';
import React, { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Inter, JetBrains_Mono } from 'next/font/google';
import '../../wizard.css'; // Reuse common styles
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-inter',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600'],
  variable: '--font-jetbrains-mono',
});

interface BasicPatternOptions {
  containsDigits: boolean;
  containsLettersAz: boolean;
  containsLettersAZ: boolean;
  containsSpace: boolean;
  enableOtherChars: boolean;
  otherChars: string;
}

export default function BasicPatternsPage() {
  const router = useRouter();
  const [options, setOptions] = useState<BasicPatternOptions>({
    containsDigits: false,
    containsLettersAz: false,
    containsLettersAZ: false,
    containsSpace: false,
    enableOtherChars: false,
    otherChars: '',
  });

  const handleCheckboxChange = (id: keyof BasicPatternOptions) => {
    setOptions((prev) => ({ ...prev, [id]: !prev[id as keyof Pick<BasicPatternOptions, 'containsDigits' | 'containsLettersAz' | 'containsLettersAZ' | 'containsSpace' | 'enableOtherChars'>] }));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setOptions((prev) => ({ ...prev, otherChars: e.target.value }));
  };

  const handleNext = () => {
    console.log("Current basic pattern options:", options);
    // router.push('/wizard/validate/basic-patterns/length'); // Next step
  };

  return (
    <div className={`${inter.variable} ${jetbrainsMono.variable} wizard-body-styles wizard-step-page`}>
      <Head>
        <title>Мастер: Простые Шаблоны - Содержимое</title>
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
        <h1>Проверка: Простые Шаблоны</h1>
        <p>Выберите, какие типы символов должна или может содержать ваша строка.</p>
      </div>

      <Card className="w-full max-w-lg mx-auto">
        <CardHeader>
          <CardTitle>Содержимое строки</CardTitle>
          <CardDescription>Отметьте необходимые опции.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { id: 'containsDigits', label: 'Цифры (0-9)' },
            { id: 'containsLettersAz', label: 'Буквы (a-z)' },
            { id: 'containsLettersAZ', label: 'Большие буквы (A-Z)' },
            { id: 'containsSpace', label: 'Пробелы' },
          ].map((item) => (
            <div key={item.id} className="flex items-center space-x-2 p-3 border rounded-md hover:bg-muted/50">
              <Checkbox
                id={item.id}
                checked={options[item.id as keyof BasicPatternOptions] as boolean}
                onCheckedChange={() => handleCheckboxChange(item.id as keyof BasicPatternOptions)}
              />
              <Label htmlFor={item.id} className="flex-1 cursor-pointer text-sm font-normal">
                {item.label}
              </Label>
            </div>
          ))}

          <div className="p-3 border rounded-md hover:bg-muted/50">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="enableOtherChars"
                checked={options.enableOtherChars}
                onCheckedChange={() => handleCheckboxChange('enableOtherChars')}
              />
              <Label htmlFor="enableOtherChars" className="flex-1 cursor-pointer text-sm font-normal">
                Другие разрешенные символы
              </Label>
            </div>
            {options.enableOtherChars && (
              <div className="mt-3 pl-7">
                <Input
                  id="otherChars"
                  value={options.otherChars}
                  onChange={handleInputChange}
                  placeholder="например, _-!@#"
                  className="h-9 text-sm"
                />
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-2 pt-6">
           <Button variant="outline" onClick={() => router.push('/wizard/validate')}>
            <ChevronLeft size={16} className="mr-1" />
            Назад
          </Button>
          <Button onClick={handleNext}>
            Далее
            <ChevronRight size={16} className="ml-1" />
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

    