/**
 * HomePage — вкладки «Входящие», «Исходящие», «Сообщения» (чат)
 */
import React, { useState, useMemo } from 'react';
import {
  Task,
  User,
  Meeting,
  FinancePlan,
  PurchaseRequest,
  Deal,
  Client,
  EmployeeInfo,
  Project,
  StatusOption,
  PriorityOption,
  InboxMessage,
  MessageAttachment,
  Doc,
  Department,
} from '../../types';
import {
  HomeHeader,
  BirthdayModal,
  FeedEntityCard,
} from '../features/home';
import type { FeedItem } from '../features/home';
import { Container } from '../ui/Container';
import { PageLayout } from '../ui/PageLayout';
import { getTodayLocalDate } from '../../utils/dateUtils';
import { Paperclip, Send, ChevronDown, MessageCircle, Inbox, SendHorizontal, Users, Building2 } from 'lucide-react';
import { UserAvatar } from '../features/common/UserAvatar';

type MainTab = 'incoming' | 'outgoing' | 'messages';
type RecipientPickerMode = 'list' | 'departments';

interface HomePageProps {
  currentUser: User;
  tasks: Task[];
  recentActivity: unknown[];
  meetings?: Meeting[];
  financePlan?: FinancePlan | null;
  purchaseRequests?: PurchaseRequest[];
  deals?: Deal[];
  clients?: Client[];
  employeeInfos?: EmployeeInfo[];
  accountsReceivable?: { amount: number }[];
  users: User[];
  projects: Project[];
  statuses: StatusOption[];
  priorities: PriorityOption[];
  docs?: Doc[];
  departments?: Department[];
  inboxMessages?: InboxMessage[];
  outboxMessages?: InboxMessage[];
  onOpenTask: (task: Task) => void;
  onNavigateToInbox: () => void;
  onQuickCreateTask: () => void;
  onQuickCreateProcess: () => void;
  onQuickCreateDeal: () => void;
  onQuickCreatePurchaseRequest?: () => void;
  onNavigateToTasks: () => void;
  onNavigateToMeetings: () => void;
  onNavigateToDeals?: () => void;
  onNavigateToFinance?: () => void;
  onSendMessage?: (payload: { text: string; attachments?: MessageAttachment[]; recipientId?: string | null }) => void;
  onLoadMessages?: () => void;
}

const ENTITY_TYPES: { type: MessageAttachment['entityType']; label: string }[] = [
  { type: 'task', label: 'Задача' },
  { type: 'deal', label: 'Сделка' },
  { type: 'client', label: 'Клиент' },
  { type: 'doc', label: 'Документ' },
  { type: 'meeting', label: 'Встреча' },
  { type: 'project', label: 'Проект' },
  { type: 'table', label: 'Страница' },
];

