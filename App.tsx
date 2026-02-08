
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Layout, { TabType } from './components/Layout';
import Dashboard from './components/Dashboard';
import TransactionView from './components/TransactionView';
import BudgetView from './components/BudgetView';
import RemindersView from './components/RemindersView';
import GoalsView from './components/GoalsView';
import SettingsView from './components/SettingsView';
import { Transaction, Budget, MainCategory, Reminder, SubCategoryMap, FinancialGoal, CardInfo, Member } from './types';
import { INITIAL_TRANSACTIONS, INITIAL_BUDGETS, INITIAL_CATEGORIES as DefaultSubs } from './constants';
import { getFinancialAdvice, categorizeTransactionsBatch, suggestBudget } from './services/geminiService';

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
  const [members, setMembers] = useState<Member[]>(() => getSavedData('members', [{id: 'm1', name: 'Јас', avatarColor: '#6366f1'}]));
  
  const [isOnboarding, setIsOnboarding] = useState(() => !localStorage.getItem('onboardingDone'));
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [tempIncome, setTempIncome] = useState('');
  const [isGeneratingBudget, setIsGeneratingBudget] = useState(false);

  const [aiAdvice, setAiAdvice] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const batchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingQueueRef = useRef<{ id: string; description: string }[]>([]);

  // Persistence
  useEffect(() => { 
    localStorage.setItem('transactions', JSON.stringify(transactions)); 
    localStorage.setItem('budgets', JSON.stringify(budgets));
    localStorage.setItem('reminders', JSON.stringify(reminders));
    localStorage.setItem('goals', JSON.stringify(financialGoals));
    localStorage.setItem('categories', JSON.stringify(categories));
    localStorage.setItem('isBankConnected', JSON.stringify(isBankConnected));
    localStorage.setItem('cardInfo', JSON.stringify(cardInfo));
    localStorage.setItem('householdName', JSON.stringify(householdName));
    localStorage.setItem('members', JSON.stringify(members));
  }, [transactions, budgets, reminders, financialGoals, categories, isBankConnected, cardInfo, householdName, members]);

  const completeOnboarding = async (useAi: boolean) => {
    const incomeValue = parseFloat(tempIncome.replace(/\D/g, ''));
    if (isNaN(incomeValue) || incomeValue <= 0) return;
    if (useAi) {
      setIsGeneratingBudget(true);
      try {
        const suggestions = await suggestBudget(incomeValue);
        if (suggestions.length > 0) setBudgets(suggestions.map(s => ({ mainCategory: s.mainCategory, limit: s.amount, spent: 0 })));
      } catch (e) {}
      setIsGeneratingBudget(false);
    }
    setTransactions([{
      id: 'init-income', date: new Date().toISOString(), description: 'Почетен приход',
      amount: incomeValue, mainCategory: MainCategory.INCOME, subCategory: 'Плата', type: 'income', memberId: members[0].id
    }]);
    localStorage.setItem('onboardingDone', 'true');
    setIsOnboarding(false);
  };

  const processCategorizationBatch = useCallback(async () => {
    if (pendingQueueRef.current.length === 0) return;
    const queueToProcess = [...pendingQueueRef.current];
    pendingQueueRef.current = [];
    try {
      const results = await categorizeTransactionsBatch(queueToProcess, categories);
      setTransactions(prev => prev.map(t => {
        const res = results.find(r => r.transactionId === t.id);
        return res ? { ...t, mainCategory: res.mainCategory, subCategory: res.subCategory, isCategorizing: false } : t;
      }));
    } catch (e) { 
      setTransactions(prev => prev.map(t => t.isCategorizing ? { ...t, isCategorizing: false } : t));
    }
  }, [categories]);

  const handleAddTransaction = (newTransaction: Transaction) => {
    setTransactions(prev => [newTransaction, ...prev]);
    if (newTransaction.isCategorizing) {
      pendingQueueRef.current.push({ id: newTransaction.id, description: newTransaction.description });
      if (batchTimeoutRef.current) clearTimeout(batchTimeoutRef.current);
      batchTimeoutRef.current = setTimeout(() => processCategorizationBatch(), 2000);
    }
  };

  const handleUpdateTransaction = (id: string, updates: Partial<Transaction>) => {
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const handleDeleteTransaction = (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
  };

  const totalIncomeForMonth = useMemo(() => transactions
    .filter(t => {
      const d = new Date(t.date);
      return t.type === 'income' && d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    }).reduce((acc, curr) => acc + curr.amount, 0), [transactions, selectedMonth, selectedYear]);

  const totalExpensesForMonth = useMemo(() => transactions
    .filter(t => {
      const d = new Date(t.date);
      return t.type === 'expense' && d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    }).reduce((acc, curr) => acc + Math.abs(curr.amount), 0), [transactions, selectedMonth, selectedYear]);

  const carryOverBalance = useMemo(() => {
    return transactions.filter(t => {
      const d = new Date(t.date);
      return (d.getFullYear() < selectedYear) || (d.getFullYear() === selectedYear && d.getMonth() < selectedMonth);
    }).reduce((acc, curr) => acc + (curr.type === 'income' ? curr.amount : curr.amount), 0);
  }, [transactions, selectedMonth, selectedYear]);

  useEffect(() => {
    const fetchAdvice = async () => {
      if (transactions.length > 1) {
        const advice = await getFinancialAdvice(transactions, budgets);
        setAiAdvice(advice);
      }
    };
    fetchAdvice();
  }, [transactions.length]);

  if (isOnboarding) {
    return (
      <div className="fixed inset-0 z-[100] bg-white flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full animate-fadeIn text-center">
          <div className="px-8 py-4 bg-indigo-600 rounded-[2rem] mx-auto mb-10 inline-flex items-center justify-center text-white shadow-2xl shadow-indigo-200">
            <span className="text-2xl font-black tracking-tighter uppercase">Мој Буџет</span>
          </div>
          {onboardingStep === 1 ? (
            <div className="space-y-6">
              <h2 className="text-3xl font-black text-slate-900 leading-tight">Добредојде!</h2>
              <p className="text-slate-500 font-medium">За да почнеме, внеси го твојот месечен приход.</p>
              <input 
                type="text" placeholder="пр: 45.000" 
                className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-[2rem] outline-none focus:border-indigo-500 font-black text-3xl text-center text-indigo-600 transition-all"
                value={tempIncome.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}
                onChange={(e) => setTempIncome(e.target.value.replace(/\D/g, ''))}
              />
              <button disabled={!tempIncome} onClick={() => setOnboardingStep(2)} className="w-full py-5 bg-slate-900 text-white rounded-[1.5rem] font-black uppercase text-xs disabled:opacity-30 hover:bg-slate-800 transition-all shadow-lg">Продолжи</button>
            </div>
          ) : (
            <div className="space-y-6">
              <h2 className="text-3xl font-black text-slate-900">Паметен Буџет</h2>
              <p className="text-slate-500 font-medium leading-relaxed">Дали сакаш AI да ти предложи идеална распределба на твоите средства?</p>
              <div className="space-y-3">
                <button disabled={isGeneratingBudget} onClick={() => completeOnboarding(true)} className="w-full py-6 bg-indigo-600 text-white rounded-[1.5rem] font-black hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all transform hover:scale-[1.02]">{isGeneratingBudget ? '✨ Се генерира...' : '✨ Да, предложи ми AI Буџет'}</button>
                <button onClick={() => completeOnboarding(false)} className="w-full py-4 bg-white border-2 border-slate-100 text-slate-400 rounded-[1.5rem] font-black uppercase tracking-widest text-[10px] hover:bg-slate-50 transition-all">Не, ќе внесам рачно подоцна</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

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
      {activeTab === 'dashboard' && <Dashboard transactions={transactions} budgets={budgets} aiAdvice={aiAdvice} selectedMonth={selectedMonth} selectedYear={selectedYear} onMonthChange={(m, y) => {setSelectedMonth(m); setSelectedYear(y);}} carryOverBalance={carryOverBalance} householdName={householdName} onHouseholdNameChange={setHouseholdName} isBankConnected={isBankConnected} />}
      {activeTab === 'transactions' && <TransactionView transactions={transactions} onAddTransaction={handleAddTransaction} onUpdateTransaction={handleUpdateTransaction} onDeleteTransaction={handleDeleteTransaction} categories={categories} members={members} currentMemberId={members[0].id} />}
      {activeTab === 'budget' && <BudgetView budgets={budgets} onUpdateBudget={(cat, limit) => setBudgets(prev => prev.map(b => b.mainCategory === cat ? {...b, limit} : b))} totalIncome={totalIncomeForMonth} />}
      {activeTab === 'reminders' && <RemindersView reminders={reminders} onAddReminder={(r) => setReminders(prev => [...prev, r])} onTogglePaid={(id) => setReminders(prev => prev.map(r => r.id === id ? {...r, isPaid: !r.isPaid} : r))} onDeleteReminder={(id) => setReminders(prev => prev.filter(r => r.id !== id))} onRequestPermission={async () => {}} />}
      {activeTab === 'goals' && <GoalsView goals={financialGoals} onAddGoal={(g) => setFinancialGoals(prev => [...prev, g])} onUpdateGoalProgress={(id, amt) => setFinancialGoals(prev => prev.map(g => g.id === id ? {...g, currentAmount: g.currentAmount + amt} : g))} onDeleteGoal={(id) => setFinancialGoals(prev => prev.filter(g => g.id !== id))} monthlyIncome={totalIncomeForMonth} monthlyExpenses={totalExpensesForMonth} />}
      {activeTab === 'settings' && <SettingsView categories={categories} onUpdateCategories={setCategories} isBankConnected={isBankConnected} onToggleBank={(s) => setIsBankConnected(s)} cardInfo={cardInfo} onUpdateCardInfo={setCardInfo} onSimulateTransaction={() => {}} />}
    </Layout>
  );
};

export default App;
