
import React from 'react';
import { IconDashboard, IconTransactions, IconBudget, IconGoals, IconReminders, IconSettings } from './Icons';

export type TabType = 'dashboard' | 'transactions' | 'budget' | 'reminders' | 'goals' | 'settings';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  isBankConnected: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab, isBankConnected }) => {
  const menuItems: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Преглед', icon: <IconDashboard /> },
    { id: 'transactions', label: 'Трансакции', icon: <IconTransactions /> },
    { id: 'budget', label: 'Буџетирање', icon: <IconBudget /> },
    { id: 'goals', label: 'Цели', icon: <IconGoals /> },
    { id: 'reminders', label: 'Потсетници', icon: <IconReminders /> },
    { id: 'settings', label: 'Подесувања', icon: <IconSettings /> },
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-white">
      <nav className="bg-slate-50 border-r border-slate-100 text-slate-900 w-full md:w-20 lg:w-24 flex-shrink-0 flex md:flex-col shadow-sm z-20">
        <div className="hidden md:flex p-6 justify-center">
          <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
            <IconBudget className="w-6 h-6" />
          </div>
        </div>
        
        <div className="flex-grow flex md:flex-col items-center justify-around md:justify-start overflow-x-auto md:overflow-x-hidden p-4 gap-4 no-scrollbar">
          {menuItems.map((item) => (
            <button 
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              title={item.label}
              className={`relative flex items-center justify-center w-12 h-12 md:w-14 md:h-14 rounded-2xl transition-all duration-300 ${
                activeTab === item.id 
                  ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200 scale-110' 
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
              }`}
            >
              {item.icon}
              {activeTab === item.id && (
                <div className="hidden md:block absolute -right-4 w-1 h-6 bg-indigo-600 rounded-full"></div>
              )}
            </button>
          ))}
        </div>

        <div className="hidden md:flex p-6 mt-auto justify-center">
          <div className={`w-3 h-3 rounded-full ${isBankConnected ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-slate-300'}`}></div>
        </div>
      </nav>

      <main className="flex-grow p-4 md:p-10 overflow-y-auto w-full">
        <div className="max-w-5xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
