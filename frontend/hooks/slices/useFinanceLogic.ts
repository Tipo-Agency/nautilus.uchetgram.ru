import { useState, useRef, useEffect } from 'react';
import { Department, FinanceCategory, Fund, FinancePlan, PurchaseRequest, FinancialPlanDocument, FinancialPlanning, BankStatement, IncomeReport } from '../../../types';
import { api } from '../../../backend/api';
import { createSaveHandler, createSaveHandlerAsync, createDeleteHandler } from '../../../utils/crudUtils';
import { NOTIFICATION_MESSAGES } from '../../../constants/messages';

export const useFinanceLogic = (showNotification: (msg: string) => void) => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [financeCategories, setFinanceCategories] = useState<FinanceCategory[]>([]);
  const [funds, setFunds] = useState<Fund[]>([]);
  const [financePlan, setFinancePlan] = useState<FinancePlan | null>(null);
  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequest[]>([]);
  const [financialPlanDocuments, setFinancialPlanDocuments] = useState<FinancialPlanDocument[]>([]);
  const [financialPlannings, setFinancialPlannings] = useState<FinancialPlanning[]>([]);
  const [bankStatements, setBankStatements] = useState<BankStatement[]>([]);
  const [incomeReports, setIncomeReports] = useState<IncomeReport[]>([]);
  const bankStatementsRef = useRef<BankStatement[]>([]);
  const incomeReportsRef = useRef<IncomeReport[]>([]);
  useEffect(() => { bankStatementsRef.current = bankStatements; }, [bankStatements]);
  useEffect(() => { incomeReportsRef.current = incomeReports; }, [incomeReports]);

  // Departments
  const saveDepartment = createSaveHandler(
    setDepartments,
    api.departments.updateAll,
    showNotification,
    NOTIFICATION_MESSAGES.DEPARTMENT_SAVED
  );

  const deleteDepartment = createDeleteHandler(
    setDepartments,
    api.departments.updateAll,
    showNotification,
    NOTIFICATION_MESSAGES.DEPARTMENT_DELETED
  );

  // Finance Categories
  const saveFinanceCategory = createSaveHandler(
    setFinanceCategories,
    api.finance.updateCategories,
    showNotification,
    NOTIFICATION_MESSAGES.FINANCE_CATEGORY_SAVED
  );

  const deleteFinanceCategory = createDeleteHandler(
    setFinanceCategories,
    api.finance.updateCategories,
    showNotification,
    NOTIFICATION_MESSAGES.FINANCE_CATEGORY_DELETED
  );

  // Funds
  const saveFund = createSaveHandler(
    setFunds,
    api.finance.updateFunds,
    showNotification,
    NOTIFICATION_MESSAGES.FUND_SAVED
  );

  const deleteFund = createDeleteHandler(
    setFunds,
    api.finance.updateFunds,
    showNotification,
    NOTIFICATION_MESSAGES.FUND_DELETED
  );

  // Finance Plan
  const updateFinancePlan = (updates: Partial<FinancePlan>) => {
      const newPlan = { ...financePlan, ...updates } as FinancePlan;
      setFinancePlan(newPlan);
      api.finance.updatePlan(newPlan);
      // showNotification('План обновлен'); // Too noisy for simple inputs
  };

  // Purchase Requests
  const savePurchaseRequest = createSaveHandler(
    setPurchaseRequests,
    api.finance.updateRequests,
    showNotification,
    NOTIFICATION_MESSAGES.PURCHASE_REQUEST_SAVED
  );

  const deletePurchaseRequest = createDeleteHandler(
    setPurchaseRequests,
    api.finance.updateRequests,
    showNotification,
    NOTIFICATION_MESSAGES.PURCHASE_REQUEST_DELETED
  );

  // Financial Plan Documents
  const saveFinancialPlanDocument = createSaveHandler(
    setFinancialPlanDocuments,
    api.finance.updateFinancialPlanDocuments,
    showNotification,
    NOTIFICATION_MESSAGES.FINANCIAL_PLAN_SAVED
  );

  const deleteFinancialPlanDocument = createDeleteHandler(
    setFinancialPlanDocuments,
    api.finance.updateFinancialPlanDocuments,
    showNotification,
    NOTIFICATION_MESSAGES.FINANCIAL_PLAN_DELETED
  );

  // Financial Planning
  const saveFinancialPlanning = createSaveHandler(
    setFinancialPlannings,
    api.finance.updateFinancialPlannings,
    showNotification,
    NOTIFICATION_MESSAGES.FINANCIAL_PLANNING_SAVED
  );

  const deleteFinancialPlanning = createDeleteHandler(
    setFinancialPlannings,
    api.finance.updateFinancialPlannings,
    showNotification,
    NOTIFICATION_MESSAGES.FINANCIAL_PLANNING_DELETED
  );

  // Bank Statements — сохраняем через API, при ошибке не обновляем стейт (БД = источник истины)
  const saveBankStatements = createSaveHandlerAsync(
    () => bankStatementsRef.current,
    setBankStatements,
    (payload) => api.finance.updateBankStatements(payload),
    showNotification,
    'Баланс (выписки) сохранён',
    'Не удалось сохранить. Проверьте сеть и backend.'
  );

  const clearBankStatements = async () => {
    try {
      await api.finance.clearBankStatements();
      setBankStatements([]);
      showNotification('Все выписки удалены. Можно загрузить заново.');
    } catch (err) {
      console.error('Clear bank statements failed:', err);
      showNotification('Не удалось очистить выписки. Проверьте сеть и backend.');
    }
  };

  // Income Reports — то же
  const saveIncomeReports = createSaveHandlerAsync(
    () => incomeReportsRef.current,
    setIncomeReports,
    (payload) => api.finance.updateIncomeReports(payload),
    showNotification,
    'Справка о доходах сохранена',
    'Не удалось сохранить справку о доходах.'
  );

  return {
    state: { departments, financeCategories, funds, financePlan, purchaseRequests, financialPlanDocuments, financialPlannings, bankStatements, incomeReports },
    setters: { setDepartments, setFinanceCategories, setFunds, setFinancePlan, setPurchaseRequests, setFinancialPlanDocuments, setFinancialPlannings, setBankStatements, setIncomeReports },
    actions: { 
        saveDepartment, deleteDepartment, 
        saveFinanceCategory, deleteFinanceCategory,
        saveFund, deleteFund,
        updateFinancePlan,
        savePurchaseRequest, deletePurchaseRequest,
        saveFinancialPlanDocument, deleteFinancialPlanDocument,
        saveFinancialPlanning, deleteFinancialPlanning,
        saveBankStatements, saveIncomeReports, clearBankStatements,
    }
  };
};
