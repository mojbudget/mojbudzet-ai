
import { Transaction, MainCategory, Budget, SubCategoryMap } from './types';

export const INITIAL_TRANSACTIONS: Transaction[] = [];

export const INITIAL_BUDGETS: Budget[] = [
  { mainCategory: MainCategory.NEEDS, limit: 0, spent: 0 },
  { mainCategory: MainCategory.WANTS, limit: 0, spent: 0 },
  { mainCategory: MainCategory.EMERGENCIES, limit: 0, spent: 0 },
  { mainCategory: MainCategory.INVESTMENTS, limit: 0, spent: 0 }
];

export const INITIAL_CATEGORIES: SubCategoryMap = {
  [MainCategory.NEEDS]: ['Храна и пијалоци', 'Кирија', 'Сметки', 'Транспорт', 'Здравје'],
  [MainCategory.WANTS]: ['Ресторани', 'Забава', 'Шопинг', 'Хоби'],
  [MainCategory.EMERGENCIES]: ['Непредвидени трошоци', 'Поправки'],
  [MainCategory.INVESTMENTS]: ['Акции', 'Крипто', 'Штедење'],
  [MainCategory.INCOME]: ['Плата', 'Бонус', 'Фриленс']
};
