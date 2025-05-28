"use client";
import React from 'react';
import { Bug } from 'lucide-react';

const DebugView: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
      <Bug size={48} className="mb-4 opacity-50" />
      <h3 className="text-lg font-semibold">Отладчик Regex</h3>
      <p className="text-sm text-center mt-1">
        Интерактивный пошаговый отладчик планируется в будущем обновлении.
      </p>
      <p className="text-xs text-center mt-2">
        Эта функция позволит вам симулировать процесс сопоставления движка regex, наблюдать за возвратами и проверять захваты групп на каждом шаге.
      </p>
    </div>
  );
};

export default DebugView;
