
import React, { useState } from 'react';
import { Reminder } from '../types';
// Fix: Replaced missing IconBill with IconBudget
import { IconBudget, IconBank, IconEntertainment, IconTransport } from './Icons';

interface RemindersViewProps {
  reminders: Reminder[];
  onAddReminder: (r: Reminder) => void;
  onTogglePaid: (id: string) => void;
  onDeleteReminder: (id: string) => void;
  onRequestPermission: () => Promise<void>;
}

const RemindersView: React.FC<RemindersViewProps> = ({ reminders, onAddReminder, onTogglePaid, onDeleteReminder, onRequestPermission }) => {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [type, setType] = useState<Reminder['type']>('bill');
  const [notificationDays, setNotificationDays] = useState(1);

  const formatForDisplay = (val: string | number) => {
    if (val === undefined || val === null || val === '') return '';
    const numeric = val.toString().replace(/\D/g, '');
    return numeric.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    setAmount(rawValue);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawAmount = parseFloat(amount);
    if (!title || isNaN(rawAmount) || !date) return;
    
    if ("Notification" in window && Notification.permission !== "granted") {
      await onRequestPermission();
    }

    onAddReminder({
      id: Math.random().toString(36).substr(2, 9),
      title,
      amount: rawAmount,
      dueDate: date,
      type,
      isPaid: false,
      notificationDaysBefore: notificationDays
    });
    
    setTitle('');
    setAmount('');
    setDate('');
    setNotificationDays(1);
  };

  const getIcon = (type: Reminder['type']) => {
    const indigoClass = "w-7 h-7 text-indigo-600";
    switch(type) {
      // Fix: Used IconBudget instead of IconBill
      case 'bill': return <IconBudget className={indigoClass} />;
      case 'credit': return <IconBank className={indigoClass} />;
      case 'subscription': return <IconEntertainment className={indigoClass} />;
      case 'vehicle': return <IconTransport className={indigoClass} />;
      default: return <IconBudget className={indigoClass} />;
    }
  };

  const getNotificationLabel = (days: number) => {
    if (days === 0) return "На самиот ден";
    if (days === 1) return "1 ден порано";
    if (days === 7) return "1 недела порано";
    return `${days} дена порано`;
  };

  return (
    <div className="space-y-8 animate-fadeIn pb-20">
      <header className="flex flex-col items-center justify-center text-center">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Твоите обврски</h2>
        <p className="text-slate-500 font-medium italic mt-2">Никогаш не заборавај на твоите сметки и обврски.</p>
      </header>

      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
        <h3 className="font-black text-[10px] uppercase tracking-widest text-slate-400 mb-6 text-center">Додади нова обврска</h3>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Име на обврската</label>
            <input 
              type="text" placeholder="пр: Сметка за вода" 
              className="p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 font-bold"
              value={title} onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Износ (ден)</label>
            <input 
              type="text" 
              inputMode="numeric"
              placeholder="0" 
              className="p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-indigo-600 font-black"
              value={formatForDisplay(amount)} 
              onChange={handleAmountChange}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Краен рок</label>
            <input 
              type="date" 
              className="p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 font-medium"
              value={date} onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Тип на обврска</label>
            <select 
              className="p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 font-bold appearance-none"
              value={type} onChange={(e) => setType(e.target.value as any)}
            >
              <option value="bill">Сметка</option>
              <option value="credit">Кредит / Рата</option>
              <option value="subscription">Претплата</option>
              <option value="vehicle">Регистрација</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Извести ме пред време</label>
            <select 
              className="p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 font-bold appearance-none"
              value={notificationDays} onChange={(e) => setNotificationDays(parseInt(e.target.value))}
            >
              <option value={0}>На самиот ден</option>
              <option value={1}>1 ден порано</option>
              <option value={2}>2 дена порано</option>
              <option value={3}>3 дена порано</option>
              <option value={7}>1 недела порано</option>
            </select>
          </div>
          <div className="flex items-end">
            <button className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 uppercase tracking-widest text-[10px]">
              Зачувај
            </button>
          </div>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reminders.sort((a,b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()).map(r => (
          <div key={r.id} className={`p-6 rounded-[2.5rem] border transition-all relative overflow-hidden group ${r.isPaid ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-white border-slate-100 shadow-sm'}`}>
            <div className="flex justify-between items-start relative z-10">
              <div className="flex gap-4">
                <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                  {getIcon(r.type)}
                </div>
                <div>
                  <h4 className={`text-lg font-black ${r.isPaid ? 'line-through text-slate-500' : 'text-slate-900'}`}>{r.title}</h4>
                  <div className="flex flex-col gap-0.5">
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-tighter">Рок: {new Date(r.dueDate).toLocaleDateString('mk-MK')}</p>
                    {!r.isPaid && (
                      <p className="text-[9px] text-indigo-400 font-bold flex items-center gap-1 mt-1">
                        <span>🔔</span> {getNotificationLabel(r.notificationDaysBefore)}
                      </p>
                    )}
                  </div>
                  <p className="text-xl font-black text-indigo-600 mt-2">{r.amount.toLocaleString('mk-MK')} <span className="text-[10px]">ден.</span></p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <button 
                  onClick={() => onTogglePaid(r.id)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${r.isPaid ? 'bg-indigo-600 text-white shadow-md' : 'bg-green-100 text-green-700 hover:bg-green-200 uppercase tracking-widest'}`}
                >
                  {r.isPaid ? 'ПЛАТЕНО' : 'ПЛАТИ'}
                </button>
                <button onClick={() => onDeleteReminder(r.id)} className="text-[9px] text-slate-300 hover:text-red-500 font-black uppercase tracking-widest text-right mt-1">Избриши</button>
              </div>
            </div>
          </div>
        ))}
        {reminders.length === 0 && (
          <div className="md:col-span-2 text-center py-20 bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200">
            <p className="text-slate-400 font-black text-sm uppercase tracking-widest">Нема активни потсетници.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RemindersView;
