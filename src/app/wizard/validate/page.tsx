
'use client';
import React, { useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/navigation';
import { FileText, BadgeCheck, CalendarClock, ChevronLeft, AtSign, Globe, Network, CheckCircle, XCircle } from 'lucide-react';
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
  icon?: React.ElementType;
  path: string;
  visualDemo?: React.ReactNode;
  disabled?: boolean;
  animationFn?: (idPrefix: string, scenarios?: any[], scenarioTypes?: string[], noteValid?: string, noteInvalid?: string) => (() => void) | void;
}

// --- Анимация для "Простые шаблоны" ---
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

const animateValidationInput = (
  inputId: string,
  indicatorId: string,
  scenarios: { text: string; valid: boolean; note: string; type?: string }[],
  scenarioTypes?: string[], // unused for this animation type, kept for signature consistency
  noteValid?: string, // unused, note comes from scenario
  noteInvalid?: string // unused, note comes from scenario
): (() => void) => {
  const inputEl = document.getElementById(inputId) as HTMLElement;
  const indicatorEl = document.getElementById(indicatorId) as HTMLElement;
  const textSpan = inputEl?.querySelector('.validation-text-anim') as HTMLElement;

  if (!inputEl || !indicatorEl || !textSpan) return () => {};

  let currentIntervals: (NodeJS.Timeout | number)[] = [];
  let scenarioIndex = 0;

  const runScenario = () => {
    currentIntervals.forEach(clearInterval);
    currentIntervals = [];

    const scenario = scenarios[scenarioIndex];
    const noteEl = inputEl.closest('.validation-demo-area')?.querySelector('.validation-note') as HTMLElement;
    if (noteEl) noteEl.textContent = scenario.note;

    inputEl.classList.remove('valid', 'invalid');
    indicatorEl.classList.remove('valid', 'invalid');
    indicatorEl.style.display = 'none';
    const checkIcon = indicatorEl.querySelector('.fa-check') as HTMLElement;
    const timesIcon = indicatorEl.querySelector('.fa-times') as HTMLElement;
    if (checkIcon) checkIcon.style.display = 'none';
    if (timesIcon) timesIcon.style.display = 'none';

    const typingInterval = typeValidationText(textSpan, scenario.text, () => {
      const timeout1 = setTimeout(() => {
        inputEl.classList.add(scenario.valid ? 'valid' : 'invalid');
        indicatorEl.style.display = 'flex';
        indicatorEl.classList.add(scenario.valid ? 'valid' : 'invalid');
        if (scenario.valid && checkIcon) checkIcon.style.display = 'inline';
        if (!scenario.valid && timesIcon) timesIcon.style.display = 'inline';

        const timeout2 = setTimeout(() => {
          const clearingInterval = clearValidationText(textSpan, () => {
            inputEl.classList.remove('valid', 'invalid');
            indicatorEl.classList.remove('valid', 'invalid');
            indicatorEl.style.display = 'none';
            if (checkIcon) checkIcon.style.display = 'none';
            if (timesIcon) timesIcon.style.display = 'none';
            scenarioIndex = (scenarioIndex + 1) % scenarios.length;
            const timeout3 = setTimeout(runScenario, 500);
            currentIntervals.push(timeout3);
          });
          currentIntervals.push(clearingInterval);
        }, 2000);
        currentIntervals.push(timeout2);
      }, 500);
      currentIntervals.push(timeout1);
    });
    currentIntervals.push(typingInterval);
  };

  runScenario();
  return () => {
    currentIntervals.forEach(clearInterval);
    currentIntervals.forEach(clearTimeout);
  };
};


// --- Анимация для "Стандартные форматы" (чек-лист) ---
const animateStandardFormatsChecklist = (checklistAreaId: string): (() => void) => {
  const checklistArea = document.getElementById(checklistAreaId);
  if (!checklistArea) return () => {};

  const items = [
    { name: "Email", icon: AtSign, valid: true, example: "user@example.com" },
    { name: "URL", icon: Globe, valid: true, example: "https://regex.vision" },
    { name: "IP Адрес", icon: Network, valid: false, example: "999.999.999.999" },
    { name: "Телефон", icon: Phone, valid: true, example: "+1 (555) 123-4567" },
  ];
  let currentItemIndex = 0;
  let currentTimeout: NodeJS.Timeout | null = null;

  const showNextItem = () => {
    if (!checklistArea) return;
    checklistArea.innerHTML = ''; // Clear previous items

    const itemData = items[currentItemIndex];

    const itemDiv = document.createElement('div');
    itemDiv.className = 'checklist-item standard-format-item';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'item-name';
    nameSpan.textContent = itemData.name;
    
    const exampleSpan = document.createElement('span');
    exampleSpan.className = 'item-example';
    exampleSpan.textContent = ` (${itemData.example.substring(0,15)+(itemData.example.length > 15 ? '...' : '')})`;


    const statusIconPlaceholder = document.createElement('div');
    statusIconPlaceholder.className = 'status-icon-placeholder';

    itemDiv.appendChild(statusIconPlaceholder);
    itemDiv.appendChild(nameSpan);
    itemDiv.appendChild(exampleSpan);
    checklistArea.appendChild(itemDiv);

    // Animate item appearance
    setTimeout(() => itemDiv.classList.add('visible'), 50);


    currentTimeout = setTimeout(() => {
      const iconSvg = itemData.valid
        ? `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check-circle text-green-500"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x-circle text-red-500"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>`;
      statusIconPlaceholder.innerHTML = iconSvg;
      statusIconPlaceholder.classList.add('visible');

      currentItemIndex = (currentItemIndex + 1) % items.length;
      currentTimeout = setTimeout(showNextItem, 2000); // Next item after 2s
    }, 1000); // Show icon after 1s
  };

  showNextItem();

  return () => {
    if (currentTimeout) clearTimeout(currentTimeout);
  };
};


