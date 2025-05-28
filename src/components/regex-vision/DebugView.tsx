"use client";
import React from 'react';
import { Bug } from 'lucide-react';

const DebugView: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
      <Bug size={48} className="mb-4 opacity-50" />
      <h3 className="text-lg font-semibold">Regex Debugger</h3>
      <p className="text-sm text-center mt-1">
        The interactive step-by-step debugger is planned for a future update.
      </p>
      <p className="text-xs text-center mt-2">
        This feature will allow you to simulate the regex engine's matching process, observe backtracks, and inspect group captures at each step.
      </p>
    </div>
  );
};

export default DebugView;
