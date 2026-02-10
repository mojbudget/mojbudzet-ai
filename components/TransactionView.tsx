import React, { useState, useEffect, useRef } from 'react';
import jsQR from 'jsqr';
import { Transaction, MainCategory, SubCategoryMap, Member } from '../types';
import { getTransactionIcon } from './Dashboard';
import { analyzeQrData } from '../services/geminiService';
import { IconCamera, IconTransactions, IconEdit, IconTrash } from './Icons';

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
          const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
          if (code) {
            setIsQrFound(true);
            processCapturedQr(code.data);
          }
        }
      }
      scanFrameRef.current = requestAnimationFrame(scan);
    };
    scanFrameRef.current = requestAnimationFrame(scan);
  };

  const processCapturedQr = async (qrData: string) => {
    setIsAnalyzing(true);
    closeScanner();
    try {
      const result = await analyzeQrData(qrData, categories);
      if (result) {
        // Автоматско додавање со извлечените податоци
        onAddTransaction({
          id: Math.random().toString(36).substr(2, 9),
          date: new Date().toISOString(),
          description: result.description,
          amount: -Math.abs(result.amount),
          mainCategory: result.mainCategory,
          subCategory: result.subCategory,
          type: 'expense',
          memberId: currentMemberId
        });
      }
    } catch (err) {
      alert("Грешка при анализа на кодот.");
    } finally {
      setIsAnalyzing(false);
      setIsQrFound(false);
    }
  };

  const openScanner = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setStream(s);
      setIsScannerOpen(true);
    } catch (err) {
      alert("Дозволете пристап до камера.");
    }
  };

  const closeScanner = () => {
    if (stream) stream.getTracks().forEach(track => track.stop());
    setStream(null);
    setIsScannerOpen(false);
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
      subCategory: isAi ? '✨ Се категоризира...' : (subCategory || mainCat),
      type,
      isCategorizing: isAi,
      memberId: currentMemberId
    });
    setDescription(''); setAmount(''); setSelectedMainCat('AI');
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {isScannerOpen && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          <canvas ref={canvasRef} className="hidden" />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
             <div className="w-64 h-64 border-2 border-white/30 rounded-3xl"></div>
          </div>
          <button onClick={closeScanner} className="absolute bottom-10 px-8 py-4 bg-white/20 text-white rounded-full backdrop-blur-md font-black uppercase tracking-widest text-[10px]">Затвори камера</button>
        </div>
      )}

      {isAnalyzing && (
        <div className="fixed inset-0 z-[110] bg-indigo-600/90 flex flex-col items-center justify-center text-white p-10 text-center">
          <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mb-4"></div>
          <h2 className="text-xl font-black mb-1">Анализа на сметка...</h2>
          <p className="text-xs font-medium opacity-80 uppercase tracking-widest">AI ги извлекува износот и категоријата</p>
        </div>
      )}

      <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-black text-[10px] uppercase tracking-widest text-slate-400">Внес на трансакција</h3>
          <button onClick={openScanner} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-2xl font-black text-[9px] uppercase tracking-widest shadow-lg active:scale-95 transition-all">
            <IconCamera className="w-3.5 h-3.5" /> Скенирај QR
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex p-1 bg-slate-100 rounded-xl mb-2">
            <button type="button" onClick={() => setType('expense')} className={`flex-1 py-2 rounded-lg text-[10px] font-black transition-all ${type === 'expense' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500'}`}>ОДЛИВ</button>
            <button type="button" onClick={() => setType('income')} className={`flex-1 py-2 rounded-lg text-[10px] font-black transition-all ${type === 'income' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500'}`}>ПРИЛИВ</button>
          </div>
          <div className="flex flex-col md:flex-row gap-3">
            <input type="text" placeholder="Опис / Продавач" className="flex-grow p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold" value={description} onChange={(e) => setDescription(e.target.value)} />
            <input type="text" inputMode="numeric" placeholder="Износ" className="w-full md:w-32 p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-black text-indigo-600" value={amount.replace(/\B(?=(\d{3})+(?!\d))/g, ".")} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <select className="p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold cursor-pointer" value={selectedMainCat} onChange={(e) => setSelectedMainCat(e.target.value)}>
              <option value="AI">✦ AI Автоматски</option>
              {Object.values(MainCategory).map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
            <select disabled={selectedMainCat === 'AI'} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold disabled:opacity-50 cursor-pointer" value={subCategory} onChange={(e) => setSubCategory(e.target.value)}>
              {selectedMainCat === 'AI' ? <option>Чекај AI...</option> : categories[selectedMainCat as MainCategory]?.map(sub => <option key={sub} value={sub}>{sub}</option>)}
            </select>
          </div>
          <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg active:scale-95 transition-all">Додади во листа</button>
        </form>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden divide-y divide-slate-100">
        {transactions.map(t => {
          return (
            <div key={t.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between group gap-4 hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-4 flex-grow">
                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center group-hover:bg-indigo-50 transition-colors shadow-inner">
                  {getTransactionIcon(t.subCategory, t.mainCategory)}
                </div>
                <div className="flex-grow">
                  <p className="font-black text-slate-900 text-base">{t.description}</p>
                  <div className="flex items-center gap-2">
                    <p className={`text-[9px] font-black uppercase tracking-widest ${t.isCategorizing ? 'text-indigo-500 animate-pulse' : 'text-slate-400'}`}>
                      {t.isCategorizing ? '✦ СЕ КАТЕГОРИЗИРА...' : t.subCategory}
                    </p>
                    <button 
                      onClick={() => { if(window.confirm("Избриши?")) onDeleteTransaction(t.id); }}
                      className="opacity-0 group-hover:opacity-100 text-red-300 hover:text-red-500 transition-all p-1"
                    >
                      <IconTrash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
              <div className={`text-sm font-black whitespace-nowrap ${t.type === 'income' ? 'text-green-600' : 'text-slate-900'}`}>
                {t.type === 'income' ? '+' : '-'}{Math.abs(t.amount).toLocaleString('mk-MK')} ден.
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TransactionView;
