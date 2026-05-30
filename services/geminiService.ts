import { MainCategory, SubCategoryMap, AICategorizationResponse, AISuggestedBudget, FinancialGoal } from "../types";

/**
 * Анализа на текстуални податоци добиени директно од QR код
 */
export const analyzeQrData = async (
  qrString: string, 
  customCategories: SubCategoryMap
): Promise<{description: string, amount: number, mainCategory: MainCategory, subCategory: string} | null> => {
  try {
    const response = await fetch("/api/gemini/analyzeQrData", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qrString, customCategories })
    });
    if (!response.ok) throw new Error("HTTP error " + response.status);
    return await response.json();
  } catch (error) {
    console.error("QR Analysis Error:", error);
    return null;
  }
};

export const analyzeReceiptImage = async (
  base64Image: string, 
  customCategories: SubCategoryMap
): Promise<{description: string, amount: number, mainCategory: MainCategory, subCategory: string} | null> => {
  try {
    const response = await fetch("/api/gemini/analyzeReceiptImage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ base64Image, customCategories })
    });
    if (!response.ok) throw new Error("HTTP error " + response.status);
    return await response.json();
  } catch (error) {
    console.error("Visual Receipt Analysis Error:", error);
    return null;
  }
};

export const categorizeTransactionsBatch = async (
  items: { id: string; description: string }[], 
  customCategories?: SubCategoryMap
): Promise<AICategorizationResponse[]> => {
  try {
    const response = await fetch("/api/gemini/categorizeTransactionsBatch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, customCategories })
    });
    if (!response.ok) throw new Error("HTTP error " + response.status);
    return await response.json();
  } catch (error) {
    console.error("Categorize Batch Error:", error);
    return items.map(item => ({ transactionId: item.id, mainCategory: MainCategory.NEEDS, subCategory: 'Друго' }));
  }
};

export const suggestBudget = async (income: number): Promise<AISuggestedBudget[]> => {
  try {
    const response = await fetch("/api/gemini/suggestBudget", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ income })
    });
    if (!response.ok) throw new Error("HTTP error " + response.status);
    return await response.json();
  } catch (error) {
    console.error("Suggest Budget Error:", error);
    return [];
  }
};

export const getFinancialAdvice = async (transactions: any[], budgets: any[]): Promise<string> => {
  try {
    const response = await fetch("/api/gemini/getFinancialAdvice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactions, budgets })
    });
    if (!response.ok) throw new Error("HTTP error " + response.status);
    const data = await response.json();
    return data.advice || "Продолжи со паметното штедење!";
  } catch (error) {
    console.error("Financial Advice Error:", error);
    return "Следи ги твоите трошоци редовно.";
  }
};

export const getGoalStrategy = async (
  goal: FinancialGoal, 
  monthlyIncome: number, 
  monthlyExpenses: number
): Promise<string> => {
  try {
    const response = await fetch("/api/gemini/getGoalStrategy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal, monthlyIncome, monthlyExpenses })
    });
    if (!response.ok) throw new Error("HTTP error " + response.status);
    const data = await response.json();
    return data.strategy || "Штеди фиксен износ секој месец.";
  } catch (error) {
    console.error("Goal Strategy Error:", error);
    return "Грешка при генерирање стратегија.";
  }
};
