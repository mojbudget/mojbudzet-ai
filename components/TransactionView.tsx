
import React, { useState, useEffect, useRef } from 'react';
// @ts-ignore
import jsQR from 'jsqr';
import { Transaction, MainCategory, SubCategoryMap, Member } from '../types';
import { getTransactionIcon } from './Dashboard';
import { analyzeReceiptImage } from '../services/geminiService';
import { IconCamera, IconTransactions, IconEdit } from './Icons';

interface TransactionViewProps {
  transactions: Transaction[];
  onAddTransaction: (t: Transaction) => void;
  onUpdateTransaction: (id: string, updates: Partial<Transaction>) => void;
  onDeleteTransaction: (id: string) => void;
  categories: SubCategoryMap;
  members: Member[];
  currentMemberId: string;
}

const TransactionView: React.FC<TransactionViewProps> = ({ 
  transactions, onAddTransaction, onUpdateTransaction, onDeleteTransaction, categories, members, currentMemberId 
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
  const [isQrFound, setIsQrFound] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const scanFrameRef = useRef<number>(0);

  useEffect(() => {
    if (isScannerOpen && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      startScanLoop();
    }
    return () => {
      if (scanFrameRef.current) cancelAnimationFrame(scanFrameRef.current);
    };
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

  const startScanLoop = () => {
    const scan = () => {
      if (!videoRef.current || !canvasRef.current || isAnalyzing || isQrFound) return;
      
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          });

          if (code) {
            setIsQrFound(true);
            const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
            processCapturedReceipt(base64);
          }
        }
      }
      scanFrameRef.current = requestAnimationFrame(scan);
    };
    scanFrameRef.current = requestAnimationFrame(scan);
  };

  const processCapturedReceipt = async (base64: string) => {
    setIsAnalyzing(true);
    closeScanner();
    
    try {
      const result = await analyzeReceiptImage(base64, categories);
      if (result) {
        onAddTransaction({
          id: Math.random().toString(36).substr(2, 9),
          date: new Date().toISOString(),
          description: result.description,
          amount: -Math.abs(result.amount),
          mainCategory: result.mainCategory as MainCategory,
          subCategory: result.subCategory,
          type: 'expense',
          memberId: currentMemberId,
          isCategorizing: false
        });
        
        setDescription('');
        setAmount('');
        setSelectedMainCat('AI');
      }
    } catch (err) {
      alert("Неуспешно читање. Пробајте повторно или внесете рачно.");
    } finally {
      setIsAnalyzing(false);
      setIsQrFound(false);
    }
  };

  const openScanner = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      setStream(s);
      setIsScannerOpen(true);
      setIsQrFound(false);
    } catch (err) {
      alert("Дозволете пристап до камерата.");
    }
  };

  const closeScanner = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsScannerOpen(false);
    if (scanFrameRef.current) cancelAnimationFrame(scanFrameRef.current);
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
          <div className="relative w-full max-w-md aspect-[3/4] overflow-hidden bg-slate-900 shadow-2xl rounded-b-[3rem]">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            <canvas ref={canvasRef} className="hidden" />
            
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className={`relative w-64 h-64 border-2 border-white/20 transition-all duration-300 ${isQrFound ? 'border-green-500 bg-green-500/10 scale-105' : 'bg-black/10'}`}>
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-indigo-500 -translate-x-1 -translate-y-1"></div>
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-indigo-500 translate-x-1 -translate-y-1"></div>
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-indigo-500 -translate-x-1 translate-y-1"></div>
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-indigo-500 translate-x-1 translate-y-1"></div>
                
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-12 bg-black/60 backdrop-blur-xl px-4 py-2 rounded-full border border-white/10">
                   <p className="text-[10px] font-black text-white uppercase tracking-[0.2em] whitespace-nowrap">
                    {isQrFound ? '✅ ПРОЧИТАНО!' : 'НИШАНИ КОН QR КОДОТ'}
                   </p>
                </div>

                {!isQrFound && (
                  <div className="absolute inset-x-2 top-0 h-0.5 bg-indigo-500 shadow-[0_0_15px_rgba(79,70,229,0.8)] animate-[scanLine_2s_infinite]"></div>
                )}
              </div>
            </div>
          </div>
          
          <div className="p-10 w-full max-w-md">
            <button onClick={closeScanner} className="w-full py-5 bg-white/10 text-white rounded-3xl font-black uppercase text-xs backdrop-blur-xl border border-white/10 active:scale-95 transition-all">
              Прекини скенирање
            </button>
          </div>
        </div>
      )}

      {isAnalyzing && (
        <div className="fixed inset-0 z-[110] bg-indigo-600 flex flex-col items-center justify-center text-white p-10 text-center animate-fadeIn">
          <div className="w-24 h-24 bg-white/10 rounded-[2.5rem] flex items-center justify-center mb-10 animate-pulse border border-white/20">
            <IconCamera className="w-12 h-12 text-white" />
          </div>
          <h2 className="text-3xl font-black tracking-tight mb-4">Автоматско внесување...</h2>
          <p className="text-indigo-100 font-medium opacity-80 max-w-xs text-lg">
            AI ги чита податоците од сметката. Трансакцијата ќе се појави веднаш во листата.
          </p>
          <div className="mt-16 flex gap-2">
            <div className="w-3 h-3 bg-white rounded-full animate-bounce [animation-duration:0.6s]"></div>
            <div className="w-3 h-3 bg-white rounded-full animate-bounce [animation-delay:0.2s] [animation-duration:0.6s]"></div>
            <div className="w-3 h-3 bg-white rounded-full animate-bounce [animation-delay:0.4s] [animation-duration:0.6s]"></div>
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-black text-[10px] uppercase tracking-widest text-slate-400">Внес на трансакција</h3>
          <button onClick={openScanner} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100 active:scale-95 transition-all group">
            <IconCamera className="w-4 h-4 group-hover:rotate-12 transition-transform" /> Скенирај сметка
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex p-1 bg-slate-100 rounded-xl mb-2">
            <button type="button" onClick={() => setType('expense')} className={`flex-1 py-2 rounded-lg text-[10px] font-black transition-all ${type === 'expense' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>ОДЛИВ</button>
            <button type="button" onClick={() => setType('income')} className={`flex-1 py-2 rounded-lg text-[10px] font-black transition-all ${type === 'income' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>ПРИЛИВ</button>
          </div>
          
          <div className="flex flex-col md:flex-row gap-3">
            <input type="text" placeholder="Опис / Продавач" className="flex-grow p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-900 font-bold" value={description} onChange={(e) => setDescription(e.target.value)} />
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

          <button type="submit" className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg hover:bg-slate-800 transition-all active:scale-[0.98]">Додади рачно</button>
        </form>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden divide-y divide-slate-100">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Листа на трансакции</p>
        </div>
        {transactions.map(t => {
          const isEditing = editingId === t.id;

          return (
            <div key={t.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between group gap-4 transition-all hover:bg-slate-50/50">
              <div className="flex items-center gap-4 flex-grow">
                <div className="w-12 h-12 bg-white border border-slate-100 rounded-2xl flex items-center justify-center group-hover:shadow-md transition-all">
                  {getTransactionIcon(t.subCategory, t.mainCategory)}
                </div>
                <div className="flex-grow">
                  <p className="font-black text-slate-900 text-base group-hover:text-indigo-600 transition-colors">{t.description}</p>
                  
                  {isEditing ? (
                    <div className="flex flex-col sm:flex-row gap-2 mt-2 animate-fadeIn items-center">
                      <select 
                        className="text-[10px] font-black uppercase p-2 border rounded-xl bg-white outline-none focus:ring-1 focus:ring-indigo-500 shadow-sm"
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
                        className="text-[10px] font-black uppercase p-2 border rounded-xl bg-white outline-none focus:ring-1 focus:ring-indigo-500 shadow-sm"
                        value={editSubCat}
                        onChange={(e) => setEditSubCat(e.target.value)}
                      >
                        {categories[editMainCat]?.map(sub => <option key={sub} value={sub}>{sub}</option>)}
                      </select>
                      <div className="flex gap-1">
                        <button onClick={saveEdit} className="text-[10px] font-black text-white uppercase px-4 py-2 bg-indigo-600 rounded-xl shadow-md">ОК</button>
                        <button onClick={() => onDeleteTransaction(t.id)} className="text-[10px] font-black text-red-600 uppercase px-4 py-2 bg-red-50 rounded-xl border border-red-100 hover:bg-red-100 transition-all">Избриши</button>
                        <button onClick={() => setEditingId(null)} className="text-[10px] font-black text-slate-400 uppercase px-4 py-2 bg-slate-100 rounded-xl">X</button>
                      </div>
                    </div>
                  ) : (
                    <p className={`text-[9px] font-black uppercase tracking-widest flex items-center gap-2 mt-0.5 ${t.isCategorizing ? 'text-indigo-500 animate-pulse' : 'text-slate-400'}`}>
                      {t.isCategorizing ? '✦ СЕ КАТЕГОРИЗИРА...' : t.subCategory}
                      {!t.isCategorizing && (
                        <button 
                          onClick={() => startEditing(t)}
                          className="opacity-0 group-hover:opacity-100 text-indigo-400 hover:text-indigo-600 p-1 rounded-lg hover:bg-indigo-50 transition-all ml-1"
                        >
                          <IconEdit className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between md:justify-end gap-4">
                <div className={`text-sm font-black whitespace-nowrap px-4 py-2 rounded-xl ${t.type === 'income' ? 'bg-green-50 text-green-600' : 'bg-slate-50 text-slate-900'}`}>
                  {t.type === 'income' ? '+' : '-'}{Math.abs(t.amount).toLocaleString('mk-MK')} <span className="text-[10px] opacity-60">ден.</span>
                </div>
              </div>
            </div>
          );
        })}
        {transactions.length === 0 && (
          <div className="text-center py-24 opacity-30">
             <IconTransactions className="w-16 h-16 mx-auto mb-6 text-slate-300" />
             <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Листата е празна</p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes scanLine {
          0% { top: 5%; opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { top: 95%; opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default TransactionView;
