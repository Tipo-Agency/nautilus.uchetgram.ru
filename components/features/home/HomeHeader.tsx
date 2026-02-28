/**
 * HomeHeader - приветствие + единая кнопка «Плюс» справа (задача, сделка, процесс, заявка на приобретение)
 */
import React, { useState, useRef, useEffect } from 'react';
import { User } from '../../../types';
import { Plus, CheckCircle2, Briefcase, Network, Wallet, ChevronDown } from 'lucide-react';

interface HomeHeaderProps {
  user: User;
  onQuickCreateTask: () => void;
  onQuickCreateDeal: () => void;
  onQuickCreateProcess: () => void;
  onQuickCreatePurchaseRequest: () => void;
}

export const HomeHeader: React.FC<HomeHeaderProps> = ({
  user,
  onQuickCreateTask,
  onQuickCreateDeal,
  onQuickCreateProcess,
  onQuickCreatePurchaseRequest,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hour = new Date().getHours();
  let greeting: string;
  if (hour >= 6 && hour < 12) greeting = 'Доброе утро';
  else if (hour >= 12 && hour < 18) greeting = 'Добрый день';
  else if (hour >= 18 && hour < 23) greeting = 'Добрый вечер';
  else greeting = 'Доброй ночи';

  const today = new Date();
  const dayOfWeek = today.toLocaleDateString('ru-RU', { weekday: 'long' });
  const dayOfMonth = today.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  const formattedDate = `${dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1)}, ${dayOfMonth}`;

  const menuItems = [
    { icon: CheckCircle2, label: 'Задача', onClick: onQuickCreateTask },
    { icon: Briefcase, label: 'Сделка', onClick: onQuickCreateDeal },
    { icon: Network, label: 'Процесс', onClick: onQuickCreateProcess },
    { icon: Wallet, label: 'Заявка на приобретение', onClick: onQuickCreatePurchaseRequest },
  ];

  return (
    <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-1">
          {greeting}, {user.name}!
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">{formattedDate}</p>
      </div>
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#382EA6] hover:bg-[#2d2485] text-white font-medium transition-colors shadow-sm"
        >
          <Plus size={20} />
          <span>Создать</span>
          <ChevronDown size={16} className={dropdownOpen ? 'rotate-180' : ''} />
        </button>
        {dropdownOpen && (
          <div className="absolute right-0 top-full mt-2 py-1 w-56 bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl shadow-xl z-50">
            {menuItems.map(({ icon: Icon, label, onClick }) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  onClick();
                  setDropdownOpen(false);
                }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#333] transition-colors"
              >
                <Icon size={16} className="text-gray-500 dark:text-gray-400 shrink-0" />
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
