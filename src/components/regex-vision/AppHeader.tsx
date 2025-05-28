"use client";
import React from 'react';
import { Share2, DownloadCloud, UploadCloud, Puzzle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AppHeaderProps {
  onShare?: () => void;
  onExport?: () => void;
  onImport?: () => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({ onShare, onExport, onImport }) => {
  return (
    <header className="bg-card border-b p-3 shadow-sm">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Puzzle className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold text-primary">RegexVision</h1>
          <span className="text-sm text-muted-foreground hidden md:block">
            Визуальный конструктор и анализатор Regex
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {onShare && (
            <Button variant="outline" size="sm" onClick={onShare}>
              <Share2 size={16} />
              <span className="ml-2 hidden sm:inline">Поделиться</span>
            </Button>
          )}
          {onExport && (
            <Button variant="outline" size="sm" onClick={onExport}>
              <DownloadCloud size={16} />
              <span className="ml-2 hidden sm:inline">Экспорт</span>
            </Button>
          )}
           {onImport && (
            <Button variant="outline" size="sm" onClick={onImport}>
              <UploadCloud size={16} />
              <span className="ml-2 hidden sm:inline">Импорт</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
