
export enum MainCategory {
  NEEDS = 'Потреби',
  WANTS = 'Желби',
  EMERGENCIES = 'Итни случаи',
  INVESTMENTS = 'Инвестиции',
  INCOME = 'Приходи'
}

export type SubCategoryMap = Record<MainCategory, string[]>;

export interface Member {
  id: string;
  name: string;
  avatarColor: string;
}

export interface CardInfo {
  number: string;
  expiry: string;
  bankName: string;
  type: 'VISA' | 'MASTERCARD' | 'MAESTRO';
  skinUrl?: string;
  color?: string;
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  mainCategory: MainCategory;
  subCategory: string;
  type: 'expense' | 'income';
  isCategorizing?: boolean;
  memberId?: string;
}

export interface Budget {
  mainCategory: MainCategory;
  limit: number;
  spent: number;
}

export interface Reminder {
  id: string;
  title: string;
  amount: number;
  dueDate: string;
  type: 'bill' | 'credit' | 'subscription' | 'vehicle';
  isPaid: boolean;
  notificationDaysBefore: number;
}

export interface FinancialGoal {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string;
  category: 'travel' | 'car' | 'home' | 'education' | 'other';
}

export interface AICategorizationResponse {
  transactionId: string;
  mainCategory: MainCategory;
  subCategory: string;
}

export interface AISuggestedBudget {
  mainCategory: MainCategory;
  amount: number;
  percentage: number;
  reasoning: string;
}
