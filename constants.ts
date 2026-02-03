
import { Transaction, MainCategory, Budget, SubCategoryMap } from './types';

export const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: '1',
    date: new Date().toISOString(),
    description: 'Пазарење во Тинекс',
    amount: -1250,
    mainCategory: MainCategory.NEEDS,
    subCategory: 'Храна и пијалоци',
    type: 'expense'
  },
  {
    id: '2',
    date: new Date(Date.now() - 86400000).toISOString(),
    description: 'Плата за месец Февруари',
    amount: 55000,
    mainCategory: MainCategory.INCOME,
    subCategory: 'Плата',
    type: 'income'
  },
  {
    id: '3',
    date: new Date(Date.now() - 172800000).toISOString(),
    description: 'Сметка за струја ЕВН',
    amount: -4200,
    mainCategory: MainCategory.NEEDS,
    subCategory: 'Сметка струја',
    type: 'expense'
  }
];

export const INITIAL_BUDGETS: Budget[] = [
  { mainCategory: MainCategory.NEEDS, limit: 25000, spent: 5450 },
  { mainCategory: MainCategory.WANTS, limit: 10000, spent: 0 },
  { mainCategory: MainCategory.EMERGENCIES, limit: 5000, spent: 0 },
  { mainCategory: MainCategory.INVESTMENTS, limit: 5000, spent: 0 }
];

// Fix: Added missing initial categories for the application
export const INITIAL_CATEGORIES: SubCategoryMap = {
  [MainCategory.NEEDS]: ['Храна и пијалоци', 'Кирија', 'Сметки', 'Транспорт', 'Здравје'],
  [MainCategory.WANTS]: ['Ресторани', 'Забава', 'Шопинг', 'Хоби'],
  [MainCategory.EMERGENCIES]: ['Непредвидени трошоци', 'Поправки'],
  [MainCategory.INVESTMENTS]: ['Акции', 'Крипто', 'Штедење'],
  [MainCategory.INCOME]: ['Плата', 'Бонус', 'Фриленс']
};
