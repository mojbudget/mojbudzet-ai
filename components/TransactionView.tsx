
import React, { useState, useEffect, useRef } from 'react';
// @ts-ignore
import jsQR from 'jsqr';
import { Transaction, MainCategory, SubCategoryMap, Member } from '../types';
import { getTransactionIcon } from './Dashboard';
import { analyzeQrData } from '../services/geminiService';
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
  const [qrData, setQrData] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const scanFrameRef = useRef<number>(0);
  const lastQrFoundTime = useRef<number>(0);

  useEffect(() => {
    if (isScannerOpen && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      startScanLoop();
    }
    return () => {
      if (scanFrameRef.current) cancelAnimationFrame(scanFrameRef.current);
    };
  }, [isScannerOpen, stream]);

  const startScanLoop = () => {
    const scan = () => {
      if (!videoRef.current || !canvasRef.current || isAnalyzing) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        // Оптимизација: Не поставувај димензии секој фрејм ако не се променети
        if (canvas.width !== video.videoWidth) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
          
          if (code) {
            setQrData(code.data);
            lastQrFoundTime.current = Date.now();
          } else {
            // „Леплива“ детекција: ако го изгубиме кодот, чекаме 1.5 секунди пред да го избришеме qrData
            if (Date.now() - lastQrFoundTime.current > 1500) {
              setQrData(null);
            }
          }
        }
      }
      scanFrameRef.current = requestAnimationFrame(scan);
    };
    scanFrameRef.current = requestAnimationFrame(scan);
  };

  const handleCaptureQr = async () => {
    if (!qrData) return;
    
    // Ефект на блиц
    setFlash(true);
    setTimeout(() => setFlash(false), 150);
    
    setIsAnalyzing(true);
    
    // Екстракција на износ од македонска сметка (am= параметар во URL)
    let extractedAmount = 0;
    try {
      if (qrData.includes('am=')) {
        const url = new URL(qrData.startsWith('http') ? qrData : `https://mojddv.gov.mk/s/qr?${qrData}`);
        const am = url.searchParams.get('am');
        if (am) extractedAmount = parseFloat(am);
      }
    } catch (e) {
      const match = qrData.match(/am=([\d.]+)/);
      if (match) extractedAmount = parseFloat(match[1]);
    }

    // Го затвораме стримот веднаш по „сликањето“
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsScannerOpen(false);

    try {
      const aiResult = await analyzeQrData(qrData, categories);
      
      onAddTransaction({
        id: Math.random().toString(36).substr(2, 9),
        date: new Date().toISOString(),
        description: aiResult?.description || 'Трансакција од QR',
        amount: -Math.abs(extractedAmount || 0),
        mainCategory: (aiResult?.mainCategory as MainCategory) || MainCategory.NEEDS,
        subCategory: aiResult?.subCategory || 'Друго',
        type: 'expense',
        memberId: currentMemberId,
        isCategorizing: false
      });
    } catch (err) {
      console.error(err);
      alert("Се случи грешка при анализата. Обидете се рачно.");
    } finally {
      setIsAnalyzing(false);
      setQrData(null);
    }
  };

  const openScanner = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } 
      });
      setStream(s);
      setIsScannerOpen(true);
      setQrData(null);
      lastQrFoundTime.current = 0;
    } catch (err) {
      alert("Овозможете пристап до камерата во подесувањата на прелистувачот.");
    }
  };

  const closeScanner = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsScannerOpen(false);
    if (scanFrameRef.current) cancelAnimationFrame(scanFrameRef.current);
    setQrData(null);
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
      onUpdateTransaction(editingId, { mainCategory: editMainCat, subCategory: editSubCat });
      setEditingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {isScannerOpen && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-between">
          {/* Flash Effect Overlay */}
          {flash && <div className="absolute inset-0 z-[105] bg-white animate-pulse"></div>}

          <div className={`relative w-full flex-grow overflow-hidden bg-slate-900 border-b-8 transition-all duration-500 ${qrData ? 'border-green-500' : 'border-slate-800'}`}>
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            <canvas ref={canvasRef} className="hidden" />
            
            <div className="absolute inset-x-0 top-12 flex justify-center pointer-events-none px-6">
                <div className={`bg-black/60 backdrop-blur-xl px-8 py-4 rounded-full border transition-all duration-300 flex items-center gap-3 ${qrData ? 'scale-110 border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.3)]' : 'border-white/10'}`}>
                   {qrData && <div className="w-2 h-2 bg-green-500 rounded-full animate-ping"></div>}
                   <p className={`text-[12px] font-black uppercase tracking-[0.2em] ${qrData ? 'text-green-400' : 'text-white'}`}>
                    {qrData ? '✅ QR КОДОТ Е ФИКСИРАН' : 'НАСОЧЕТЕ КОН QR КОДОТ'}
                   </p>
                </div>
            </div>

            {qrData && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                 <div className="w-64 h-64 border-2 border-green-500/50 rounded-[3rem] animate-pulse">
                    <div className="absolute inset-0 bg-green-500/5 rounded-[3rem]"></div>
                 </div>
              </div>
            )}
          </div>
          
          <div className="p-10 w-full max-w-md bg-black flex flex-col gap-4">
            <button 
              onClick={handleCaptureQr} 
              className={`w-full py-7 rounded-[2.5rem] font-black uppercase text-sm shadow-2xl transition-all duration-300 flex items-center justify-center gap-3 active:scale-90 ${qrData ? 'bg-green-500 text-white shadow-green-500/20 animate-bounce-subtle' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
            >
              <IconCamera className="w-6 h-6" />
              ПРОЧИТАЈ QR КОД
            </button>
            <button onClick={closeScanner} className="w-full py-4 text-white/30 font-black uppercase text-[11px] tracking-[0.3em]">Прекини</button>
          </div>
        </div>
      )}

      {isAnalyzing && (
        <div className="fixed inset-0 z-[110] bg-slate-900/95 backdrop-blur-xl flex flex-col items-center justify-center text-white p-10 text-center animate-fadeIn">
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-green-500 blur-2xl opacity-20 animate-pulse"></div>
            <div className="relative w-24 h-24 bg-green-500 rounded-[2.5rem] flex items-center justify-center shadow-2xl">
              <IconTransactions className="w-12 h-12 text-white" />
            </div>
          </div>
          <h2 className="text-3xl font-black mb-3 tracking-tight">Се обработува...</h2>
          <p className="text-slate-400 text-base font-medium max-w-[240px] leading-relaxed">
            Вештачката интелигенција ги категоризира податоците од сметката.
          </p>
          <div className="mt-12 flex gap-2">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-2.5 h-2.5 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }}></div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
        <div className="flex justify-between items-center mb-6 px-2">
          <h3 className="font-black text-[10px] uppercase tracking-widest text-slate-400">Внес на трансакција</h3>
          <button onClick={openScanner} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100 active:scale-95 transition-all group">
            <IconCamera className="w-4 h-4" /> Скенирај QR
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
                    <div className="flex flex-col sm:flex-row gap-2 mt-2 items-center">
                      <select className="text-[10px] font-black p-2 border rounded-xl" value={editMainCat} onChange={(e) => setEditMainCat(e.target.value as MainCategory)}>
                        {Object.values(MainCategory).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                      <select className="text-[10px] font-black p-2 border rounded-xl" value={editSubCat} onChange={(e) => setEditSubCat(e.target.value)}>
                        {categories[editMainCat]?.map(sub => <option key={sub} value={sub}>{sub}</option>)}
                      </select>
                      <button onClick={saveEdit} className="text-[10px] font-black text-white px-4 py-2 bg-indigo-600 rounded-xl">ОК</button>
                      <button onClick={() => setEditingId(null)} className="text-[10px] font-black text-slate-400 px-4 py-2 bg-slate-100 rounded-xl">X</button>
                    </div>
                  ) : (
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-0.5 flex items-center gap-2">
                      {t.subCategory}
                      <button onClick={() => startEditing(t)} className="opacity-0 group-hover:opacity-100 text-indigo-400"><IconEdit className="w-3.5 h-3.5" /></button>
                    </p>
                  )}
                </div>
              </div>
              <div className={`text-sm font-black px-4 py-2 rounded-xl ${t.type === 'income' ? 'bg-green-50 text-green-600' : 'bg-slate-50 text-slate-900'}`}>
                {t.type === 'income' ? '+' : '-'}{Math.abs(t.amount).toLocaleString('mk-MK')} <span className="text-[10px] opacity-60">ден.</span>
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes bounce-subtle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        .animate-bounce-subtle {
          animation: bounce-subtle 2s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default TransactionView;