const basicPatternScenarios = [
  { text: "Regex123", valid: true, note: "Содержит буквы и цифры..." },
  { text: "ТолькоТекст", valid: false, note: "Только буквы, а нужно и цифры..." },
  { text: "Пример с пробелом", valid: true, note: "Пробелы разрешены..." },
  { text: "_Спец-Символы!", valid: false, note: "Специальные символы не указаны..." }
];

const standardFormatScenarios = [ // These are now just for note text for animateValidationInput if it were used
  { text: "test@example.com", valid: true, note: "Проверка Email...", type: "email" },
  { text: "invalid-email", valid: false, note: "Проверка Email...", type: "email" },
  { text: "https://regex.vision", valid: true, note: "Проверка URL...", type: "url" },
  { text: "ftp://[::1]:21", valid: true, note: "Проверка URL (IPv6 FTP)...", type: "url" },
  { text: "192.168.1.1", valid: true, note: "Проверка IP-адреса (IPv4)...", type: "ip" },
  { text: "2001:db8::1", valid: true, note: "Проверка IP-адреса (IPv6)...", type: "ip" },
];


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
    ),
    animationFn: (idPrefix) => animateValidationInput(
      `validationInput_ValidatePage_${idPrefix}`,
      `statusIndicator_ValidatePage_${idPrefix}`,
      basicPatternScenarios
    )
  },
  {
    id: 'standard',
    label: 'Стандартные форматы',
    description: 'Email, URL, Телефон, IP, Пароль.',
    icon: BadgeCheck,
    path: '/wizard/validate/standard-formats',
    visualDemo: (
      <div className="standard-formats-checklist-area" id="checklistArea_ValidatePage_Standard">
        {/* Items will be populated by JS */}
      </div>
    ),
    animationFn: (idPrefix) => animateStandardFormatsChecklist(
      `checklistArea_ValidatePage_${idPrefix}`
    )
  },
  {
    id: 'datetime',
    label: 'Дата и время',
    description: 'ДД/ММ/ГГГГ, ЧЧ:ММ и т.д.',
    icon: CalendarClock,
    path: '/wizard/validate/datetime-formats',
    disabled: true,
    visualDemo: ( // Placeholder, can be made unique later
      <div className="validation-demo-area">
        <div className="input-field-container">
          <div className="input-field-visual" id="validationInput_ValidatePage_DateTime">
            <span className="validation-text-anim"></span>
          </div>
          <div className="status-indicator" id="statusIndicator_ValidatePage_DateTime">
            <i className="fas fa-check" style={{ display: 'none' }}></i>
            <i className="fas fa-times" style={{ display: 'none' }}></i>
          </div>
        </div>
        <div className="validation-note">Проверка формата даты и времени...</div>
      </div>
    ),
     animationFn: (idPrefix) => animateValidationInput(
      `validationInput_ValidatePage_${idPrefix}`,
      `statusIndicator_ValidatePage_${idPrefix}`,
      [{text: "2024-07-15", valid: true, note: "Проверка даты..."}, {text: "35/13/2023", valid: false, note: "Неверная дата..."}]
    )
  },
];

export default function ValidateCategoryPage() {
  const router = useRouter();

  useEffect(() => {
    const cleanupFunctions: (() => void)[] = [];
    const faLink = document.querySelector('link[href*="font-awesome"]');

    const onFaLoaded = () => {
      validationOptions.forEach(opt => {
        if (opt.animationFn && !opt.disabled) {
          const cleanup = opt.animationFn(opt.id);
          if (cleanup) cleanupFunctions.push(cleanup);
        }
      });
    };

    if (faLink) {
      const linkElement = faLink as HTMLLinkElement;
      if (linkElement.sheet || (linkElement.style && linkElement.style.cssText)) { // Check if stylesheet is loaded
        onFaLoaded();
      } else {
        linkElement.addEventListener('load', onFaLoaded);
        cleanupFunctions.push(() => linkElement.removeEventListener('load', onFaLoaded));
      }
    } else {
      console.warn("FontAwesome not reliably detected for status icons in 'Простые шаблоны' animation.");
      onFaLoaded(); // Attempt animations anyway
    }

    return () => {
      cleanupFunctions.forEach(cleanup => cleanup());
    };
  }, []);


  const handleOptionClick = (option: ValidationOption) => {
    if (option.disabled) return;
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
            className={`wizard-step-card card ${option.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={() => handleOptionClick(option)}
            aria-disabled={option.disabled}
          >
            <CardHeader className="p-4">
              <div className="card-visual wizard-step-visual mx-auto mb-2">
                {option.visualDemo ? option.visualDemo : (option.icon && <option.icon size={48} className="text-primary opacity-80" />)}
              </div>
              <CardTitle className="card-title wizard-step-title text-center">{option.label}</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="card-description wizard-step-description text-center">{option.description}</p>
              {option.disabled && <p className="text-xs text-amber-600 dark:text-amber-400 text-center mt-1">(скоро)</p>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
