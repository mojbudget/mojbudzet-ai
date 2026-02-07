
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

  const startScanLoop = () => {
    const scan = () => {
      if (!videoRef.current || !canvasRef.current || isAnalyzing) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
          if (code) {
            setQrData(code.data);
          } else {
            setQrData(null);
          }
        }
      }
      scanFrameRef.current = requestAnimationFrame(scan);
    };
    scanFrameRef.current = requestAnimationFrame(scan);
  };

  const handleCaptureQr = async () => {
    if (!qrData) return;
    setIsAnalyzing(true);
    
    // Екстракција на износ од македонска сметка (am= параметар во URL)
    let extractedAmount = 0;
    try {
      const url = new URL(qrData);
      const am = url.searchParams.get('am');
      if (am) extractedAmount = parseFloat(am);
    } catch (e) {
      // Ако не е URL, бараме бројки со regex
      const match = qrData.match(/am=([\d.]+)/);
      if (match) extractedAmount = parseFloat(match[1]);
    }

    closeScanner();

    try {
      const aiResult = await analyzeQrData(qrData, categories);
      
      onAddTransaction({
        id: Math.random().toString(36).substr(2, 9),
        date: new Date().toISOString(),
        description: aiResult?.description || 'Скенирана сметка',
        amount: -Math.abs(extractedAmount || 0),
        mainCategory: (aiResult?.mainCategory as MainCategory) || MainCategory.NEEDS,
        subCategory: aiResult?.subCategory || 'Друго',
        type: 'expense',
        memberId: currentMemberId,
        isCategorizing: false
      });
    } catch (err) {
      alert("Грешка при обработка на QR кодот.");
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
    } catch (err) {
      alert("Нема пристап до камерата.");
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
      onUpdateTransaction(editingId, { mainCategory: editMainCat, subCategory: editSubCat });
      setEditingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {isScannerOpen && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-between">
          <div className={`relative w-full flex-grow overflow-hidden bg-slate-900 border-b-8 transition-colors duration-300 ${qrData ? 'border-green-500' : 'border-slate-800'}`}>
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            <canvas ref={canvasRef} className="hidden" />
            
            <div className="absolute inset-x-0 top-10 flex justify-center pointer-events-none">
                <div className={`bg-black/60 backdrop-blur-xl px-6 py-3 rounded-full border transition-all ${qrData ? 'scale-110 border-green-500 text-green-400' : 'border-white/10 text-white'}`}>
                   <p className="text-[11px] font-black uppercase tracking-[0.2em]">
                    {qrData ? '✅ QR КОДОТ Е ДЕТЕКТИРАН!' : 'НАСОЧЕТЕ КОН QR КОДОТ'}
                   </p>
                </div>
            </div>

            {qrData && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                 <div className="w-48 h-48 border-4 border-green-500 rounded-3xl animate-pulse shadow-[0_0_50px_rgba(34,197,94,0.5)]"></div>
              </div>
            )}
          </div>
          
          <div className="p-8 w-full max-w-md bg-black">
            <button 
              disabled={!qrData}
              onClick={handleCaptureQr} 
              className={`w-full py-6 rounded-[2rem] font-black uppercase text-sm shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3 ${qrData ? 'bg-green-500 text-white' : 'bg-slate-800 text-slate-500'}`}
            >
              <IconCamera className="w-5 h-5" />
              ПРОЧИТАЈ QR КОД
            </button>
            <button onClick={closeScanner} className="w-full py-4 text-white/30 font-black uppercase text-[10px] tracking-widest mt-2">Прекини</button>
          </div>
        </div>
      )}

      {isAnalyzing && (
        <div className="fixed inset-0 z-[110] bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center text-white p-10 text-center animate-fadeIn">
          <div className="w-20 h-20 bg-green-500 rounded-[2rem] flex items-center justify-center mb-6 animate-bounce">
            <IconTransactions className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-black mb-2">Обработка...</h2>
          <p className="text-slate-400 text-sm">Ги подготвуваме податоците од вашата сметка.</p>
        </div>
      )}

      <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
        <div className="flex justify-between items-center mb-6">
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
    </div>
  );
};

export default TransactionView;
