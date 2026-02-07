
import React, { useState, useEffect, useRef } from 'react';
import { Transaction, MainCategory, SubCategoryMap, Member } from '../types';
import { getTransactionIcon } from './Dashboard';
import { analyzeReceiptImage } from '../services/geminiService';
import { IconCamera, IconTransactions, IconEdit } from './Icons';

interface TransactionViewProps {
  transactions: Transaction[];
  onAddTransaction: (t: Transaction) => void;
  onUpdateTransaction: (id: string, updates: Partial<Transaction>) => void;
  categories: SubCategoryMap;
  members: Member[];
  currentMemberId: string;
}

const TransactionView: React.FC<TransactionViewProps> = ({ 
  transactions, onAddTransaction, onUpdateTransaction, categories, members, currentMemberId 
}) => {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [selectedMainCat, setSelectedMainCat] = useState<string>('AI');
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMainCat, setEditMainCat] = useState<MainCategory>(MainCategory.NEEDS);
  const [editSubCat, setEditSubCat] = useState('');

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Осигуруваме дека видеото ќе се прикаже откако ќе се монтира елементот
  useEffect(() => {
    if (isScannerOpen && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [isScannerOpen, stream]);

  useEffect(() => {
    if (selectedMainCat === 'AI') {
      setSubCategory('');
    } else {
      const availableSubs = categories[selectedMainCat as MainCategory] || [];
      if (availableSubs.length > 0) setSubCategory(availableSubs[0]);
      else setSubCategory(selectedMainCat);
    }
  }, [selectedMainCat, categories]);

  const openScanner = async () => {
    try {
      // Бараме дозвола пред да го отвориме UI за да бидеме сигурни
      const s = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      setStream(s);
      setIsScannerOpen(true);
    } catch (err) {
      console.error("Camera access error:", err);
      alert("Нема пристап до камерата. Ве молиме дозволете пристап во подесувањата на прелистувачот.");
    }
  };

  const closeScanner = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsScannerOpen(false);
  };

  const captureAndAnalyze = async () => {
    if (!videoRef.current || !canvasRef.current || !stream) return;
    
    setIsAnalyzing(true);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
      
      try {
        const result = await analyzeReceiptImage(base64, categories);
        if (result) {
          setDescription(result.description);
          setAmount(result.amount.toString());
          setSelectedMainCat(result.mainCategory);
          setSubCategory(result.subCategory);
          closeScanner();
        }
      } catch (err) {
        alert("Грешка при читање. Обидете се со подобра осветленост или рачен внес.");
      } finally {
        setIsAnalyzing(false);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rawAmount = parseFloat(amount.replace(/\D/g, ''));
    if (!description || isNaN(rawAmount)) return;
    
    const isAi = selectedMainCat === 'AI';
    const mainCat = isAi ? (type === 'income' ? MainCategory.INCOME : MainCategory.NEEDS) : (selectedMainCat as MainCategory);

    onAddTransaction({
      id: Math.random().toString(36).substr(2, 9),
      date: new Date().toISOString(),
      description,
      amount: type === 'income' ? Math.abs(rawAmount) : -Math.abs(rawAmount),
      mainCategory: mainCat,
      subCategory: isAi ? '✨ Размислувам...' : (subCategory || mainCat),
      type: type,
      isCategorizing: isAi,
      memberId: currentMemberId
    });
    
    setDescription(''); setAmount(''); setSelectedMainCat('AI');
  };

  const startEditing = (t: Transaction) => {
    setEditingId(t.id);
    setEditMainCat(t.mainCategory);
    setEditSubCat(t.subCategory);
  };

  const saveEdit = () => {
    if (editingId) {
      onUpdateTransaction(editingId, {
        mainCategory: editMainCat,
        subCategory: editSubCat
      });
      setEditingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {isScannerOpen && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center">
          <div className="relative w-full max-w-md aspect-[3/4] overflow-hidden bg-slate-900 shadow-2xl rounded-b-3xl">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted
              className="w-full h-full object-cover" 
            />
            <canvas ref={canvasRef} className="hidden" />
            <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none">
              <div className="w-full h-full border-2 border-dashed border-indigo-400 rounded-3xl animate-pulse"></div>
            </div>
            {isAnalyzing && (
              <div className="absolute inset-0 bg-black/70 backdrop-blur-md flex flex-col items-center justify-center text-white p-10 text-center">
                <div className="w-12 h-12 border-4 border-white border-t-indigo-500 rounded-full animate-spin mb-4"></div>
                <p className="text-xs font-black uppercase tracking-widest leading-relaxed">Вештачката интелигенција ја чита сметката...</p>
              </div>
            )}
          </div>
          <div className="p-8 flex gap-4 w-full max-w-md">
            <button 
              onClick={captureAndAnalyze} 
              disabled={isAnalyzing} 
              className="flex-grow py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 transition-transform disabled:opacity-50"
            >
              Скенирај
            </button>
            <button 
              onClick={closeScanner} 
              className="px-8 py-5 bg-white/10 text-white rounded-2xl font-black uppercase text-xs backdrop-blur-md"
            >
              Затвори
            </button>
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-black text-[10px] uppercase tracking-widest text-slate-400">Внес на трансакција</h3>
          <button onClick={openScanner} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl font-black text-[9px] uppercase tracking-widest border border-indigo-100 active:scale-95 transition-transform">
            <IconCamera className="w-3 h-3" /> Скенирај сметка
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex p-1 bg-slate-100 rounded-xl mb-2">
            <button type="button" onClick={() => setType('expense')} className={`flex-1 py-2 rounded-lg text-[10px] font-black transition-all ${type === 'expense' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500'}`}>ОДЛИВ</button>
            <button type="button" onClick={() => setType('income')} className={`flex-1 py-2 rounded-lg text-[10px] font-black transition-all ${type === 'income' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500'}`}>ПРИЛИВ</button>
          </div>
          
          <div className="flex flex-col md:flex-row gap-3">
            <input type="text" placeholder="Опис на трансакција" className="flex-grow p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-900 font-bold" value={description} onChange={(e) => setDescription(e.target.value)} />
            <input type="text" inputMode="numeric" placeholder="Износ" className="w-full md:w-32 p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-black text-slate-900" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <select className="p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-slate-900 font-bold appearance-none cursor-pointer" value={selectedMainCat} onChange={(e) => setSelectedMainCat(e.target.value)}>
              <option value="AI">✦ AI Автоматски</option>
              {Object.values(MainCategory).map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
            <select disabled={selectedMainCat === 'AI'} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-slate-900 font-bold appearance-none disabled:opacity-50" value={subCategory} onChange={(e) => setSubCategory(e.target.value)}>
              {selectedMainCat === 'AI' ? <option>Чекај AI...</option> : categories[selectedMainCat as MainCategory]?.map(sub => <option key={sub} value={sub}>{sub}</option>)}
            </select>
          </div>

          <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg hover:bg-indigo-700 transition-all active:scale-[0.98]">Додади</button>
        </form>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden divide-y divide-slate-100">
        {transactions.map(t => {
          const isEditing = editingId === t.id;

          return (
            <div key={t.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between group gap-4">
              <div className="flex items-center gap-4 flex-grow">
                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center group-hover:bg-indigo-50 transition-colors">
                  {getTransactionIcon(t.subCategory, t.mainCategory)}
                </div>
                <div className="flex-grow">
                  <p className="font-black text-slate-900 text-base">{t.description}</p>
                  
                  {isEditing ? (
                    <div className="flex flex-col sm:flex-row gap-2 mt-2">
                      <select 
                        className="text-[10px] font-black uppercase p-1 border rounded bg-slate-50 outline-none focus:ring-1 focus:ring-indigo-500"
                        value={editMainCat}
                        onChange={(e) => {
                          const newMain = e.target.value as MainCategory;
                          setEditMainCat(newMain);
                          setEditSubCat(categories[newMain][0] || '');
                        }}
                      >
                        {Object.values(MainCategory).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                      <select 
                        className="text-[10px] font-black uppercase p-1 border rounded bg-slate-50 outline-none focus:ring-1 focus:ring-indigo-500"
                        value={editSubCat}
                        onChange={(e) => setEditSubCat(e.target.value)}
                      >
                        {categories[editMainCat]?.map(sub => <option key={sub} value={sub}>{sub}</option>)}
                      </select>
                      <div className="flex gap-1">
                        <button onClick={saveEdit} className="text-[10px] font-black text-green-600 uppercase px-2 py-1 bg-green-50 rounded">ОК</button>
                        <button onClick={() => setEditingId(null)} className="text-[10px] font-black text-red-400 uppercase px-2 py-1 bg-red-50 rounded">X</button>
                      </div>
                    </div>
                  ) : (
                    <p className={`text-[9px] font-black uppercase tracking-widest flex items-center gap-2 ${t.isCategorizing ? 'text-indigo-500 animate-pulse' : 'text-slate-400'}`}>
                      {t.isCategorizing ? '✦ СЕ КАТЕГОРИЗИРА...' : t.subCategory}
                      {!t.isCategorizing && (
                        <button 
                          onClick={() => startEditing(t)}
                          className="text-indigo-400 hover:text-indigo-600 p-1 rounded-lg hover:bg-indigo-50 transition-all ml-1"
                          title="Промени категорија"
                        >
                          <IconEdit className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between md:justify-end gap-4">
                <div className={`text-sm font-black whitespace-nowrap ${t.type === 'income' ? 'text-green-600' : 'text-slate-900'}`}>
                  {t.type === 'income' ? '+' : '-'}{Math.abs(t.amount).toLocaleString('mk-MK')} ден.
                </div>
              </div>
            </div>
          );
        })}
        {transactions.length === 0 && (
          <div className="text-center py-20 opacity-30">
             <IconTransactions className="w-12 h-12 mx-auto mb-4" />
             <p className="text-[10px] font-black uppercase tracking-widest">Нема трансакции</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TransactionView;
