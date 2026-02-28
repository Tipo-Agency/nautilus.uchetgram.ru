/**
 * FeedEntityCard — карточка сущности в ленте Входящих/Исходящих.
 * Показывает тип, название, статус, ответственного, дату. Клик — открыть сущность.
 */
import React from 'react';
import { Task, Deal, Meeting, PurchaseRequest, User, Client } from '../../../types';
import { CheckSquare, Briefcase, Users, Wallet, Network, ChevronRight } from 'lucide-react';
import { UserAvatar } from '../common/UserAvatar';

export type FeedItemType = 'task' | 'deal' | 'meeting' | 'purchase_request' | 'process';

export interface FeedItem {
  type: FeedItemType;
  id: string;
  title: string;
  status: string;
  statusColor?: string;
  date: string;
  assignee?: User;
  creator?: User; // Кто поставил / создал (автор)
  isSystem?: boolean; // Системная/авто сущность
  entity: Task | Deal | Meeting | PurchaseRequest;
  client?: Client;
}

interface FeedEntityCardProps {
  item: FeedItem;
  onClick: () => void;
}

const TYPE_LABELS: Record<FeedItemType, string> = {
  task: 'Задача',
  deal: 'Сделка',
  meeting: 'Встреча',
  purchase_request: 'Заявка на приобретение',
  process: 'Процесс',
};

const TYPE_ICONS: Record<FeedItemType, React.ReactNode> = {
  task: <CheckSquare size={16} />,
  deal: <Briefcase size={16} />,
  meeting: <Users size={16} />,
  purchase_request: <Wallet size={16} />,
  process: <Network size={16} />,
};

function formatFeedDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const today = now.toDateString() === d.toDateString();
  if (today) return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `Вчера, ${d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export const FeedEntityCard: React.FC<FeedEntityCardProps> = ({ item, onClick }) => {
  const statusColor = item.statusColor || 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-[#333] transition-colors text-left border-b border-gray-100 dark:border-[#333] last:border-0"
    >
      <div className="shrink-0 w-10 h-10 rounded-xl bg-gray-100 dark:bg-[#333] flex items-center justify-center text-gray-600 dark:text-gray-400">
        {TYPE_ICONS[item.type]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{TYPE_LABELS[item.type]}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor}`}>{item.status}</span>
        </div>
        <div className="font-medium text-gray-900 dark:text-white truncate mt-0.5">{item.title}</div>
        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
          {item.isSystem ? (
            <span className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-[#444] text-gray-600 dark:text-gray-400">Система</span>
          ) : item.creator ? (
            <span className="flex items-center gap-1">
              <UserAvatar user={item.creator} size="xs" />
              {item.creator.name}
            </span>
          ) : null}
          {item.assignee && !item.creator && (
            <span className="flex items-center gap-1">
              <UserAvatar user={item.assignee} size="xs" />
              {item.assignee.name}
            </span>
          )}
          {item.client && <span>{item.client.name}</span>}
          <span>{formatFeedDate(item.date)}</span>
        </div>
      </div>
      <ChevronRight size={18} className="text-gray-400 shrink-0" />
    </button>
  );
};
