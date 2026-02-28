/**
 * Плашка «В разработке» — закрывает часть функционала.
 * Легко убрать: найти InDevelopmentOverlay и удалить обёртки.
 */
import React from 'react';
import { Construction } from 'lucide-react';

interface InDevelopmentOverlayProps {
  children: React.ReactNode;
  active?: boolean;
}

export const InDevelopmentOverlay: React.FC<InDevelopmentOverlayProps> = ({ children, active = true }) => {
  if (!active) return <>{children}</>;
  return (
    <div className="relative w-full h-full min-h-[200px]">
      {children}
      <div
        className="absolute inset-0 z-40 flex items-center justify-center bg-white/80 dark:bg-[#191919]/90 backdrop-blur-sm pointer-events-auto"
        style={{ minHeight: '200px' }}
      >
        <div className="flex flex-col items-center gap-3 px-6 py-8 rounded-2xl bg-white dark:bg-[#252525] border-2 border-dashed border-amber-400 dark:border-amber-600 shadow-lg">
          <Construction size={40} className="text-amber-500 dark:text-amber-400" />
          <span className="text-lg font-semibold text-gray-800 dark:text-white">В разработке</span>
          <span className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-xs">
            Этот раздел пока находится в разработке
          </span>
        </div>
      </div>
    </div>
  );
};
