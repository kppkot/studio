
'use client';
import React from 'react';
import Head from 'next/head';
import { useRouter } from 'next/navigation'; // Import useRouter
import './wizard.css'; // Import the CSS
import { Inter, JetBrains_Mono } from 'next/font/google';

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-inter',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600'],
  variable: '--font-jetbrains-mono',
});

export default function WizardPage() {
  const router = useRouter();

  const handleCardClick = (category: string) => {
    console.log(`Card clicked: ${category}`);
    if (category === 'validate') {
      router.push('/wizard/validate');
    } else if (category === 'extract') {
      router.push('/wizard/extract');
    }
    // Add navigation for other categories later
    // Example: router.push(`/wizard/${category}`);
  };

  return (
    <div className={`${inter.variable} ${jetbrainsMono.variable} wizard-body-styles`}>
      <Head>
        <title>Мастер Регулярных Выражений</title>
        {/* Font Awesome is in RootLayout now */}
      </Head>

      <div className="wizard-header">
        <h1>Мастер Регулярных Выражений</h1>
        <p>Добро пожаловать! Выберите основную задачу, и мы поможем вам шаг за шагом создать или подобрать нужное регулярное выражение для эффективной работы с текстом.</p>
      </div>

      <div className="cards-grid">
        {/* 1. Проверить Формат Строки (Валидация) */}
        <div className="card validate" onClick={() => handleCardClick('validate')}>
          <div className="card-visual">
            <div className="validation-demo-area">
              <div className="input-field-container">
                <div className="input-field-visual" id="validationInputCard1">
                  <span className="validation-text-anim"></span>
                </div>
                <div className="status-indicator" id="statusIndicatorCard1">
                  <i className="fas fa-check" style={{ display: 'none' }}></i>
                  <i className="fas fa-times" style={{ display: 'none' }}></i>
                </div>
              </div>
              <div className="validation-note">Строка проходит "фильтр" шаблона...</div>
            </div>
          </div>
          <h3 className="card-title">Проверить Формат Строки</h3>
          <p className="card-description">
            Убедитесь, что вся строка целиком соответствует заданному шаблону. Идеально для валидации email, телефонов, дат, паролей или других данных со строгими правилами.
          </p>
          <p className="card-hint">
            Email, URL, Номер карты, Почтовый индекс.
          </p>
        </div>

        {/* 2. Найти и Извлечь Данные */}
        <div className="card extract" onClick={() => handleCardClick('extract')}>
          <div className="card-visual">
            <div className="extract-demo-area">
              <div className="source-text-area">
                <div className="scanner-line-extract"></div>
                <div className="text-line">... client: <span className="highlight-item found-email">info@mail.co</span> ...</div>
                <div className="text-line">... order <span className="highlight-item found-id">#AB-12345</span> placed ...</div>
                <div className="text-line">... on date: <span className="highlight-item found-date">2024/08/15</span> ...</div>
                <div className="text-line" style={{ opacity: 0.5 }}>... other data ...</div>
              </div>
              <div className="extracted-results-panel">
                <div className="result-chip-extract show-email">
                  <i className="fas fa-envelope"></i>
                  <span>info@mail.co</span>
                </div>
                <div className="result-chip-extract show-id">
                  <i className="fas fa-hashtag"></i>
                  <span>AB-12345</span>
                </div>
                <div className="result-chip-extract show-date">
                  <i className="fas fa-calendar-alt"></i>
                  <span>2024/08/15</span>
                </div>
              </div>
            </div>
          </div>
          <h3 className="card-title">Найти и Извлечь Данные</h3>
          <p className="card-description">
            Автоматически находите и "вытаскивайте" нужную информацию из любого текста: email-адреса, номера заказов, даты, ссылки и многое другое. Регулярные выражения действуют как умный фильтр.
          </p>
          <p className="card-hint">
            Контакты, Коды товаров, Даты, URL-компоненты.
          </p>
        </div>

        {/* 3. Заменить или Изменить Текст */}
        <div className="card replace" onClick={() => handleCardClick('replace')}>
          <div className="card-visual">
            <div className="replacement-demo-area">
              <div className="text-block-container-replace text-before-replace">
                <span className="label">ДО:</span>
                <span className="content" id="textBeforeContentCard3">Текст   с   лишними   пробелами.</span>
              </div>
              <div className="transformation-arrow-container-replace" id="transformArrowCard3">
                <i className="fas fa-long-arrow-alt-down"></i>
              </div>
              <div className="text-block-container-replace text-after-replace">
                <span className="label">ПОСЛЕ:</span>
                <span className="content" id="textAfterContentCard3">Текст с лишними пробелами.</span>
              </div>
            </div>
          </div>
          <h3 className="card-title">Заменить или Изменить Текст</h3>
          <p className="card-description">
            Трансформируйте текст, находя и заменяя определённые участки. Полезно для исправления ошибок, удаления ненужных символов, маскирования данных или форматирования.
          </p>
          <p className="card-hint">
            Удаление пробелов/тегов, Замена слов, Маскирование.
          </p>
        </div>

        {/* 4. Разделить Текст на Части */}
        <div className="card split" onClick={() => handleCardClick('split')}>
          <div className="card-visual">
            <div className="split-demo-area">
              <div className="original-string-container-split">
                <span className="content" id="originalStringContentCard4">Яблоко,Банан,Апельсин</span>
                <div className="split-delimiter-visual" id="delimiterVisualCard4"></div>
              </div>
              <div className="split-delimiter-label">
                Разделяем по <strong id="delimiterTypeLabelCard4">запятой (,)</strong>
              </div>
              <div className="split-results-container-split" id="splitResultsContainerCard4">
                {/* Сегменты будут добавлены сюда JS */}
              </div>
            </div>
          </div>
          <h3 className="card-title">Разделить Текст на Части</h3>
          <p className="card-description">
            Преобразуйте одну длинную строку в набор отдельных элементов. Укажите символ или правило-разделитель,
            и текст будет аккуратно разбит на удобные для работы части.
          </p>
          <p className="card-hint">
            CSV по запятой, Слова по пробелу, Логи по символам.
          </p>
        </div>

        {/* 5. Проверить Условие в Тексте */}
        <div className="card condition" onClick={() => handleCardClick('condition')}>
          <div className="card-visual">
            <div className="gate-check-area">
              <div className="text-flow-container">
                <div className="flowing-text" id="flowingTextSampleCard5">Заявка №123 СРОЧНО</div>
              </div>
              <div className="condition-gate-container">
                <div className="gate-signal" id="gateSignalCard5"></div>
                <div className="gate-posts">
                  <div className="gate-condition-symbol" id="gateConditionSymbolCard5">
                    <i className="fas fa-exclamation-triangle"></i>
                  </div>
                </div>
                <div className="gate-label" id="gateConditionLabelCard5">Условие: "СРОЧНО"</div>
              </div>
            </div>
          </div>
          <h3 className="card-title">Проверить Условие в Тексте</h3>
          <p className="card-description">
            Определите, соответствует ли текст заданному критерию: содержит ли он нужные слова, цифры, или, наоборот, отсутствуют ли нежелательные элементы. Мгновенный ответ "Да" или "Нет".
          </p>
          <p className="card-hint">
            Есть ли "ошибка", Содержит цифры, Не содержит "спам".
          </p>
        </div>

        {/* 6. Свой Шаблон (PRO Режим / Конструктор) */}
        <div className="card pro-mode" onClick={() => handleCardClick('pro-mode')}>
          <div className="card-visual">
            <div className="pro-constructor-area">
              <div className="regex-building-blocks">
                <div className="block-item" id="blockAnchorCard6">^ (Начало)</div>
                <div className="block-item" id="blockGroupCard6">(Группа)</div>
                <div className="block-item" id="blockClassCard6">[A-Za-z0-9]</div>
                <div className="block-item" id="blockQuantCard6">{'{1,5}'}?</div>
              </div>
              <div className="constructed-pattern-display" id="finalPatternCard6">
                Собранный PRO-шаблон
              </div>
              <div className="result-application-area" id="proResultTextCard6">
                Исходный текст... <span className="highlighted">PRO<span className="sub-highlight">123</span></span> ... найден!
              </div>
            </div>
          </div>
          <h3 className="card-title">Свой Шаблон (PRO Режим)</h3>
          <p className="card-description">
            Для сложных и уникальных задач. Комбинируйте "строительные блоки" — якоря, группы, классы символов, квантификаторы — для создания мощных и точных правил.
          </p>
          <p className="card-hint">
            Lookarounds, Флаги, Именованные группы, Сложные условия.
          </p>
        </div>
      </div>
      {/* The script part from your HTML is complex and directly manipulates DOM.
          For a React app, this logic should be rewritten using React state and effects.
          For this initial step, to get the visuals, we'll defer implementing the JS animations.
          If you absolutely need the animations now, they would require significant refactoring
          to work correctly within React's lifecycle.
      */}
    </div>
  );
}

    