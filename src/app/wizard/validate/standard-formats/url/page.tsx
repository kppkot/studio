
'use client';
import React, { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Inter, JetBrains_Mono } from 'next/font/google';
import '../../../wizard.css'; // Reuse common styles
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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

export default function UrlProtocolPage() {
  const router = useRouter();
  const [requireProtocol, setRequireProtocol] = useState<'yes' | 'no' | undefined>(undefined);

  const handleNext = () => {
    if (requireProtocol) {
      router.push(`/wizard/validate/standard-formats/url/result?requireProtocol=${requireProtocol}`);
    }
  };

  return (
    <div className={`${inter.variable} ${jetbrainsMono.variable} wizard-body-styles wizard-step-page`}>
      <Head>
        <title>Мастер: Проверка URL - Протокол</title>
      </Head>

      <div className="wizard-header">
        <Button
          onClick={() => router.push('/wizard/validate/standard-formats')}
          variant="outline"
          className="absolute left-4 top-4 md:left-8 md:top-8 text-sm flex items-center gap-1 p-2 rounded-md transition-colors"
          aria-label="Назад к выбору стандартного формата"
        >
          <ChevronLeft size={18} /> Назад
        </Button>
        <h1>Проверка: URL - Требуется ли протокол?</h1>
        <p>Укажите, должен ли URL обязательно содержать 'http://' или 'https://'.</p>
      </div>

      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Обязательность протокола</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup
            value={requireProtocol}
            onValueChange={(value) => setRequireProtocol(value as 'yes' | 'no')}
          >
            <div className="flex items-center space-x-2 p-3 border rounded-md hover:bg-muted/50 has-[:checked]:bg-accent/20 has-[:checked]:border-accent">
              <RadioGroupItem value="yes" id="protocol-yes" />
              <Label htmlFor="protocol-yes" className="flex-1 cursor-pointer text-sm font-normal">
                Да, http:// или https:// обязателен
              </Label>
            </div>
            <div className="flex items-center space-x-2 p-3 border rounded-md hover:bg-muted/50 has-[:checked]:bg-accent/20 has-[:checked]:border-accent">
              <RadioGroupItem value="no" id="protocol-no" />
              <Label htmlFor="protocol-no" className="flex-1 cursor-pointer text-sm font-normal">
                Нет, протокол не обязателен
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
        <CardFooter className="flex justify-end gap-2 pt-6">
          <Button variant="outline" onClick={() => router.push('/wizard/validate/standard-formats')}>
            <ChevronLeft size={16} className="mr-1" />
            К выбору формата
          </Button>
          <Button onClick={handleNext} disabled={!requireProtocol}>
            Далее
            <ChevronRight size={16} className="ml-1" />
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