function formatMessageTime(createdAt: string) {
  const d = new Date(createdAt);
  const now = new Date();
  const today = now.toDateString() === d.toDateString();
  if (today) return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export const HomePage: React.FC<HomePageProps> = ({
  currentUser,
  tasks,
  recentActivity = [],
  meetings = [],
  financePlan,
  purchaseRequests = [],
  deals = [],
  clients = [],
  employeeInfos = [],
  accountsReceivable = [],
  users,
  projects,
  statuses,
  priorities,
  docs = [],
  departments = [],
  inboxMessages = [],
  outboxMessages = [],
  onOpenTask,
  onNavigateToInbox,
  onQuickCreateTask,
  onQuickCreateProcess,
  onQuickCreateDeal,
  onQuickCreatePurchaseRequest = () => {},
  onNavigateToTasks,
  onNavigateToMeetings,
  onNavigateToDeals,
  onNavigateToFinance,
  onSendMessage,
}) => {
  const [showBirthdayModal, setShowBirthdayModal] = useState(false);
  const [mainTab, setMainTab] = useState<MainTab>('incoming');
  const [selectedDialogUserId, setSelectedDialogUserId] = useState<string | null>(null);
  const [composerText, setComposerText] = useState('');
  const [composerRecipientId, setComposerRecipientId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<MessageAttachment[]>([]);
  const [attachOpen, setAttachOpen] = useState(false);
  const [attachType, setAttachType] = useState<MessageAttachment['entityType'] | null>(null);
  const [recipientPickerOpen, setRecipientPickerOpen] = useState(false);
  const [recipientPickerMode, setRecipientPickerMode] = useState<RecipientPickerMode>('list');

  const myId = currentUser?.id;

  // Диалоги: уникальные собеседники + последнее сообщение
  const dialogs = useMemo(() => {
    const all: InboxMessage[] = [...inboxMessages, ...outboxMessages];
    const byCounterpart = new Map<string, { lastMessage: InboxMessage; unread: number }>();
    for (const msg of all) {
      const other = msg.senderId === myId ? msg.recipientId : msg.senderId;
      if (!other) continue; // broadcast пока не показываем в диалогах
      const existing = byCounterpart.get(other);
      if (!existing || new Date(msg.createdAt) > new Date(existing.lastMessage.createdAt)) {
        const unread = msg.senderId !== myId && !msg.read ? 1 : 0;
        byCounterpart.set(other, {
          lastMessage: msg,
          unread: existing ? existing.unread + (msg.senderId !== myId && !msg.read ? 1 : 0) : unread,
        });
      } else if (msg.senderId !== myId && !msg.read) {
        const cur = byCounterpart.get(other)!;
        byCounterpart.set(other, { ...cur, unread: cur.unread + 1 });
      }
    }
    return Array.from(byCounterpart.entries())
      .map(([userId, { lastMessage, unread }]) => ({
        userId,
        lastMessage,
        unread,
      }))
      .sort((a, b) => new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime());
  }, [inboxMessages, outboxMessages, myId]);

  // Сообщения выбранного диалога (тред с выбранным пользователем)
  const threadMessages = useMemo(() => {
    if (!selectedDialogUserId) return [];
    const all: InboxMessage[] = [...inboxMessages, ...outboxMessages];
    return all
      .filter(
        (m) =>
          (m.senderId === myId && m.recipientId === selectedDialogUserId) ||
          (m.senderId === selectedDialogUserId && m.recipientId === myId)
      )
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [inboxMessages, outboxMessages, selectedDialogUserId, myId]);

  const selectedRecipientUser = composerRecipientId ? users.find((u) => u.id === composerRecipientId) : null;
  const selectedDialogUser = selectedDialogUserId ? users.find((u) => u.id === selectedDialogUserId) : null;

  // При выборе диалога подставляем получателя в композер
  React.useEffect(() => {
    if (selectedDialogUserId && !composerRecipientId) setComposerRecipientId(selectedDialogUserId);
  }, [selectedDialogUserId]);

  const getEntityLabel = (a: MessageAttachment): string => {
    if (a.label) return a.label;
    switch (a.entityType) {
      case 'task':
        return tasks.find((t) => t.id === a.entityId)?.title || a.entityId;
      case 'deal':
        return deals?.find((d) => d.id === a.entityId)?.title || (deals?.find((d) => d.id === a.entityId) as Deal)?.number || a.entityId;
      case 'client':
        return clients?.find((c) => c.id === a.entityId)?.name || a.entityId;
      case 'doc':
        return docs?.find((d) => d.id === a.entityId)?.title || a.entityId;
      case 'meeting':
        return meetings?.find((m) => m.id === a.entityId)?.title || a.entityId;
      case 'project':
        return projects?.find((p) => p.id === a.entityId)?.name || a.entityId;
      default:
        return a.entityId;
    }
  };

  const entityOptions: { id: string; label: string; type: MessageAttachment['entityType'] }[] = (() => {
    if (!attachType) return [];
    switch (attachType) {
      case 'task':
        return (tasks || []).filter((t) => !t.isArchived).slice(0, 50).map((t) => ({ id: t.id, label: t.title, type: 'task' as const }));
      case 'deal':
        return (deals || [])
          .filter((d) => !d.isArchived)
          .slice(0, 50)
          .map((d) => ({ id: d.id, label: (d as Deal).title || (d as Deal).number || d.id, type: 'deal' as const }));
      case 'client':
        return (clients || []).filter((c) => !c.isArchived).slice(0, 50).map((c) => ({ id: c.id, label: c.name, type: 'client' as const }));
      case 'doc':
        return (docs || []).filter((d) => !d.isArchived).slice(0, 50).map((d) => ({ id: d.id, label: d.title, type: 'doc' as const }));
      case 'meeting':
        return (meetings || []).filter((m) => !m.isArchived).slice(0, 50).map((m) => ({ id: m.id, label: m.title, type: 'meeting' as const }));
      case 'project':
        return (projects || []).filter((p) => !p.isArchived).slice(0, 50).map((p) => ({ id: p.id, label: p.name, type: 'project' as const }));
      default:
        return [];
    }
  })();

  const addAttachment = (entityId: string, label: string, type: MessageAttachment['entityType']) => {
    if (attachments.some((a) => a.entityType === type && a.entityId === entityId)) return;
    setAttachments((prev) => [...prev, { entityType: type, entityId, label }]);
    setAttachType(null);
  };

  const removeAttachment = (i: number) => setAttachments((prev) => prev.filter((_, index) => index !== i));

  const sendMessage = (text: string) => {
    if (!text.trim() && attachments.length === 0) return;
    const recipientId = composerRecipientId || selectedDialogUserId || null;
    onSendMessage?.({
      text: text.trim() || '(без текста)',
      attachments: attachments.length ? attachments : undefined,
      recipientId,
    });
    setComposerText('');
    setAttachments([]);
  };

  const otherUsers = useMemo(() => users.filter((u) => u.id !== myId && !u.isArchived), [users, myId]);
  const usersByDepartment = useMemo(() => {
    const map = new Map<string, User[]>();
    for (const u of otherUsers) {
      const info = employeeInfos.find((e) => e.userId === u.id);
      const deptId = info?.departmentId || '_no_dept';
      if (!map.has(deptId)) map.set(deptId, []);
      map.get(deptId)!.push(u);
    }
    return map;
  }, [otherUsers, employeeInfos]);

  React.useEffect(() => {
    const info = employeeInfos.find((e) => e.userId === currentUser?.id);
    if (info?.birthDate) {
      const birthDate = new Date(info.birthDate);
      const today = new Date();
      if (birthDate.getMonth() === today.getMonth() && birthDate.getDate() === today.getDate()) {
        const todayStr = getTodayLocalDate();
        if (!localStorage.getItem(`birthday_${currentUser.id}_${todayStr}`)) {
          setShowBirthdayModal(true);
          localStorage.setItem(`birthday_${currentUser.id}_${todayStr}`, 'true');
        }
      }
    }
  }, [currentUser?.id, employeeInfos]);

  const myTasks = (tasks || []).filter(
    (t) =>
      t &&
      t.entityType !== 'idea' &&
      t.entityType !== 'feature' &&
      !t.isArchived &&
      !['Выполнено', 'Done', 'Завершено'].includes(t.status) &&
      (t.assigneeId === currentUser?.id || t.assigneeIds?.includes(currentUser?.id))
  );

  // Входящие: задачи (назначены мне), сделки (назначены мне), встречи (я участник)
  const incomingFeed = useMemo((): FeedItem[] => {
    const items: FeedItem[] = [];
    const uId = myId || currentUser?.id;
    if (!uId) return items;

    // Задачи: назначены мне; автор = кто поставил (createdByUserId / requesterId), иначе системная
    (tasks || [])
      .filter((t) => t && t.entityType !== 'idea' && t.entityType !== 'feature' && !t.isArchived)
      .filter((t) => t.assigneeId === uId || t.assigneeIds?.includes(uId))
      .forEach((t) => {
        const authorId = t.createdByUserId || t.requesterId;
        const creator = authorId ? users.find((u) => u.id === authorId) : undefined;
        items.push({
          type: 'task',
          id: t.id,
          title: t.title,
          status: t.status,
          date: t.endDate || t.createdAt || t.startDate || '',
          creator,
          isSystem: !authorId,
          entity: t,
        });
      });

    // Сделки: назначены мне; автор = кто создал сделку
    (deals || [])
      .filter((d) => d && !d.isArchived && d.assigneeId === uId)
      .forEach((d) => {
        const creator = d.createdByUserId ? users.find((u) => u.id === d.createdByUserId) : undefined;
        const client = clients.find((c) => c.id === d.clientId);
        items.push({
          type: 'deal',
          id: d.id,
          title: d.title || d.number || d.id,
          status: d.stage || '—',
          date: d.createdAt || '',
          creator,
          isSystem: !d.createdByUserId,
          client,
          entity: d,
        });
      });

    // Встречи: я участник; автор = кто создал встречу
    (meetings || [])
      .filter((m) => m && !m.isArchived && m.participantIds?.includes(uId))
      .forEach((m) => {
        const creator = m.createdByUserId ? users.find((u) => u.id === m.createdByUserId) : undefined;
        items.push({
          type: 'meeting',
          id: m.id,
          title: m.title,
          status: m.type === 'client' ? 'С клиентом' : 'Рабочая',
          date: m.date ? `${m.date}T${m.time || '00:00'}:00` : '',
          creator,
          isSystem: !m.createdByUserId,
          entity: m,
        });
      });

    // Сортировка по дате (новые сверху)
    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return items;
  }, [tasks, deals, meetings, users, clients, myId, currentUser?.id]);

  // Исходящие: задачи (создал я), заявки (создал я), сделки (назначены мне), встречи (я участник)
  const outgoingFeed = useMemo((): FeedItem[] => {
    const items: FeedItem[] = [];
    const uId = myId || currentUser?.id;
    if (!uId) return items;

    // Задачи: createdByUserId или requesterId === я
    (tasks || [])
      .filter((t) => t && t.entityType !== 'idea' && t.entityType !== 'feature' && !t.isArchived)
      .filter((t) => (t.createdByUserId === uId || t.requesterId === uId) && (t.assigneeId !== uId && !t.assigneeIds?.includes(uId)))
      .forEach((t) => {
        const assignee = users.find((u) => u.id === t.assigneeId);
        items.push({
          type: 'task',
          id: t.id,
          title: t.title,
          status: t.status,
          date: t.endDate || t.createdAt || t.startDate || '',
          assignee,
          creator: users.find((u) => u.id === uId),
          entity: t,
        });
      });

    // Заявки на приобретение: requesterId === я
    (purchaseRequests || [])
      .filter((pr) => pr && !pr.isArchived && pr.requesterId === uId)
      .forEach((pr) => {
        const requester = users.find((u) => u.id === pr.requesterId);
        const statusLabel = pr.status === 'pending' ? 'На рассмотрении' : pr.status === 'approved' ? 'Одобрено' : pr.status === 'rejected' ? 'Отклонено' : 'Отложено';
        items.push({
          type: 'purchase_request',
          id: pr.id,
          title: pr.description || `Заявка ${pr.id}`,
          status: statusLabel,
          date: pr.date || pr.decisionDate || '',
          creator: requester,
          entity: pr,
        });
      });

    // Сделки: мои
    (deals || [])
      .filter((d) => d && !d.isArchived && d.assigneeId === uId)
      .forEach((d) => {
        const creator = d.createdByUserId ? users.find((u) => u.id === d.createdByUserId) : undefined;
        const client = clients.find((c) => c.id === d.clientId);
        items.push({
          type: 'deal',
          id: d.id,
          title: d.title || d.number || d.id,
          status: d.stage || '—',
          date: d.createdAt || '',
          creator,
          isSystem: !d.createdByUserId,
          client,
          entity: d,
        });
      });

    // Встречи: мои
    (meetings || [])
      .filter((m) => m && !m.isArchived && m.participantIds?.includes(uId))
      .forEach((m) => {
        const creator = m.createdByUserId ? users.find((u) => u.id === m.createdByUserId) : undefined;
        items.push({
          type: 'meeting',
          id: m.id,
          title: m.title,
          status: m.type === 'client' ? 'С клиентом' : 'Рабочая',
          date: m.date ? `${m.date}T${m.time || '00:00'}:00` : '',
          creator,
          isSystem: !m.createdByUserId,
          entity: m,
        });
      });

    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return items;
  }, [tasks, deals, meetings, purchaseRequests, users, clients, myId, currentUser?.id]);

  const handleOpenEntity = (item: FeedItem) => {
    switch (item.type) {
      case 'task':
        onOpenTask(item.entity as Task);
        break;
      case 'deal': {
        onNavigateToDeals?.();
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('openEditDealModal', { detail: { deal: item.entity } }));
        }, 100);
        break;
      }
      case 'meeting': {
        onNavigateToMeetings?.();
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('openEditMeetingModal', { detail: { meeting: item.entity } }));
        }, 100);
        break;
      }
      case 'purchase_request': {
        onNavigateToFinance?.();
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('openEditPurchaseRequestModal', { detail: { request: item.entity } }));
        }, 100);
        break;
      }
      default:
        break;
    }
  };

  if (!currentUser) {
    return (
      <PageLayout>
        <Container>
          <div className="p-10 text-center text-gray-500 dark:text-gray-400">Пользователь не найден</div>
        </Container>
      </PageLayout>
    );
  }

  return (
    <>
      <BirthdayModal isOpen={showBirthdayModal} onClose={() => setShowBirthdayModal(false)} user={currentUser} />

      <PageLayout>
        <Container safeArea className="py-4 pb-24 md:pb-32 overflow-y-auto">
          <div className="max-w-5xl mx-auto space-y-4">
            <HomeHeader
              user={currentUser}
              onQuickCreateTask={onQuickCreateTask}
              onQuickCreateDeal={onQuickCreateDeal}
              onQuickCreateProcess={onQuickCreateProcess}
              onQuickCreatePurchaseRequest={onQuickCreatePurchaseRequest}
            />

            {/* Вкладки: Входящие | Исходящие | Сообщения */}
            <div className="flex items-center gap-2 bg-gray-100 dark:bg-[#252525] rounded-full p-1 text-xs w-fit">
              <button
                onClick={() => setMainTab('incoming')}
                className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 ${mainTab === 'incoming' ? 'bg-white dark:bg-[#191919] text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-300'}`}
              >
                <Inbox size={14} /> Входящие
              </button>
              <button
                onClick={() => setMainTab('outgoing')}
                className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 ${mainTab === 'outgoing' ? 'bg-white dark:bg-[#191919] text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-300'}`}
              >
                <SendHorizontal size={14} /> Исходящие
              </button>
              <button
                onClick={() => setMainTab('messages')}
                className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 ${mainTab === 'messages' ? 'bg-white dark:bg-[#191919] text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-300'}`}
              >
                <MessageCircle size={14} /> Сообщения
              </button>
            </div>

            {mainTab === 'incoming' && (
              <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-100 dark:border-[#333] font-medium text-gray-800 dark:text-white">Входящие</div>
                <div className="divide-y divide-gray-100 dark:divide-[#333] max-h-[60vh] overflow-y-auto">
                  {incomingFeed.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">Нет входящих сущностей</div>
                  ) : (
                    incomingFeed.map((item) => (
                      <FeedEntityCard key={`${item.type}-${item.id}`} item={item} onClick={() => handleOpenEntity(item)} />
                    ))
                  )}
                </div>
              </div>
            )}

            {mainTab === 'outgoing' && (
              <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-100 dark:border-[#333] font-medium text-gray-800 dark:text-white">Исходящие</div>
                <div className="divide-y divide-gray-100 dark:divide-[#333] max-h-[60vh] overflow-y-auto">
                  {outgoingFeed.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">Нет исходящих сущностей</div>
                  ) : (
                    outgoingFeed.map((item) => (
                      <FeedEntityCard key={`${item.type}-${item.id}`} item={item} onClick={() => handleOpenEntity(item)} />
                    ))
                  )}
                </div>
              </div>
            )}

            {mainTab === 'messages' && (
              <div className="flex flex-col md:flex-row gap-4 min-h-[400px]">
                {/* Список диалогов */}
                <div className="w-full md:w-72 shrink-0 bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl overflow-hidden flex flex-col max-h-[420px]">
                  <div className="p-2 border-b border-gray-100 dark:border-[#333] text-sm font-medium text-gray-700 dark:text-gray-200">
                    Диалоги
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {dialogs.length === 0 ? (
                      <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-xs">Нет диалогов</div>
                    ) : (
                      dialogs.map((d) => {
                        const user = users.find((u) => u.id === d.userId);
                        const isSelected = selectedDialogUserId === d.userId;
                        return (
                          <button
                            key={d.userId}
                            type="button"
                            onClick={() => setSelectedDialogUserId(d.userId)}
                            className={`w-full flex items-center gap-3 p-3 text-left border-b border-gray-100 dark:border-[#333] last:border-0 hover:bg-gray-50 dark:hover:bg-[#333] ${isSelected ? 'bg-gray-100 dark:bg-[#333]' : ''}`}
                          >
                            <UserAvatar user={user || { id: d.userId, name: '?', role: 'EMPLOYEE' }} size="sm" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-medium text-sm text-gray-900 dark:text-white truncate">{user?.name || d.userId}</span>
                                {d.unread > 0 && (
                                  <span className="shrink-0 w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center">{d.unread}</span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{d.lastMessage.text}</p>
                            </div>
                            <span className="text-[10px] text-gray-400">{formatMessageTime(d.lastMessage.createdAt)}</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Тред + композер */}
                <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl overflow-hidden">
                  {selectedDialogUser && (
                    <div className="p-2 border-b border-gray-100 dark:border-[#333] text-sm font-medium text-gray-700 dark:text-gray-200 flex items-center gap-2">
                      <UserAvatar user={selectedDialogUser} size="sm" /> {selectedDialogUser.name}
                    </div>
                  )}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px]">
                    {!selectedDialogUserId ? (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">Выберите диалог или напишите новое сообщение</div>
                    ) : (
                      threadMessages.map((msg) => {
                        const sender = users.find((u) => u.id === msg.senderId);
                        const isMe = msg.senderId === myId;
                        return (
                          <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                            <UserAvatar user={sender || { id: msg.senderId, name: '?', role: 'EMPLOYEE' }} size="sm" />
                            <div className={`max-w-[80%] rounded-xl px-3 py-2 ${isMe ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-[#333]'}`}>
                              <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">{msg.text}</p>
                              {msg.attachments && msg.attachments.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {msg.attachments.map((a, i) => (
                                    <span key={i} className="inline-flex px-2 py-0.5 rounded bg-white/50 dark:bg-black/20 text-xs">
                                      {a.entityType}: {getEntityLabel(a)}
                                    </span>
                                  ))}
                                </div>
                              )}
                              <div className="text-[10px] text-gray-500 mt-1">{formatMessageTime(msg.createdAt)}</div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Композер: Кому + текст + прикрепить + отправить */}
                  <div className="p-3 border-t border-gray-200 dark:border-[#333] space-y-2">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setRecipientPickerOpen(!recipientPickerOpen)}
                        className="flex items-center gap-2 w-full rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#191919] px-3 py-2 text-sm text-left"
                      >
                        <Users size={14} className="text-gray-400" />
                        <span className="text-gray-700 dark:text-gray-200">
                          {selectedRecipientUser ? selectedRecipientUser.name : 'Кому: выберите сотрудника'}
                        </span>
                        <ChevronDown size={14} className="ml-auto text-gray-400" />
                      </button>
                      {recipientPickerOpen && (
                        <>
                          <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-lg shadow-xl max-h-64 overflow-hidden flex flex-col">
                            <div className="flex border-b border-gray-100 dark:border-[#333]">
                              <button
                                type="button"
                                onClick={() => setRecipientPickerMode('list')}
                                className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs ${recipientPickerMode === 'list' ? 'bg-gray-100 dark:bg-[#333] font-medium' : ''}`}
                              >
                                <Users size={12} /> Сотрудники
                              </button>
                              <button
                                type="button"
                                onClick={() => setRecipientPickerMode('departments')}
                                className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs ${recipientPickerMode === 'departments' ? 'bg-gray-100 dark:bg-[#333] font-medium' : ''}`}
                              >
                                <Building2 size={12} /> По подразделениям
                              </button>
                            </div>
                            <div className="overflow-y-auto flex-1 p-2">
                              {recipientPickerMode === 'list' ? (
                                otherUsers.map((u) => (
                                  <button
                                    key={u.id}
                                    type="button"
                                    onClick={() => {
                                      setComposerRecipientId(u.id);
                                      setSelectedDialogUserId(u.id);
                                      setRecipientPickerOpen(false);
                                    }}
                                    className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#333] text-left text-sm"
                                  >
                                    <UserAvatar user={u} size="sm" /> {u.name}
                                  </button>
                                ))
                              ) : (
                                <>
                                  {departments.length === 0 ? (
                                    <p className="text-xs text-gray-500 p-2">Нет подразделений</p>
                                  ) : (
                                    departments.map((dept) => {
                                      const deptUsers = usersByDepartment.get(dept.id) || [];
                                      if (deptUsers.length === 0) return null;
                                      return (
                                        <div key={dept.id} className="mb-2">
                                          <div className="px-2 py-1 text-xs font-medium text-gray-500 dark:text-gray-400">{dept.name}</div>
                                          {deptUsers.map((u) => (
                                            <button
                                              key={u.id}
                                              type="button"
                                              onClick={() => {
                                                setComposerRecipientId(u.id);
                                                setSelectedDialogUserId(u.id);
                                                setRecipientPickerOpen(false);
                                              }}
                                              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#333] text-left text-sm"
                                            >
                                              <UserAvatar user={u} size="sm" /> {u.name}
                                            </button>
                                          ))}
                                        </div>
                                      );
                                    })
                                  )}
                                  {(usersByDepartment.get('_no_dept')?.length || 0) > 0 && (
                                    <div className="mb-2">
                                      <div className="px-2 py-1 text-xs font-medium text-gray-500 dark:text-gray-400">Без подразделения</div>
                                      {usersByDepartment.get('_no_dept')!.map((u) => (
                                        <button
                                          key={u.id}
                                          type="button"
                                          onClick={() => {
                                            setComposerRecipientId(u.id);
                                            setSelectedDialogUserId(u.id);
                                            setRecipientPickerOpen(false);
                                          }}
                                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#333] text-left text-sm"
                                        >
                                          <UserAvatar user={u} size="sm" /> {u.name}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                          <div className="fixed inset-0 z-10" onClick={() => setRecipientPickerOpen(false)} aria-hidden="true" />
                        </>
                      )}
                    </div>
                    <textarea
                      value={composerText}
                      onChange={(e) => setComposerText(e.target.value)}
                      placeholder="Сообщение..."
                      className="w-full min-h-[60px] rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#191919] px-3 py-2 text-sm resize-none"
                      rows={2}
                    />
                    {attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {attachments.map((a, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-100 dark:bg-[#333] text-xs"
                          >
                            {getEntityLabel(a)}
                            <button type="button" onClick={() => removeAttachment(i)} className="text-gray-500 hover:text-red-500">×</button>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => {
                            setAttachOpen(!attachOpen);
                            setAttachType(null);
                          }}
                          className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-gray-200 dark:border-[#333] text-xs"
                        >
                          <Paperclip size={12} /> Прикрепить <ChevronDown size={12} />
                        </button>
                        {attachOpen && (
                          <>
                            <div className="absolute left-0 bottom-full mb-1 z-10 bg-white dark:bg-[#252525] border rounded-lg shadow-lg py-1 min-w-[140px]">
                              {!attachType ? (
                                ENTITY_TYPES.map(({ type, label }) => (
                                  <button
                                    key={type}
                                    type="button"
                                    onClick={() => setAttachType(type)}
                                    className="w-full text-left px-3 py-1.5 text-xs"
                                  >
                                    {label}
                                  </button>
                                ))
                              ) : (
                                <div className="max-h-40 overflow-y-auto">
                                  {entityOptions.length === 0 ? (
                                    <div className="px-3 py-2 text-xs text-gray-500">Нет элементов</div>
                                  ) : (
                                    entityOptions.map((opt) => (
                                      <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() => addAttachment(opt.id, opt.label, opt.type)}
                                        className="w-full text-left px-3 py-1.5 text-xs truncate"
                                      >
                                        {opt.label}
                                      </button>
                                    ))
                                  )}
                                  <button type="button" onClick={() => setAttachType(null)} className="w-full text-left px-3 py-1 text-xs text-gray-500 border-t">
                                    ← Назад
                                  </button>
                                </div>
                              )}
                            </div>
                            <div className="fixed inset-0 z-0" onClick={() => setAttachOpen(false)} aria-hidden="true" />
                          </>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => sendMessage(composerText)}
                        disabled={(!composerText.trim() && attachments.length === 0) || !composerRecipientId}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-800 dark:bg-gray-600 text-white text-sm disabled:opacity-50"
                      >
                        <Send size={14} /> Отправить
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Container>
      </PageLayout>
    </>
  );
};
