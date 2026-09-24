import React from 'react';
import { Sparkles, Mic } from 'lucide-react';

interface AIFloatingButtonProps {
  onClick: () => void;
  isListening?: boolean;
}

export const AIFloatingButton: React.FC<AIFloatingButtonProps> = ({ onClick, isListening }) => {
  return (
    <div 
      className="fixed right-3.5 sm:right-6 z-30 no-print bottom-[calc(env(safe-area-inset-bottom,0px)+4.75rem)] sm:bottom-6"
    >
      <button
        onClick={onClick}
        aria-label="Open AI Voice Assistant"
        className={`group relative flex items-center gap-2 p-2.5 sm:px-4 sm:py-3 rounded-2xl shadow-xl transition-all duration-200 transform hover:scale-105 active:scale-95 cursor-pointer ${
          isListening
            ? 'bg-rose-500 text-white shadow-rose-500/40 animate-pulse'
            : 'bg-gradient-to-tr from-teal-500 to-[#18E6BE] text-[#06131F] shadow-[0_0_20px_rgba(24,230,190,0.3)] hover:shadow-[0_0_30px_rgba(24,230,190,0.5)]'
        }`}
      >
        {/* Glow Ring */}
        <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-teal-400 to-[#18E6BE] opacity-40 group-hover:opacity-80 blur-sm transition duration-300 group-hover:duration-200" />
        
        {/* Button Content */}
        <div className="relative flex items-center gap-1.5 sm:gap-2">
          <div className="relative">
            <Mic className="w-4.5 h-4.5 sm:w-5 sm:h-5 stroke-[2.5]" />
            <Sparkles className="w-2.5 h-2.5 text-amber-300 absolute -top-1 -right-1 animate-spin" />
          </div>
          <span className="hidden sm:inline-block font-black text-xs tracking-tight">
            AI Assistant
          </span>
        </div>
      </button>
    </div>
  );
};
