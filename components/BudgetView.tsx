
import React, { useState } from 'react';
import { Budget, MainCategory, AISuggestedBudget } from '../types';
import { suggestBudget } from '../services/geminiService';

interface BudgetViewProps {
  budgets: Budget[];
  onUpdateBudget: (category: MainCategory, limit: number) => void;
  totalIncome: number;
}

const BudgetView: React.FC<BudgetViewProps> = ({ budgets, onUpdateBudget, totalIncome }) => {
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<AISuggestedBudget[]>([]);

  const handleGetSuggestions = async () => {
    setIsSuggesting(true);
    const result = await suggestBudget(totalIncome);
    setSuggestions(result);
    setIsSuggesting(false);
  };

  const applySuggestion = (s: AISuggestedBudget) => {
    onUpdateBudget(s.mainCategory, s.amount);
  };

  const applyAllSuggestions = () => {
    suggestions.forEach(s => applySuggestion(s));
    setSuggestions([]);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center text-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Лимити за овој месец</h2>
          <p className="text-sm font-medium text-slate-500 mt-1 italic">
            Месечен приход: <span className="font-black text-indigo-600">{totalIncome.toLocaleString('mk-MK')} ден.</span>
          </p>
        </div>
        <button 
          onClick={handleGetSuggestions}
          disabled={isSuggesting || totalIncome === 0}
          className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 transition flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-indigo-100"
        >
          {isSuggesting ? '⌛ Предлагам...' : '✨ ПРЕДЛОЖИ БУЏЕТ (AI)'}
        </button>
      </div>

      {suggestions.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-100 p-8 rounded-[2.5rem] animate-fadeIn shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h4 className="font-black text-indigo-900 flex items-center gap-2 uppercase text-[10px] tracking-widest">
              <span>🤖 ПРЕДЛОГ ОД ВЕШТАЧКАТА ИНТЕЛИГЕНЦИЈА</span>
            </h4>
            <button 
              onClick={applyAllSuggestions}
              className="text-[10px] bg-indigo-600 text-white px-4 py-2 rounded-xl font-black hover:bg-indigo-700 shadow-md uppercase tracking-widest"
            >
              Примени сѐ
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {suggestions.map(s => (
              <div key={s.mainCategory} className="bg-white p-4 rounded-2xl border border-indigo-100 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{s.mainCategory}</p>
                <p className="text-lg font-black text-indigo-600">{s.amount.toLocaleString('mk-MK')} ден.</p>
                <p className="text-[10px] text-slate-500 leading-relaxed mt-2 italic">{s.reasoning}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {budgets.map(b => {
          const percentage = Math.min((b.spent / b.limit) * 100, 100);
          const isOver = b.spent > b.limit;

          return (
            <div key={b.mainCategory} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 group">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h4 className="font-black text-slate-900 text-xl tracking-tight">{b.mainCategory}</h4>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Месечен лимит</p>
                </div>
                <div className="text-right">
                   <div className="flex items-center gap-2">
                      <input 
                        type="number"
                        className="w-28 p-2 text-right font-black text-indigo-600 bg-transparent border-b-2 border-dashed border-indigo-100 focus:border-indigo-600 focus:outline-none transition-colors"
                        value={b.limit}
                        onChange={(e) => onUpdateBudget(b.mainCategory, parseFloat(e.target.value) || 0)}
                      />
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ден.</span>
                   </div>
                </div>
              </div>

              <div className="mt-6">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-2">
                  <span className="text-slate-400">Потрошено: {b.spent.toLocaleString('mk-MK')} ден.</span>
                  <span className={isOver ? 'text-red-500 font-black' : 'text-indigo-400'}>
                    {percentage.toFixed(0)}%
                  </span>
                </div>
                <div className="h-4 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                  <div 
                    className={`h-full transition-all duration-1000 ease-out rounded-full ${isOver ? 'bg-red-500' : 'bg-indigo-600'}`}
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BudgetView;
