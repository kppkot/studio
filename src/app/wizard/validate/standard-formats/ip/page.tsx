
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

export default function IpTypePage() {
  const router = useRouter();
  const [ipType, setIpType] = useState<'ipv4' | 'ipv6' | undefined>(undefined);

  const handleNext = () => {
    if (ipType) {
      router.push(`/wizard/validate/standard-formats/ip/result?ipType=${ipType}`);
    }
  };

  return (
    <div className={`${inter.variable} ${jetbrainsMono.variable} wizard-body-styles wizard-step-page`}>
      <Head>
        <title>Мастер: Проверка IP - Тип</title>
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
        <h1>Проверка: IP-адрес - Тип</h1>
        <p>Какой тип IP-адреса вы хотите проверить?</p>
      </div>

      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Выберите тип IP-адреса</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup
            value={ipType}
            onValueChange={(value) => setIpType(value as 'ipv4' | 'ipv6')}
          >
            <div className="flex items-center space-x-2 p-3 border rounded-md hover:bg-muted/50 has-[:checked]:bg-accent/20 has-[:checked]:border-accent">
              <RadioGroupItem value="ipv4" id="ip-ipv4" />
              <Label htmlFor="ip-ipv4" className="flex-1 cursor-pointer text-sm font-normal">
                IPv4 (например, 192.168.0.1)
              </Label>
            </div>
            <div className="flex items-center space-x-2 p-3 border rounded-md hover:bg-muted/50 has-[:checked]:bg-accent/20 has-[:checked]:border-accent">
              <RadioGroupItem value="ipv6" id="ip-ipv6" />
              <Label htmlFor="ip-ipv6" className="flex-1 cursor-pointer text-sm font-normal">
                IPv6 (например, 2001:0db8::1)
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
        <CardFooter className="flex justify-end gap-2 pt-6">
          <Button variant="outline" onClick={() => router.push('/wizard/validate/standard-formats')}>
            <ChevronLeft size={16} className="mr-1" />
            К выбору формата
          </Button>
          <Button onClick={handleNext} disabled={!ipType}>
            Далее
            <ChevronRight size={16} className="ml-1" />
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
