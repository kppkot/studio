
'use client';
import React, { useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/navigation';
import { FileText, BadgeCheck, CalendarClock, ChevronLeft } from 'lucide-react';
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
  icon?: React.ElementType; // Make icon optional for custom visuals
  path: string;
  visualDemo?: React.ReactNode; // For custom HTML structure
}

// Animation functions (adapted from main wizard page)
const typeValidationText = (element: HTMLElement, text: string, onComplete?: () => void) => {
  let i = 0;
  element.innerHTML = '';
  const typing = setInterval(() => {
    if (i < text.length) {
      element.innerHTML += text.charAt(i);
      i++;
    } else {
      clearInterval(typing);
      if (onComplete) onComplete();
    }
  }, 70);
  return typing;
};

const clearValidationText = (element: HTMLElement, onComplete?: () => void) => {
  let text = element.innerHTML;
  let i = text.length - 1;
  const clearing = setInterval(() => {
    if (i >= 0) {
      element.innerHTML = text.substring(0, i);
      i--;
    } else {
      clearInterval(clearing);
      if (onComplete) onComplete();
    }
  }, 30);
  return clearing;
};

const animateValidationInput = (inputId: string, indicatorId: string) => {
  const inputEl = document.getElementById(inputId) as HTMLElement;
  const indicatorEl = document.getElementById(indicatorId) as HTMLElement;
  const textSpan = inputEl?.querySelector('.validation-text-anim') as HTMLElement;

  if (!inputEl || !indicatorEl || !textSpan) return;

  let currentInterval: NodeJS.Timeout | null = null;
  const scenarios = [
    { text: "user@example.com", valid: true, note: "Email проходит валидацию..." },
    { text: "invalid-email", valid: false, note: "Строка не соответствует шаблону email." },
    { text: "123-45-678", valid: true, note: "Номер телефона соответствует формату." },
    { text: "ABC", valid: false, note: "Только заглавные буквы не проходят." }
  ];
  let scenarioIndex = 0;

  const runScenario = () => {
    if (currentInterval) clearInterval(currentInterval);
    const scenario = scenarios[scenarioIndex];
    const noteEl = inputEl.closest('.validation-demo-area')?.querySelector('.validation-note') as HTMLElement;
    if(noteEl) noteEl.textContent = scenario.note;

    inputEl.classList.remove('valid', 'invalid');
    indicatorEl.classList.remove('valid', 'invalid');
    indicatorEl.style.display = 'none';
    if (indicatorEl.querySelector('.fa-check')) (indicatorEl.querySelector('.fa-check') as HTMLElement).style.display = 'none';
    if (indicatorEl.querySelector('.fa-times')) (indicatorEl.querySelector('.fa-times') as HTMLElement).style.display = 'none';
    

    currentInterval = typeValidationText(textSpan, scenario.text, () => {
      setTimeout(() => {
        inputEl.classList.add(scenario.valid ? 'valid' : 'invalid');
        indicatorEl.style.display = 'flex';
        indicatorEl.classList.add(scenario.valid ? 'valid' : 'invalid');
        if (scenario.valid && indicatorEl.querySelector('.fa-check')) (indicatorEl.querySelector('.fa-check') as HTMLElement).style.display = 'inline';
        if (!scenario.valid && indicatorEl.querySelector('.fa-times')) (indicatorEl.querySelector('.fa-times') as HTMLElement).style.display = 'inline';

        currentInterval = setTimeout(() => {
          clearValidationText(textSpan, () => {
            inputEl.classList.remove('valid', 'invalid');
            indicatorEl.classList.remove('valid', 'invalid');
            indicatorEl.style.display = 'none';
             if (indicatorEl.querySelector('.fa-check')) (indicatorEl.querySelector('.fa-check') as HTMLElement).style.display = 'none';
             if (indicatorEl.querySelector('.fa-times')) (indicatorEl.querySelector('.fa-times') as HTMLElement).style.display = 'none';
            scenarioIndex = (scenarioIndex + 1) % scenarios.length;
            setTimeout(runScenario, 500);
          });
        }, 2000);
      }, 500);
    });
  };
  runScenario();
};


const validationOptions: ValidationOption[] = [
  {
    id: 'basic',
    label: 'Простые шаблоны',
    description: 'Цифры, буквы, длина, символы и т.д.',
    path: '/wizard/validate/basic-patterns',
    visualDemo: (
      <div className="validation-demo-area">
        <div className="input-field-container">
          <div className="input-field-visual" id="validationInput_ValidatePage_Basic">
            <span className="validation-text-anim"></span>
          </div>
          <div className="status-indicator" id="statusIndicator_ValidatePage_Basic">
            <i className="fas fa-check" style={{ display: 'none' }}></i>
            <i className="fas fa-times" style={{ display: 'none' }}></i>
          </div>
        </div>
        <div className="validation-note">Строка проходит "фильтр" шаблона...</div>
      </div>
    )
  },
  {
    id: 'standard',
    label: 'Стандартные форматы',
    description: 'Email, URL, Телефон, IP, Пароль.',
    icon: BadgeCheck,
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

  useEffect(() => {
    // Attempt to start animation for the "Простые шаблоны" card
    // Ensure FontAwesome is loaded for icons in status indicator
    const faLink = document.querySelector('link[href*="font-awesome"]');
    if (faLink) {
        animateValidationInput('validationInput_ValidatePage_Basic', 'statusIndicator_ValidatePage_Basic');
    } else {
        // Fallback or wait for FontAwesome if critical for animation
        console.warn("FontAwesome not detected, status icons in animation might be missing.");
        // Could try to load it dynamically or retry animation after a delay
         animateValidationInput('validationInput_ValidatePage_Basic', 'statusIndicator_ValidatePage_Basic');
    }


    // Cleanup function for intervals if component unmounts
    return () => {
        const inputEl = document.getElementById('validationInput_ValidatePage_Basic');
        // A bit hacky: trying to clear intervals associated with this animation.
        // Better would be if animateValidationInput returned the interval IDs.
        // For now, we assume intervals might still be running and this is a demo.
        // A more robust solution would involve managing interval IDs directly.
        if (inputEl) {
            // This is a placeholder for a more robust cleanup
            // e.g., if animateValidationInput returned interval IDs to be cleared.
        }
    };
  }, []);


  const handleOptionClick = (option: ValidationOption) => {
    console.log(`Validation option clicked: ${option.id}, navigating to ${option.path}`);
    router.push(option.path);
  };

  return (
    <div className={`${inter.variable} ${jetbrainsMono.variable} wizard-body-styles wizard-step-page`}>
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
            className="wizard-step-card card"
            onClick={() => handleOptionClick(option)}
          >
            <CardHeader className="p-4">
              <div className="card-visual wizard-step-visual mx-auto mb-2">
                {option.visualDemo ? option.visualDemo : (option.icon && <option.icon size={48} className="text-primary opacity-80" />)}
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
