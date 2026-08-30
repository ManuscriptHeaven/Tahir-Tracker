import React from 'react';
import { Sparkles, Mic } from 'lucide-react';

interface AIFloatingButtonProps {
  onClick: () => void;
  isListening?: boolean;
}

export const AIFloatingButton: React.FC<AIFloatingButtonProps> = ({ onClick, isListening }) => {
  return (
    <div className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-40 no-print">
      <button
        onClick={onClick}
        aria-label="Open AI Voice Assistant"
        className={`group relative flex items-center gap-2 p-3.5 sm:px-4 sm:py-3 rounded-2xl shadow-xl transition-all duration-200 transform hover:scale-105 active:scale-95 ${
          isListening
            ? 'bg-rose-500 text-white shadow-rose-500/40 animate-pulse'
            : 'bg-gradient-to-tr from-emerald-700 via-teal-600 to-emerald-600 text-white shadow-emerald-700/30 hover:shadow-emerald-700/50'
        }`}
      >
        {/* Glow Ring */}
        <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-300 opacity-30 group-hover:opacity-75 blur-sm transition duration-300 group-hover:duration-200" />
        
        {/* Button Content */}
        <div className="relative flex items-center gap-2">
          <div className="relative">
            <Mic className="w-5 h-5 stroke-[2.5]" />
            <Sparkles className="w-2.5 h-2.5 text-amber-300 absolute -top-1 -right-1 animate-spin" />
          </div>
          <span className="hidden sm:inline-block font-extrabold text-xs tracking-tight">
            AI Assistant
          </span>
        </div>
      </button>
    </div>
  );
};
