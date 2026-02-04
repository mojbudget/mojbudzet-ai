
import React, { useState } from 'react';
import { FinancialGoal } from '../types';
import { getGoalStrategy } from '../services/geminiService';
// Fix: Replaced missing IconCar with IconTransport
import { IconTravel, IconTransport, IconHome, IconEducation, IconDefault, IconPlus } from './Icons';

interface GoalsViewProps {
  goals: FinancialGoal[];
  onAddGoal: (g: FinancialGoal) => void;
  onUpdateGoalProgress: (id: string, amount: number) => void;
  onDeleteGoal: (id: string) => void;
  monthlyIncome: number;
  monthlyExpenses: number;
}

const GoalsView: React.FC<GoalsViewProps> = ({ 
  goals, onAddGoal, onUpdateGoalProgress, onDeleteGoal, monthlyIncome, monthlyExpenses 
}) => {
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState(''); 
  const [deadline, setDeadline] = useState('');
  const [category, setCategory] = useState<FinancialGoal['category']>('other');
  const [activeStrategy, setActiveStrategy] = useState<{id: string, text: string} | null>(null);
  const [loadingStrategy, setLoadingStrategy] = useState<string | null>(null);
  
  const [depositGoalId, setDepositGoalId] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState<string>('');

  const formatForDisplay = (val: string | number) => {
    if (val === undefined || val === null || val === '') return '';
    const numeric = val.toString().replace(/\D/g, '');
    return numeric.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const handleTargetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    setTarget(rawValue);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !target || !deadline) return;
    onAddGoal({
      id: Math.random().toString(36).substr(2, 9),
      title,
      targetAmount: parseFloat(target),
      currentAmount: 0,
      deadline,
      category
    });
    setTitle('');
    setTarget('');
    setDeadline('');
  };

  const handleGetStrategy = async (goal: FinancialGoal) => {
    setLoadingStrategy(goal.id);
    const strategy = await getGoalStrategy(goal, monthlyIncome, monthlyExpenses);
    setActiveStrategy({ id: goal.id, text: strategy });
    setLoadingStrategy(null);
  };

  const handleDepositSubmit = (id: string) => {
    const amount = parseFloat(depositAmount.replace(/\D/g, ''));
    if (!isNaN(amount) && amount > 0) {
      onUpdateGoalProgress(id, amount);
      setDepositGoalId(null);
      setDepositAmount('');
    }
  };

  const getCategoryIcon = (cat: FinancialGoal['category']) => {
    const indigoClass = "w-7 h-7 text-indigo-600";
    switch(cat) {
      case 'travel': return <IconTravel className={indigoClass} />;
      // Fix: Used IconTransport instead of IconCar
      case 'car': return <IconTransport className={indigoClass} />;
      case 'home': return <IconHome className={indigoClass} />;
      case 'education': return <IconEducation className={indigoClass} />;
      default: return <IconDefault className={indigoClass} />;
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn pb-20">
      <header className="flex flex-col items-center gap-2 text-center">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Твоите планови</h2>
        <p className="text-slate-500 font-medium italic">Претвори ги твоите соништа во остварлив план.</p>
      </header>

      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
        <h3 className="font-bold text-lg mb-6 text-slate-800 text-center uppercase tracking-widest text-[10px]">Постави нова цел</h3>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2 flex flex-col gap-1">
            <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Опис на целта</label>
            <input 
              type="text" placeholder="пр: Заштеда за летен одмор" 
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 font-bold transition-all"
              value={title} onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1 relative">
            <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Целен износ (ден)</label>
            <input 
              type="text"
              inputMode="numeric"
              placeholder="0" 
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-indigo-600 font-black transition-all"
              value={formatForDisplay(target)} 
              onChange={handleTargetChange}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Краен рок</label>
            <input 
              type="date" 
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 font-medium transition-all appearance-none cursor-pointer"
              value={deadline} 
              onChange={(e) => setDeadline(e.target.value)}
              style={{ colorScheme: 'light' }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Тип</label>
            <div className="relative">
              <select 
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 font-bold appearance-none transition-all cursor-pointer"
                value={category} onChange={(e) => setCategory(e.target.value as any)}
              >
                <option value="other">Друго</option>
                <option value="travel">Патување</option>
                <option value="car">Автомобил</option>
                <option value="home">Дом</option>
                <option value="education">Едукација</option>
              </select>
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">▾</span>
            </div>
          </div>
          <button className="lg:col-span-5 py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 mt-2 uppercase tracking-widest text-xs">
            Креирај план
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {goals.map(goal => {
          const progress = (goal.currentAmount / goal.targetAmount) * 100;
          const remaining = goal.targetAmount - goal.currentAmount;
          const isDepositing = depositGoalId === goal.id;
          
          return (
            <div key={goal.id} className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm relative overflow-hidden group">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                    {getCategoryIcon(goal.category)}
                  </div>
                  <div>
                    <h4 className="text-xl font-black text-slate-900">{goal.title}</h4>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-tighter">Рок: {new Date(goal.deadline).toLocaleDateString('mk-MK')}</p>
                  </div>
                </div>
                <button onClick={() => onDeleteGoal(goal.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                  <span className="text-xl font-black leading-none">×</span>
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Заштедено</p>
                    <p className="text-xl font-black text-indigo-600">{formatForDisplay(goal.currentAmount)} <span className="text-[10px] uppercase">ден.</span></p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Цел</p>
                    <p className="text-base font-bold text-slate-900">{formatForDisplay(goal.targetAmount)} ден.</p>
                  </div>
                </div>

                <div className="relative h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-1000 ease-out ${progress >= 100 ? 'bg-green-500' : 'bg-indigo-600'}`}
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  ></div>
                </div>
                
                <div className="flex justify-between text-[9px] font-black text-indigo-400 uppercase tracking-tighter">
                  <span>{progress.toFixed(1)}% остварено</span>
                  <span>Уште {formatForDisplay(Math.max(0, remaining))} ден.</span>
                </div>

                {isDepositing ? (
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 animate-fadeIn space-y-3">
                    <div className="flex flex-col gap-1">
                       <label className="text-[9px] font-black text-slate-400 uppercase">Износ за внесување (ден)</label>
                       <input 
                          autoFocus
                          type="text"
                          inputMode="numeric"
                          placeholder="0"
                          className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-black text-indigo-600"
                          value={formatForDisplay(depositAmount)}
                          onChange={(e) => setDepositAmount(e.target.value.replace(/\D/g, ''))}
                        />
                    </div>
                    <div className="flex gap-2">
                       <button 
                        onClick={() => handleDepositSubmit(goal.id)}
                        className="flex-1 py-2 bg-indigo-600 text-white text-[10px] font-black rounded-lg hover:bg-indigo-700 uppercase tracking-widest"
                       >
                         Потврди
                       </button>
                       <button 
                        onClick={() => {setDepositGoalId(null); setDepositAmount('');}}
                        className="px-4 py-2 bg-slate-200 text-slate-600 text-[10px] font-black rounded-lg hover:bg-slate-300 uppercase tracking-widest"
                       >
                         Откажи
                       </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2 pt-2">
                    <button 
                      onClick={() => setDepositGoalId(goal.id)}
                      className="flex-grow py-3 bg-slate-900 text-white text-[10px] font-black rounded-xl hover:bg-slate-800 transition uppercase tracking-widest flex items-center justify-center gap-2"
                    >
                      <span><IconPlus className="w-3 h-3 inline mr-1" /></span> Додади заштеда
                    </button>
                    <button 
                      onClick={() => handleGetStrategy(goal)}
                      disabled={loadingStrategy === goal.id}
                      className="px-4 py-3 bg-indigo-100 text-indigo-600 text-[10px] font-black rounded-xl hover:bg-indigo-200 transition disabled:opacity-50 uppercase tracking-widest"
                    >
                      {loadingStrategy === goal.id ? '⌛' : '✦ AI Стратегија'}
                    </button>
                  </div>
                )}

                {activeStrategy?.id === goal.id && (
                  <div className="mt-4 p-5 bg-indigo-50 rounded-2xl border border-indigo-100 animate-slideDown shadow-inner">
                    <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                      <span>✦ ПЛАН ЗА УСПЕХ</span>
                      <button onClick={() => setActiveStrategy(null)} className="ml-auto text-indigo-300 hover:text-indigo-600 text-xl font-black leading-none">×</button>
                    </p>
                    <p className="text-xs text-indigo-900 leading-relaxed font-medium">
                      {activeStrategy.text}
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {goals.length === 0 && (
          <div className="md:col-span-2 text-center py-20 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
            <p className="text-slate-400 font-black text-base mb-2">Немаш поставено цели сѐ уште.</p>
            <p className="text-slate-400 text-xs font-medium">Постави ја твојата прва цел и дозволи AI да ти помогне.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GoalsView;
