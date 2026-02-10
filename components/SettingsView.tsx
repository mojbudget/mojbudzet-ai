
import React, { useState, useRef, useEffect } from 'react';
import { MainCategory, SubCategoryMap, CardInfo } from '../types';
import { getTransactionIcon } from './Dashboard';
import { IconGlobe, IconBank, IconNFC, IconCamera, IconEdit, IconPlus, IconTrash } from './Icons';

interface SettingsViewProps {
  categories: SubCategoryMap;
  onUpdateCategories: (newCats: SubCategoryMap) => void;
  isBankConnected: boolean;
  onToggleBank: (status: boolean) => void;
  cardInfo: CardInfo | null;
  onUpdateCardInfo: (info: CardInfo) => void;
  onSimulateTransaction: () => void;
  onResetData: () => void;
}

type LinkingMethod = 'none' | 'nfc' | 'scan' | 'manual' | 'skin';

const SettingsView: React.FC<SettingsViewProps> = ({ 
  categories, 
  onUpdateCategories, 
  isBankConnected, 
  onToggleBank,
  cardInfo,
  onUpdateCardInfo,
  onSimulateTransaction,
  onResetData
}) => {
  const [newSub, setNewSub] = useState('');
  const [selectedMain, setSelectedMain] = useState<MainCategory>(MainCategory.NEEDS);
  const [linkingMethod, setLinkingMethod] = useState<LinkingMethod>('none');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const startCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      setStream(s);
    } catch (err) {
      setLinkingMethod('manual');
    }
  };

  useEffect(() => {
    if (linkingMethod === 'scan' || linkingMethod === 'skin') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [linkingMethod]);

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const captureSkin = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png');
        onUpdateCardInfo({
          number: cardNumber || '**** **** **** 8824',
          expiry: expiry || '12/28',
          bankName: 'Стопанска Банка АД Скопје',
          type: 'VISA',
          skinUrl: dataUrl
        });
        handleFinishLinking();
      }
    }
  };

  const handleFinishLinking = () => {
    setIsProcessing(true);
    setTimeout(() => {
      onToggleBank(true);
      setLinkingMethod('none');
      setIsProcessing(false);
    }, 1500);
  };

  const formatCardNumber = (val: string) => {
    const v = val.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const parts = [];
    for (let i = 0, len = v.length; i < len; i += 4) {
      parts.push(v.substring(i, i + 4));
    }
    return parts.join(' ');
  };

  return (
    <div className="space-y-8 animate-fadeIn pb-24">
      <header className="text-center">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Конфигурација</h2>
        <p className="text-slate-500 font-medium italic mt-2">Менаџирај ги твоите картички и категории.</p>
      </header>

      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
        <h3 className="font-bold text-xl text-slate-800 mb-6">Опасна зона</h3>
        <div className="p-6 border-2 border-red-50 rounded-3xl bg-red-50/10">
          <p className="text-sm text-slate-600 mb-4 font-medium">Сакате да почнете од почеток? Ова ќе ги избрише сите ваши трансакции, буџети и поставки и ќе ве врати на почетниот екран за внес на сума.</p>
          <button 
            onClick={onResetData}
            className="flex items-center gap-2 px-6 py-3 bg-red-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-600 transition shadow-lg shadow-red-100"
          >
            <IconTrash className="w-4 h-4" /> Избриши ги сите податоци
          </button>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 relative overflow-hidden">
        <div className="flex items-center justify-between mb-8">
          <h3 className="font-bold text-xl text-slate-800">Твојата картичка</h3>
          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${isBankConnected ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
            {isBankConnected ? 'АКТИВНО' : 'НЕПОВРЗАНО'}
          </span>
        </div>

        {isBankConnected && cardInfo ? (
          <div className="space-y-6">
            <div className="relative group perspective-1000">
              <div className="relative bg-slate-900 p-8 rounded-[2rem] text-white flex flex-col justify-between h-52 shadow-xl overflow-hidden">
                {cardInfo.skinUrl && <img src={cardInfo.skinUrl} className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-overlay" alt="" />}
                <div className="relative z-10 flex justify-between items-start">
                  <div className="w-14 h-11 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-lg shadow-inner"></div>
                  <IconNFC className="w-6 h-6 opacity-60" />
                </div>
                <div className="relative z-10">
                  <p className="text-2xl font-mono tracking-[0.2em] mb-1">{cardInfo.number.replace(/\d{4} \d{4} \d{4}/, '**** **** ****')}</p>
                  <div className="flex justify-between items-end">
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/70">{cardInfo.bankName}</p>
                    <p className="text-xs font-mono">{cardInfo.expiry}</p>
                  </div>
                </div>
              </div>
            </div>
            <button onClick={() => onToggleBank(false)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-400 font-black text-xs uppercase tracking-widest hover:text-red-500 transition">Исклучи ја картичката</button>
          </div>
        ) : (
          <div className="text-center py-10 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200 space-y-4">
             <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 mx-auto"><IconBank className="w-8 h-8" /></div>
             <p className="font-black text-slate-800">Поврзи се за автоматско следење</p>
             <button onClick={() => setLinkingMethod('manual')} className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest">Внеси рачно</button>
          </div>
        )}
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
        <h3 className="font-bold text-xl mb-6 text-slate-800 text-center">Управување со поткатегории</h3>
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <select className="p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold" value={selectedMain} onChange={(e) => setSelectedMain(e.target.value as MainCategory)}>
            {Object.values(MainCategory).map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <input type="text" placeholder="Име на поткатегорија" className="flex-grow p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-medium" value={newSub} onChange={(e) => setNewSub(e.target.value)} />
          <button onClick={() => { if(newSub) { onUpdateCategories({...categories, [selectedMain]: [...categories[selectedMain], newSub]}); setNewSub(''); } }} className="px-8 py-4 bg-indigo-600 text-white font-black rounded-2xl flex items-center gap-2"><IconPlus className="w-4 h-4" /> Додади</button>
        </div>
      </div>
    </div>
  );
};

export default SettingsView;
