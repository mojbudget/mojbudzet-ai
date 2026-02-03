
import React, { useState, useRef, useEffect } from 'react';
import { MainCategory, SubCategoryMap, CardInfo } from '../types';
import { getTransactionIcon } from './Dashboard';

interface SettingsViewProps {
  categories: SubCategoryMap;
  onUpdateCategories: (newCats: SubCategoryMap) => void;
  isBankConnected: boolean;
  onToggleBank: (status: boolean) => void;
  cardInfo: CardInfo | null;
  onUpdateCardInfo: (info: CardInfo) => void;
  onSimulateTransaction: () => void;
}

type LinkingMethod = 'none' | 'nfc' | 'scan' | 'manual' | 'skin';

const SettingsView: React.FC<SettingsViewProps> = ({ 
  categories, 
  onUpdateCategories, 
  isBankConnected, 
  onToggleBank,
  cardInfo,
  onUpdateCardInfo,
  onSimulateTransaction 
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
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setStream(s);
      if (videoRef.current) videoRef.current.srcObject = s;
    } catch (err) {
      console.error("Camera access denied", err);
      alert("Нема пристап до камерата.");
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
        
        // Креираме објект за картичката
        const newInfo: CardInfo = {
          number: cardNumber || '**** **** **** 8824',
          expiry: expiry || '12/28',
          bankName: 'Стопанска Банка АД Скопје',
          type: 'VISA',
          skinUrl: dataUrl
        };
        
        onUpdateCardInfo(newInfo);
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
      setCardNumber('');
      setExpiry('');
      setCvv('');
    }, 1500);
  };

  const formatCardNumber = (val: string) => {
    const v = val.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    return parts.length ? parts.join(' ') : v;
  };

  const addSub = () => {
    if (!newSub) return;
    const updated = { ...categories };
    updated[selectedMain] = [...updated[selectedMain], newSub];
    onUpdateCategories(updated);
    setNewSub('');
  };

  const removeSub = (main: MainCategory, sub: string) => {
    const updated = { ...categories };
    updated[main] = updated[main].filter(s => s !== sub);
    onUpdateCategories(updated);
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      <header className="text-center">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Конфигурација ⛭</h2>
        <p className="text-slate-500 font-medium italic mt-2">Менаџирај ги твоите картички и категории.</p>
      </header>

      {/* Банкарска поврзаност */}
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
              <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-[2rem] blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
              
              <div className="relative bg-slate-900 p-8 rounded-[2rem] text-white flex flex-col justify-between h-52 shadow-xl overflow-hidden">
                {/* Background Skin */}
                {cardInfo.skinUrl ? (
                  <div className="absolute inset-0 z-0">
                    <img src={cardInfo.skinUrl} className="w-full h-full object-cover opacity-60 mix-blend-overlay scale-110" alt="Card Design" />
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-900/40 via-transparent to-slate-900/80"></div>
                  </div>
                ) : (
                  <div className="absolute top-0 right-0 p-8 opacity-10 text-7xl font-black italic z-0">{cardInfo.type}</div>
                )}

                <div className="relative z-10 flex justify-between items-start">
                  <div className="w-14 h-11 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-lg shadow-inner border border-white/20"></div>
                  <div className="flex flex-col items-end">
                    <p className="text-[10px] font-black tracking-[0.3em] opacity-80 uppercase">{cardInfo.type}</p>
                    <div className="w-8 h-8 mt-2 opacity-60">((•))</div>
                  </div>
                </div>

                <div className="relative z-10 space-y-1">
                  <p className="text-2xl font-mono tracking-[0.2em] mb-1 drop-shadow-md">{cardInfo.number.replace(/\d{4} \d{4} \d{4}/, '**** **** ****')}</p>
                  <div className="flex justify-between items-end">
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/70">{cardInfo.bankName}</p>
                    <p className="text-xs font-mono drop-shadow-md">{cardInfo.expiry}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button 
                onClick={onSimulateTransaction}
                className="p-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition shadow-lg flex items-center justify-center gap-2"
              >
                <span>⚡</span> Симулирај ново плаќање
              </button>
              <button 
                onClick={() => onToggleBank(false)}
                className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-400 font-black text-xs uppercase tracking-widest hover:bg-red-50 hover:text-red-500 hover:border-red-100 transition"
              >
                Исклучи ја картичката
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {linkingMethod === 'none' && (
              <div className="text-center py-10 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200 space-y-8">
                <div className="flex justify-center">
                   <div className="w-20 h-20 bg-indigo-100 rounded-[2rem] flex items-center justify-center text-indigo-600 text-4xl shadow-inner">
                      💳
                   </div>
                </div>
                <div>
                  <p className="font-black text-slate-800 text-lg">Поврзи се за автоматско следење</p>
                  <p className="text-sm text-slate-500 max-w-sm mx-auto mt-2 leading-relaxed">
                    Твоите трошоци ќе се појавуваат во апликацијата во истиот момент кога ќе ја користиш картичката.
                  </p>
                </div>
                
                <div className="grid grid-cols-1 gap-3 max-w-sm mx-auto w-full px-4">
                  {[
                    { id: 'nfc', label: 'Поврзи преку NFC', sub: 'БРЗО И БЕЗБЕДНО', icon: '((•))' },
                    { id: 'scan', label: 'Скенирај картичка', sub: 'ПРЕКУ ТВОЈАТА КАМЕРА', icon: '📸' },
                    { id: 'manual', label: 'Внеси рачно', sub: 'КЛАСИЧЕН НАЧИН', icon: '✎' }
                  ].map((method) => (
                    <button 
                      key={method.id}
                      onClick={() => setLinkingMethod(method.id as LinkingMethod)}
                      className="w-full p-4 flex items-center gap-4 bg-white border border-slate-100 rounded-3xl hover:border-indigo-200 hover:shadow-md transition-all group"
                    >
                      <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 text-xl group-hover:bg-indigo-600 group-hover:text-white transition-colors flex-shrink-0">
                        {method.icon}
                      </div>
                      <div className="text-left">
                        <p className="font-black text-slate-900 text-sm tracking-tight">{method.label}</p>
                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.2em] mt-0.5">{method.sub}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Skin Capture / Сликање на дизајн */}
            {linkingMethod === 'skin' && (
              <div className="animate-fadeIn space-y-6 text-center">
                <div className="space-y-2 mb-6">
                  <h4 className="font-black text-xl text-slate-900">Пренеси го дизајнот</h4>
                  <p className="text-slate-500 text-xs">Поставете ја предната страна на картичката за да го пренесеме ликот во апликацијата.</p>
                </div>
                <div className="relative w-full aspect-[1.6/1] bg-slate-900 rounded-3xl overflow-hidden border-4 border-indigo-600 shadow-2xl">
                  <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-[85%] h-[75%] border-2 border-dashed border-white/50 rounded-2xl"></div>
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={captureSkin}
                    className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 transition shadow-lg uppercase tracking-widest text-xs"
                  >
                    Зачувај го дизајнот
                  </button>
                  <button onClick={() => setLinkingMethod('none')} className="text-[10px] font-black uppercase text-slate-400">Прескокни</button>
                </div>
              </div>
            )}

            {/* NFC Симулатор */}
            {linkingMethod === 'nfc' && (
              <div className="text-center py-12 space-y-8 animate-fadeIn">
                <div className="relative w-32 h-32 mx-auto">
                  <div className="absolute inset-0 bg-indigo-100 rounded-full animate-ping opacity-25"></div>
                  <div className="relative bg-indigo-600 w-32 h-32 rounded-full flex items-center justify-center text-5xl shadow-2xl">
                    📳
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="font-black text-xl text-slate-900">Допри ја картичката</h4>
                  <p className="text-slate-500 text-sm">Допри ја задната страна на твојата картичка до NFC чипот на телефонот.</p>
                </div>
                <button 
                  onClick={() => setLinkingMethod('skin')}
                  disabled={isProcessing}
                  className="px-10 py-4 bg-slate-900 text-white font-black rounded-2xl hover:bg-slate-800 transition uppercase tracking-widest text-xs"
                >
                  {isProcessing ? 'Се чита...' : 'Симулирај допир'}
                </button>
                <button onClick={() => setLinkingMethod('none')} className="block mx-auto text-[10px] font-black uppercase text-slate-400">Откажи</button>
              </div>
            )}

            {/* Camera Scan / Скенирање */}
            {linkingMethod === 'scan' && (
              <div className="animate-fadeIn space-y-6">
                <div className="relative w-full aspect-[1.6/1] bg-slate-900 rounded-3xl overflow-hidden border-4 border-indigo-600 shadow-2xl">
                  <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                  <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none">
                    <div className="w-full h-full border-2 border-indigo-400/50 rounded-lg relative">
                      <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-lg"></div>
                      <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-lg"></div>
                      <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-lg"></div>
                      <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-lg"></div>
                    </div>
                  </div>
                  <div className="absolute bottom-4 left-0 right-0 text-center">
                    <span className="bg-white/90 text-slate-900 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest">Држете ја картичката во рамката</span>
                  </div>
                </div>
                <div className="flex gap-4">
                  <button 
                    onClick={() => setLinkingMethod('skin')}
                    disabled={isProcessing}
                    className="flex-grow py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 transition shadow-lg uppercase tracking-widest text-xs"
                  >
                    {isProcessing ? 'Се обработува...' : 'Скенирај сега'}
                  </button>
                  <button onClick={() => setLinkingMethod('none')} className="px-8 py-4 bg-slate-100 text-slate-600 font-black rounded-2xl uppercase tracking-widest text-xs">Откажи</button>
                </div>
              </div>
            )}

            {/* Рачно внесување */}
            {linkingMethod === 'manual' && (
              <div className="animate-fadeIn space-y-6">
                <div className="grid grid-cols-1 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Број на картичка</label>
                    <input 
                      type="text" 
                      placeholder="XXXX XXXX XXXX XXXX" 
                      className="p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-mono text-lg tracking-widest"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                      maxLength={19}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Истекува на (MM/YY)</label>
                      <input 
                        type="text" 
                        placeholder="MM / YY" 
                        className="p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-mono"
                        value={expiry}
                        onChange={(e) => setExpiry(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-1">CVV / CVC</label>
                      <input 
                        type="password" 
                        placeholder="***" 
                        className="p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-mono"
                        value={cvv}
                        onChange={(e) => setCvv(e.target.value)}
                        maxLength={3}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex gap-4">
                  <button 
                    onClick={() => setLinkingMethod('skin')}
                    disabled={isProcessing || cardNumber.length < 19}
                    className="flex-grow py-4 bg-slate-900 text-white font-black rounded-2xl hover:bg-slate-800 transition shadow-lg uppercase tracking-widest text-xs disabled:opacity-30"
                  >
                    Потврди и продолжи
                  </button>
                  <button onClick={() => setLinkingMethod('none')} className="px-8 py-4 bg-slate-100 text-slate-600 font-black rounded-2xl uppercase tracking-widest text-xs">Откажи</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Управување со категории */}
      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
        <h3 className="font-bold text-xl mb-6 text-slate-800 text-center">Управување со поткатегории</h3>
        
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <select 
            className="p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-slate-900 font-bold appearance-none cursor-pointer"
            value={selectedMain} onChange={(e) => setSelectedMain(e.target.value as MainCategory)}
          >
            {Object.values(MainCategory).map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <input 
            type="text" placeholder="Име на поткатегорија" 
            className="flex-grow p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-slate-900 font-medium"
            value={newSub} onChange={(e) => setNewSub(e.target.value)}
          />
          <button 
            onClick={addSub}
            className="px-8 py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 transition shadow-lg shadow-indigo-100"
          >
            Додади
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {(Object.entries(categories) as [MainCategory, string[]][]).map(([main, subs]) => (
            <div key={main} className="space-y-3">
              <h4 className="font-black text-[10px] uppercase tracking-widest text-indigo-400">{main}</h4>
              <div className="flex flex-wrap gap-2">
                {subs.map(sub => (
                  <div key={sub} className="group flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl hover:border-red-200 hover:bg-red-50 transition-colors">
                    <div className="flex-shrink-0 group-hover:scale-110 transition-transform">
                      {getTransactionIcon(sub, main, "w-4 h-4")}
                    </div>
                    <span className="text-sm font-bold text-slate-700 group-hover:text-red-600">{sub}</span>
                    <button onClick={() => removeSub(main, sub)} className="text-slate-300 hover:text-red-600 font-black ml-1">×</button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SettingsView;
