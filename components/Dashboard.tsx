import React, { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from 'recharts';
import { Transaction, Budget, MainCategory } from '../types';
import AdComponent from './AdComponent';
import { 
  IconFood, IconDining, IconTransport, IconMedical, 
  IconSalary, IconEntertainment, IconDefault 
} from './Icons';

interface DashboardProps {
  transactions: Transaction[];
  budgets: Budget[];
  aiAdvice: string;
  selectedMonth: number;
  selectedYear: number;
  onMonthChange: (month: number, year: number) => void;
  carryOverBalance: number;
  householdName: string;
  onHouseholdNameChange: (name: string) => void;
  isBankConnected: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  [MainCategory.NEEDS]: '#6366f1',
  [MainCategory.WANTS]: '#f59e0b',
  [MainCategory.EMERGENCIES]: '#ef4444',
  [MainCategory.INVESTMENTS]: '#10b981',
};

export const getTransactionIcon = (subCat: string, mainCat: MainCategory, sizeClass: string = "w-5 h-5") => {
  const s = (subCat || '').toLowerCase();
  const indigoClass = `${sizeClass} text-indigo-600 stroke-indigo-600`;
  
  if (s.includes('плата') || s.includes('бонус') || s.includes('приход') || s.includes('биланс')) return <IconSalary className={indigoClass} />;
  if (s.includes('маркет') || s.includes('храна') || s.includes('сметка') || s.includes('струја') || s.includes('вода')) return <IconFood className={indigoClass} />;
  if (s.includes('бензин') || s.includes('транспорт') || s.includes('автобус') || s.includes('такси')) return <IconTransport className={indigoClass} />;
  if (s.includes('здравје') || s.includes('аптека') || s.includes('лекар')) return <IconMedical className={indigoClass} />;
  if (s.includes('ресторан') || s.includes('кафе') || s.includes('пица')) return <IconDining className={indigoClass} />;
  if (s.includes('забава') || s.includes('шопинг') || s.includes('хоби')) return <IconEntertainment className={indigoClass} />;
  return <IconDefault className={indigoClass} />;
};

const renderActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <g>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 6} startAngle={startAngle} endAngle={endAngle} fill={fill} />
    </g>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ 
  transactions, budgets, aiAdvice, 
  selectedMonth, selectedYear, onMonthChange,
  carryOverBalance, householdName, onHouseholdNameChange,
  isBankConnected
}) => {
  const [activeIndex, setActiveIndex] = useState(-1);
  const months = ['Јануари', 'Февруари', 'Март', 'Април', 'Мај', 'Јуни', 'Јули', 'Август', 'Септември', 'Октомври', 'Ноември', 'Декември'];

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    });
  }, [transactions, selectedMonth, selectedYear]);

  const stats = useMemo(() => {
    const income = filteredTransactions.filter(t => t.type === 'income').reduce((acc, curr) => acc + curr.amount, 0);
    const expenses = Math.abs(filteredTransactions.filter(t => t.type === 'expense').reduce((acc, curr) => acc + curr.amount, 0));
    return { income, expenses, currentBalance: income - expenses + carryOverBalance };
  }, [filteredTransactions, carryOverBalance]);

  const pieData = useMemo(() => {
    const totals: Record<string, number> = {};
    const expenses = filteredTransactions.filter(t => t.type === 'expense');
    
    if (expenses.length === 0) {
      return [{ name: 'Нема трошоци', value: 1, fill: '#f1f5f9', isEmpty: true }];
    }

    expenses.forEach(t => {
      totals[t.mainCategory] = (totals[t.mainCategory] || 0) + Math.abs(t.amount);
    });

    return Object.values(MainCategory)
      .filter(cat => totals[cat] !== undefined)
      .map(name => ({
        name,
        value: totals[name],
        fill: CATEGORY_COLORS[name] || '#cbd5e1',
        isEmpty: false
      }));
  }, [filteredTransactions]);

  const activeCategory = activeIndex >= 0 ? pieData[activeIndex] : null;

  const displayTransactions = useMemo(() => {
    if (activeCategory && !activeCategory.isEmpty) {
      return filteredTransactions.filter(t => t.mainCategory === activeCategory.name);
    }
    return filteredTransactions.slice(0, 15);
  }, [activeCategory, filteredTransactions]);

  return (
    <div className="px-2 space-y-6 animate-fadeIn pb-12">
      <section className="flex flex-col items-center justify-center pt-2 relative">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={householdName}
            onChange={(e) => onHouseholdNameChange(e.target.value)}
            className="text-center text-3xl font-black text-slate-900 tracking-tight bg-transparent border-none focus:outline-none w-auto max-w-full"
          />
          {isBankConnected && <span className="text-green-500 text-xs animate-pulse">●</span>}
        </div>
        <div className="w-8 h-1 bg-indigo-500 rounded-full mt-1"></div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-4xl mx-auto">
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 flex flex-col items-center text-center shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Приливи</p>
          <p className="text-2xl font-black text-green-600">+{stats.income.toLocaleString('mk-MK')} <span className="text-xs">ден.</span></p>
        </div>
        
        <div className="bg-indigo-600 p-8 rounded-[2.5rem] shadow-xl shadow-indigo-200 flex flex-col items-center text-center transform md:scale-110 z-10 border-4 border-white">
          <p className="text-[10px] font-black text-indigo-100 uppercase tracking-widest mb-1">Биланс</p>
          <p className="text-3xl font-black text-white">{stats.currentBalance.toLocaleString('mk-MK')} <span className="text-sm font-normal text-indigo-200">ден.</span></p>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 flex flex-col items-center text-center shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Одливи</p>
          <p className="text-2xl font-black text-red-600">-{stats.expenses.toLocaleString('mk-MK')} <span className="text-xs">ден.</span></p>
        </div>
      </section>

      <section className="flex justify-center pt-4">
        <div className="bg-slate-100 rounded-2xl py-2 px-6 flex items-center gap-6 border border-slate-200">
          <button onClick={() => onMonthChange(selectedMonth - 1, selectedYear)} className="text-indigo-600 font-black text-xl">←</button>
          <span className="font-black text-slate-700 text-sm uppercase tracking-wide">{months[selectedMonth]} {selectedYear}</span>
          <button onClick={() => onMonthChange(selectedMonth + 1, selectedYear)} className="text-indigo-600 font-black text-xl">→</button>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <section className="space-y-4">
          <div className="h-80 relative flex items-center justify-center bg-white rounded-[3rem] border border-slate-50 shadow-sm overflow-hidden">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie 
                  {...({ activeIndex, activeShape: renderActiveShape } as any)}
                  data={pieData} 
                  cx="50%" cy="50%" innerRadius={75} outerRadius={100} paddingAngle={pieData[0]?.isEmpty ? 0 : 8} dataKey="value" stroke="none"
                  onMouseEnter={(_, index) => !pieData[index].isEmpty && setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(-1)}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} className="outline-none" />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-6">
              <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-0.5">
                {(activeCategory && !activeCategory.isEmpty) ? activeCategory.name : 'Трошоци'}
              </p>
              <p className="text-2xl font-black text-slate-900">
                {(activeCategory && !activeCategory.isEmpty) ? activeCategory.value.toLocaleString('mk-MK') : stats.expenses.toLocaleString('mk-MK')}
              </p>
              <p className="text-[10px] font-bold text-slate-400">ден.</p>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-4 bg-slate-50 p-4 rounded-3xl border border-slate-100">
            {Object.entries(CATEGORY_COLORS).map(([name, color]) => (
              <div key={name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }}></div>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">{name}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex justify-between items-center px-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {(activeCategory && !activeCategory.isEmpty) ? `Листа за: ${activeCategory.name}` : 'Последна активност'}
            </h3>
          </div>
          <div className="space-y-2 max-h-[400px] overflow-y-auto no-scrollbar pr-1">
            {displayTransactions.map(t => (
              <div key={t.id} className="flex items-center justify-between p-4 bg-white rounded-3xl border border-slate-100 group shadow-sm hover:border-indigo-200 transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 group-hover:bg-indigo-50 transition-colors">
                    {getTransactionIcon(t.subCategory, t.mainCategory)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{t.description}</p>
                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">{t.subCategory || t.mainCategory}</p>
                  </div>
                </div>
                <div className={`text-sm font-black whitespace-nowrap ${t.type === 'income' ? 'text-green-600' : 'text-slate-900'}`}>
                  {t.type === 'income' ? '+' : '-'}{Math.abs(t.amount).toLocaleString('mk-MK')}
                </div>
              </div>
            ))}
            {displayTransactions.length === 0 && (
              <div className="text-center py-12 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
                <p className="text-slate-400 text-xs font-black uppercase tracking-widest">Нема податоци за овој период</p>
              </div>
            )}
          </div>
        </section>
      </div>
      
      <div className="bg-indigo-50 p-6 rounded-[2.5rem] border border-indigo-100 shadow-sm">
        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2 flex items-center gap-2">
          <span>✦</span> AI Совети
        </p>
        <p className="text-sm text-indigo-900 font-medium leading-relaxed italic">{aiAdvice || "Внеси неколку трошоци за да добиеш AI анализа."}</p>
      </div>
    </div>
  );
};

export default Dashboard;
