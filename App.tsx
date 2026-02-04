
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Layout, { TabType } from './components/Layout';
import Dashboard from './components/Dashboard';
import TransactionView from './components/TransactionView';
import BudgetView from './components/BudgetView';
import RemindersView from './components/RemindersView';
import GoalsView from './components/GoalsView';
import SettingsView from './components/SettingsView';
import { Transaction, Budget, MainCategory, Reminder, SubCategoryMap, FinancialGoal, CardInfo, Member, AICategorizationResponse } from './types';
import { INITIAL_TRANSACTIONS, INITIAL_BUDGETS, INITIAL_CATEGORIES as DefaultSubs } from './constants';
import { getFinancialAdvice, categorizeTransactionsBatch, suggestBudget } from './services/geminiService';
import { IconBudget } from './components/Icons';

const App: React.FC = () => {
  const getSavedData = <T,>(key: string, defaultValue: T): T => {
    const saved = localStorage.getItem(key);
    if (!saved) return defaultValue;
    try { return JSON.parse(saved); } catch (e) { return defaultValue; }
  };

  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [transactions, setTransactions] = useState<Transaction[]>(() => getSavedData('transactions', INITIAL_TRANSACTIONS));
  const [budgets, setBudgets] = useState<Budget[]>(() => getSavedData('budgets', INITIAL_BUDGETS));
  const [reminders, setReminders] = useState<Reminder[]>(() => getSavedData('reminders', []));
  const [financialGoals, setFinancialGoals] = useState<FinancialGoal[]>(() => getSavedData('goals', []));
  const [categories, setCategories] = useState<SubCategoryMap>(() => getSavedData('categories', DefaultSubs));
  const [isBankConnected, setIsBankConnected] = useState(() => getSavedData('isBankConnected', false));
  const [cardInfo, setCardInfo] = useState<CardInfo | null>(() => getSavedData('cardInfo', null));
  const [householdName, setHouseholdName] = useState(() => getSavedData('householdName', 'Моето домаќинство'));
  
  // Onboarding States
  const [isOnboarding, setIsOnboarding] = useState(() => !localStorage.getItem('onboardingDone'));
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [tempIncome, setTempIncome] = useState('');
  const [isGeneratingBudget, setIsGeneratingBudget] = useState(false);

  const [aiAdvice, setAiAdvice] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const batchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingQueueRef = useRef<{ id: string; description: string }[]>([]);

  useEffect(() => { localStorage.setItem('transactions', JSON.stringify(transactions)); }, [transactions]);
  useEffect(() => { localStorage.setItem('budgets', JSON.stringify(budgets)); }, [budgets]);
  useEffect(() => { localStorage.setItem('reminders', JSON.stringify(reminders)); }, [reminders]);
  useEffect(() => { localStorage.setItem('goals', JSON.stringify(financialGoals)); }, [financialGoals]);
  useEffect(() => { localStorage.setItem('categories', JSON.stringify(categories)); }, [categories]);
  useEffect(() => { localStorage.setItem('isBankConnected', JSON.stringify(isBankConnected)); }, [isBankConnected]);
  useEffect(() => { localStorage.setItem('cardInfo', JSON.stringify(cardInfo)); }, [cardInfo]);
  useEffect(() => { localStorage.setItem('householdName', JSON.stringify(householdName)); }, [householdName]);

  const completeOnboarding = async (useAi: boolean) => {
    const incomeValue = parseFloat(tempIncome.replace(/\D/g, ''));
    if (isNaN(incomeValue) || incomeValue <= 0) return;

    if (useAi) {
      setIsGeneratingBudget(true);
      try {
        const suggestions = await suggestBudget(incomeValue);
        if (suggestions.length > 0) {
          setBudgets(suggestions.map(s => ({
            mainCategory: s.mainCategory,
            limit: s.amount,
            spent: 0
          })));
        }
      } catch (e) { console.error(e); }
      setIsGeneratingBudget(false);
    }

    const incomeTrans: Transaction = {
      id: 'init-income',
      date: new Date().toISOString(),
      description: 'Почетен месечен приход',
      amount: incomeValue,
      mainCategory: MainCategory.INCOME,
      subCategory: 'Плата',
      type: 'income'
    };
    setTransactions([incomeTrans]);
    localStorage.setItem('onboardingDone', 'true');
    setIsOnboarding(false);
  };

  const processCategorizationBatch = useCallback(async () => {
    if (pendingQueueRef.current.length === 0) return;
    const queueToProcess = [...pendingQueueRef.current];
    pendingQueueRef.current = [];
    if (batchTimeoutRef.current) clearTimeout(batchTimeoutRef.current);
    
    try {
      const results = await categorizeTransactionsBatch(queueToProcess, categories);
      setTransactions(prev => prev.map(t => {
        const result = results.find((res: AICategorizationResponse) => res.transactionId === t.id);
        if (result) {
          return { ...t, mainCategory: result.mainCategory, subCategory: result.subCategory, isCategorizing: false };
        }
        return t;
      }));
    } catch (e) {
      console.error("Batch error:", e);
      // Ако згреши AI, тргни го статусот 'Размислувам'
      setTransactions(prev => prev.map(t => ({ ...t, isCategorizing: false })));
    }
  }, [categories]);

  const handleAddTransaction = (newTransaction: Transaction) => {
    setTransactions(prev => [newTransaction, ...prev]);
    if (newTransaction.isCategorizing) {
      pendingQueueRef.current.push({ id: newTransaction.id, description: newTransaction.description });
      if (batchTimeoutRef.current) clearTimeout(batchTimeoutRef.current);
      if (pendingQueueRef.current.length >= 5) {
        processCategorizationBatch();
      } else {
        batchTimeoutRef.current = setTimeout(() => { processCategorizationBatch(); }, 3000);
      }
    } else {
      const transDate = new Date(newTransaction.date);
      if (newTransaction.type === 'expense' && transDate.getMonth() === selectedMonth && transDate.getFullYear() === selectedYear) {
        setBudgets(prev => prev.map(b => {
          if (b.mainCategory === newTransaction.mainCategory) {
            return { ...b, spent: b.spent + Math.abs(newTransaction.amount) };
          }
          return b;
        }));
      }
    }
  };

  const totalIncomeForMonth = useMemo(() => {
    return transactions
      .filter((t: Transaction) => {
        const d = new Date(t.date);
        return t.type === 'income' && d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
      })
      .reduce((acc: number, curr: Transaction) => acc + curr.amount, 0);
  }, [transactions, selectedMonth, selectedYear]);

  const totalExpensesForMonth = useMemo(() => {
    return transactions
      .filter((t: Transaction) => {
        const d = new Date(t.date);
        return t.type === 'expense' && d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
      })
      .reduce((acc: number, curr: Transaction) => acc + Math.abs(curr.amount), 0);
  }, [transactions, selectedMonth, selectedYear]);

  const carryOverBalance = useMemo(() => {
    return transactions.filter((t: Transaction) => {
      const d = new Date(t.date);
      if (d.getFullYear() < selectedYear) return true;
      if (d.getFullYear() === selectedYear && d.getMonth() < selectedMonth) return true;
      return false;
    }).reduce((acc: number, curr: Transaction) => acc + (curr.type === 'income' ? curr.amount : curr.amount), 0);
  }, [transactions, selectedMonth, selectedYear]);

  const refreshAdvice = useCallback(async () => {
    // Само ако има барем една трансакција која не е почетниот приход
    if (transactions.length > 1) {
      const advice = await getFinancialAdvice(transactions, budgets);
      setAiAdvice(advice);
    } else {
      setAiAdvice("Внеси ги твоите први трошоци за да добиеш паметен совет.");
    }
  }, [transactions, budgets]);

  useEffect(() => { refreshAdvice(); }, [refreshAdvice]);

  if (isOnboarding) {
    return (
      <div className="fixed inset-0 z-[100] bg-white flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full animate-fadeIn text-center">
          <div className="w-16 h-16 bg-indigo-600 rounded-3xl mx-auto mb-8 flex items-center justify-center text-white shadow-xl shadow-indigo-100">
            <IconBudget className="w-8 h-8" />
          </div>
          
          {onboardingStep === 1 ? (
            <div className="space-y-6">
              <h2 className="text-3xl font-black text-slate-900">Добредојде!</h2>
              <p className="text-slate-500 font-medium">За да почнеме, внеси го твојот месечен приход (плата, фриленс...).</p>
              <div className="relative">
                <input 
                  type="text" 
                  inputMode="numeric"
                  placeholder="пр: 45.000" 
                  className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-indigo-500 font-black text-2xl text-center text-indigo-600 transition-all"
                  value={tempIncome.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}
                  onChange={(e) => setTempIncome(e.target.value.replace(/\D/g, ''))}
                />
              </div>
              <button 
                disabled={!tempIncome}
                onClick={() => setOnboardingStep(2)}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg hover:bg-slate-800 transition-all disabled:opacity-30"
              >
                Продолжи
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <h2 className="text-3xl font-black text-slate-900">Паметен Буџет</h2>
              <p className="text-slate-500 font-medium">Дали сакаш AI да ти предложи распределба на твоите {parseInt(tempIncome).toLocaleString('mk-MK')} денари?</p>
              <div className="flex flex-col gap-3">
                <button 
                  disabled={isGeneratingBudget}
                  onClick={() => completeOnboarding(true)}
                  className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all"
                >
                  {isGeneratingBudget ? '✨ Се генерира...' : '✨ Да, предложи ми AI Буџет'}
                </button>
                <button 
                  onClick={() => completeOnboarding(false)}
                  className="w-full py-4 bg-slate-50 text-slate-400 rounded-2xl font-black uppercase tracking-widest text-[10px]"
                >
                  Не, ќе внесам рачно подоцна
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard transactions={transactions} budgets={budgets} aiAdvice={aiAdvice} selectedMonth={selectedMonth} selectedYear={selectedYear} onMonthChange={(m, y) => {setSelectedMonth(m); setSelectedYear(y);}} carryOverBalance={carryOverBalance} householdName={householdName} onHouseholdNameChange={setHouseholdName} isBankConnected={isBankConnected} />;
      case 'transactions':
        return <TransactionView transactions={transactions} onAddTransaction={handleAddTransaction} categories={categories} members={[]} currentMemberId="" />;
      case 'budget':
        return <BudgetView budgets={budgets} onUpdateBudget={(cat, limit) => setBudgets(prev => prev.map(b => b.mainCategory === cat ? {...b, limit} : b))} totalIncome={totalIncomeForMonth} />;
      case 'reminders':
        return <RemindersView reminders={reminders} onAddReminder={(r) => setReminders(prev => [...prev, r])} onTogglePaid={(id) => setReminders(prev => prev.map(r => r.id === id ? {...r, isPaid: !r.isPaid} : r))} onDeleteReminder={(id) => setReminders(prev => prev.filter(r => r.id !== id))} onRequestPermission={async () => {}} />;
      case 'goals':
        return <GoalsView goals={financialGoals} onAddGoal={(g) => setFinancialGoals(prev => [...prev, g])} onUpdateGoalProgress={(id, amt) => setFinancialGoals(prev => prev.map(g => g.id === id ? {...g, currentAmount: g.currentAmount + amt} : g))} onDeleteGoal={(id) => setFinancialGoals(prev => prev.filter(g => g.id !== id))} monthlyIncome={totalIncomeForMonth} monthlyExpenses={totalExpensesForMonth} />;
      case 'settings':
        return <SettingsView categories={categories} onUpdateCategories={setCategories} isBankConnected={isBankConnected} onToggleBank={(s) => setIsBankConnected(s)} cardInfo={cardInfo} onUpdateCardInfo={setCardInfo} onSimulateTransaction={() => {}} />;
      default: return null;
    }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab} isBankConnected={isBankConnected}>
      <header className="mb-10 px-2 flex flex-col items-center justify-center text-center">
        <h1 className="text-4xl font-black text-slate-900 tracking-tight">
          {activeTab === 'dashboard' ? 'Преглед' : 
           activeTab === 'transactions' ? 'Трансакции' :
           activeTab === 'budget' ? 'Буџетирање' :
           activeTab === 'goals' ? 'Цели' :
           activeTab === 'reminders' ? 'Потсетници' : 'Подесувања'}
        </h1>
        <div className="w-12 h-1.5 bg-indigo-600 rounded-full mt-3"></div>
      </header>
      {renderContent()}
    </Layout>
  );
};

export default App;
