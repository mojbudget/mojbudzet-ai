
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
import { getFinancialAdvice, categorizeTransactionsBatch } from './services/geminiService';

const App: React.FC = () => {
  // Помошна функција за вчитување од localStorage
  const getSavedData = <T,>(key: string, defaultValue: T): T => {
    const saved = localStorage.getItem(key);
    if (!saved) return defaultValue;
    try {
      return JSON.parse(saved);
    } catch (e) {
      return defaultValue;
    }
  };

  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  
  // Иницијализација на состојбите со податоци од localStorage
  const [transactions, setTransactions] = useState<Transaction[]>(() => getSavedData('transactions', INITIAL_TRANSACTIONS));
  const [budgets, setBudgets] = useState<Budget[]>(() => getSavedData('budgets', INITIAL_BUDGETS));
  const [reminders, setReminders] = useState<Reminder[]>(() => getSavedData('reminders', []));
  const [financialGoals, setFinancialGoals] = useState<FinancialGoal[]>(() => getSavedData('goals', []));
  const [categories, setCategories] = useState<SubCategoryMap>(() => getSavedData('categories', DefaultSubs));
  const [isBankConnected, setIsBankConnected] = useState(() => getSavedData('isBankConnected', false));
  const [cardInfo, setCardInfo] = useState<CardInfo | null>(() => getSavedData('cardInfo', null));
  const [householdName, setHouseholdName] = useState(() => getSavedData('householdName', 'Моето домаќинство'));
  
  const [aiAdvice, setAiAdvice] = useState<string>('');
  const [members] = useState<Member[]>([
    { id: '1', name: 'Петар', avatarColor: '#6366f1' },
    { id: '2', name: 'Марија', avatarColor: '#ec4899' }
  ]);
  const [currentMemberId, setCurrentMemberId] = useState('1');

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const batchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingQueueRef = useRef<{ id: string; description: string }[]>([]);

  // Автоматско зачувување во localStorage при секоја промена
  useEffect(() => { localStorage.setItem('transactions', JSON.stringify(transactions)); }, [transactions]);
  useEffect(() => { localStorage.setItem('budgets', JSON.stringify(budgets)); }, [budgets]);
  useEffect(() => { localStorage.setItem('reminders', JSON.stringify(reminders)); }, [reminders]);
  useEffect(() => { localStorage.setItem('goals', JSON.stringify(financialGoals)); }, [financialGoals]);
  useEffect(() => { localStorage.setItem('categories', JSON.stringify(categories)); }, [categories]);
  useEffect(() => { localStorage.setItem('isBankConnected', JSON.stringify(isBankConnected)); }, [isBankConnected]);
  useEffect(() => { localStorage.setItem('cardInfo', JSON.stringify(cardInfo)); }, [cardInfo]);
  useEffect(() => { localStorage.setItem('householdName', JSON.stringify(householdName)); }, [householdName]);

  const pageTitles: Record<TabType, string> = {
    dashboard: 'Преглед',
    transactions: 'Трансакции',
    budget: 'Буџетирање',
    goals: 'Финансиски цели',
    reminders: 'Потсетници',
    settings: 'Подесувања'
  };

  useEffect(() => {
    const checkReminders = () => {
      if (!("Notification" in window) || Notification.permission !== "granted") return;
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      reminders.forEach((r: Reminder) => {
        if (r.isPaid) return;
        const dueDate = new Date(r.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        const diffTime = dueDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays <= r.notificationDaysBefore && diffDays >= 0) {
          new Notification("Потсетник за плаќање!", {
            body: `Обврската "${r.title}" (износ: ${r.amount} ден.) достасува за ${diffDays} дена.`,
            icon: "https://cdn-icons-png.flaticon.com/512/583/583985.png"
          });
        }
      });
    };
    if (reminders.length > 0) checkReminders();
  }, [reminders]);

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

  const processCategorizationBatch = useCallback(async () => {
    if (pendingQueueRef.current.length === 0) return;
    const queueToProcess = [...pendingQueueRef.current];
    pendingQueueRef.current = [];
    if (batchTimeoutRef.current) clearTimeout(batchTimeoutRef.current);
    const results = await categorizeTransactionsBatch(queueToProcess, categories);
    setTransactions(prev => prev.map(t => {
      const result = results.find((res: AICategorizationResponse) => res.transactionId === t.id);
      if (result) {
        return { ...t, mainCategory: result.mainCategory, subCategory: result.subCategory, isCategorizing: false };
      }
      return t;
    }));
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

  const simulateBankTransaction = () => {
    const descriptions = [
      'Платено во Cineplexx Skopje City Mall',
      'Пазарено во Веро Центар',
      'Бензинска пумпа Макпетрол',
      'Аптека Зегин - Скопје',
      'Забавен парк Луна',
      'Платено во Ресторан Пелистер',
      'H&M Skopje City Mall'
    ];
    const randomDesc = descriptions[Math.floor(Math.random() * descriptions.length)];
    const randomAmount = Math.floor(Math.random() * (3000 - 200 + 1)) + 200;

    const newTrans: Transaction = {
      id: Math.random().toString(36).substr(2, 9),
      date: new Date().toISOString(),
      description: randomDesc,
      amount: -randomAmount,
      mainCategory: MainCategory.NEEDS,
      subCategory: 'Се синхронизира...',
      type: 'expense',
      isCategorizing: true,
      memberId: currentMemberId
    };
    handleAddTransaction(newTrans);
    setActiveTab('transactions');
  };

  const handleAddGoal = (newGoal: FinancialGoal) => {
    setFinancialGoals(prev => [...prev, newGoal]);
  };

  const handleUpdateGoalProgress = (id: string, amount: number) => {
    const goal = financialGoals.find(g => g.id === id);
    if (!goal) return;
    setFinancialGoals(prev => prev.map(g => g.id === id ? { ...g, currentAmount: g.currentAmount + amount } : g));
    const newTrans: Transaction = {
      id: Math.random().toString(36).substr(2, 9),
      date: new Date().toISOString(),
      description: `Заштеда: ${goal.title}`,
      amount: -amount,
      mainCategory: MainCategory.INVESTMENTS,
      subCategory: 'Штедење',
      type: 'expense',
      memberId: currentMemberId
    };
    handleAddTransaction(newTrans);
  };

  const refreshAdvice = useCallback(async () => {
    const advice = await getFinancialAdvice(transactions, budgets);
    setAiAdvice(advice);
  }, [transactions, budgets]);

  useEffect(() => { refreshAdvice(); }, [refreshAdvice]);

  const handleMonthChange = (m: number, y: number) => {
    let newM = m; let newY = y;
    if (m > 11) { newM = 0; newY = y + 1; }
    if (m < 0) { newM = 11; newY = y - 1; }
    setSelectedMonth(newM); setSelectedYear(newY);
  };

  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") return;
    await Notification.requestPermission();
  };

  const handleResetApp = () => {
    if (window.confirm("Дали сте сигурни дека сакате да ги избришете СИТЕ податоци? Ова дејство е неповратно.")) {
      localStorage.clear();
      window.location.reload();
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard transactions={transactions} budgets={budgets} aiAdvice={aiAdvice} selectedMonth={selectedMonth} selectedYear={selectedYear} onMonthChange={handleMonthChange} carryOverBalance={carryOverBalance} householdName={householdName} onHouseholdNameChange={setHouseholdName} isBankConnected={isBankConnected} />;
      case 'transactions':
        return (
          <TransactionView 
            transactions={transactions} 
            onAddTransaction={handleAddTransaction} 
            categories={categories} 
            members={members}
            currentMemberId={currentMemberId}
          />
        );
      case 'budget':
        return <BudgetView budgets={budgets} onUpdateBudget={(cat: MainCategory, limit: number) => setBudgets(prev => prev.map(b => b.mainCategory === cat ? {...b, limit} : b))} totalIncome={totalIncomeForMonth} />;
      case 'reminders':
        return <RemindersView reminders={reminders} onAddReminder={(r: Reminder) => setReminders(prev => [...prev, r])} onTogglePaid={(id: string) => setReminders(prev => prev.map(r => r.id === id ? {...r, isPaid: !r.isPaid} : r))} onDeleteReminder={(id: string) => setReminders(prev => prev.filter(r => r.id !== id))} onRequestPermission={requestNotificationPermission} />;
      case 'goals':
        return <GoalsView goals={financialGoals} onAddGoal={handleAddGoal} onUpdateGoalProgress={handleUpdateGoalProgress} onDeleteGoal={(id: string) => setFinancialGoals(prev => prev.filter(g => g.id !== id))} monthlyIncome={totalIncomeForMonth} monthlyExpenses={totalExpensesForMonth} />;
      case 'settings':
        return (
          <div className="space-y-12">
            <SettingsView 
              categories={categories} 
              onUpdateCategories={setCategories} 
              isBankConnected={isBankConnected}
              onToggleBank={(status: boolean) => {
                setIsBankConnected(status);
                if (!status) setCardInfo(null);
              }}
              cardInfo={cardInfo}
              onUpdateCardInfo={setCardInfo}
              onSimulateTransaction={simulateBankTransaction}
            />
            <div className="pt-8 border-t border-slate-100 flex justify-center">
              <button 
                onClick={handleResetApp}
                className="px-8 py-3 bg-red-50 text-red-600 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-red-100 hover:bg-red-600 hover:text-white transition-all"
              >
                ⚠️ Целосен ресет на податоци
              </button>
            </div>
          </div>
        );
      default: return null;
    }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab} isBankConnected={isBankConnected}>
      <header className="mb-10 px-2 flex flex-col items-center justify-center text-center">
        <h1 className="text-4xl font-black text-slate-900 tracking-tight">{pageTitles[activeTab]}</h1>
        <div className="w-12 h-1.5 bg-indigo-600 rounded-full mt-3"></div>
      </header>
      {renderContent()}
    </Layout>
  );
};

export default App;
