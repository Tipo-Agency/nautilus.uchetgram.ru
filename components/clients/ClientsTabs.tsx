import React from 'react';

interface ClientsTabsProps {
  activeTab: 'clients' | 'contracts' | 'finance' | 'receivables';
  onTabChange: (tab: 'clients' | 'contracts' | 'finance' | 'receivables') => void;
}

const tabBase = 'flex items-center justify-center gap-1 px-3 py-1.5 rounded-full text-xs transition-colors shrink-0';
const tabActive = 'bg-white dark:bg-[#191919] text-gray-900 dark:text-white shadow-sm';
const tabInactive = 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white';

export const ClientsTabs: React.FC<ClientsTabsProps> = ({ activeTab, onTabChange }) => {
  return (
    <div className="mb-6">
      <div className="flex w-full items-center gap-1 bg-gray-100 dark:bg-[#252525] rounded-full p-1 text-xs">
        <button onClick={() => onTabChange('clients')} className={`${tabBase} ${activeTab === 'clients' ? tabActive : tabInactive}`}>База клиентов</button>
        <button onClick={() => onTabChange('contracts')} className={`${tabBase} ${activeTab === 'contracts' ? tabActive : tabInactive}`}>Реестр договоров и продаж</button>
        <button onClick={() => onTabChange('finance')} className={`${tabBase} ${activeTab === 'finance' ? tabActive : tabInactive}`}>Финансы / Оплаты</button>
        <button onClick={() => onTabChange('receivables')} className={`${tabBase} ${activeTab === 'receivables' ? tabActive : tabInactive}`}>Задолженности</button>
      </div>
    </div>
  );
};

