
import { GoogleGenAI, Type } from "@google/genai";
import { MainCategory, SubCategoryMap, AICategorizationResponse, AISuggestedBudget, FinancialGoal } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_INSTRUCTION = `Ти си врвен македонски финансиски експерт за детална анализа на македонски фискални сметки.

Твојата примарна задача е да извлечеш податоци со максимална точност од сликата.

СТРОГИ ПРАВИЛА ЗА ПРЕПОЗНАВАЊЕ:
1. ИМЕ НА ПРОДАВАЧ: Секогаш земај го името од најгорниот дел (заглавието) на сметката. 
2. РАЗЛИКУВАЊЕ БРЕНДОВИ: Прави јасна разлика меѓу KIT-GO (Кит-Го), КАМ (KAM), Жито, Тинекс, Веро, Кипер, Стокомак.
3. СУМА: Барај го зборот "ВКУПНО" или "ЗА ПЛАЌАЊЕ" и извлечи ја бројката до него.
4. КАТЕГОРИЗАЦИЈА: Ако е маркет, оди во "Потреби". Ако е ресторан/кафуле, оди во "Желби".

ВАЖНО: Ако некој податок не е јасен, дај најдобра претпоставка наместо да враќаш грешка.
ФОРМАТ: Исклучиво валиден JSON. 
ЈАЗИК: Македонски.`;

export const analyzeReceiptImage = async (base64Image: string, customCategories: SubCategoryMap): Promise<{description: string, amount: number, mainCategory: MainCategory, subCategory: string} | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: base64Image } },
          { text: `Прочитај го името на продавницата и вкупната сума од оваа сметка. Категоризирај ја според: ${JSON.stringify(customCategories)}.` }
        ]
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING },
            amount: { type: Type.NUMBER },
            mainCategory: { type: Type.STRING },
            subCategory: { type: Type.STRING },
          },
          required: ["description", "amount", "mainCategory", "subCategory"]
        }
      }
    });

    const text = response.text?.trim();
    if (!text) return null;
    return JSON.parse(text);
  } catch (error) {
    console.error("Receipt Analysis Error:", error);
    // Наместо фрлање грешка, враќаме null за UI-то да може да реагира соодветно
    return null;
  }
};

export const categorizeTransactionsBatch = async (
  items: { id: string; description: string }[], 
  customCategories?: SubCategoryMap
): Promise<AICategorizationResponse[]> => {
  const categoriesList = customCategories ? JSON.stringify(customCategories) : "Стандардна шема";
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { 
        parts: [{ text: `Категоризирај: ${JSON.stringify(items)}. Поткатегории: ${categoriesList}` }] 
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              transactionId: { type: Type.STRING },
              mainCategory: { type: Type.STRING },
              subCategory: { type: Type.STRING },
            },
            required: ["transactionId", "mainCategory", "subCategory"],
          },
        },
      },
    });

    return JSON.parse(response.text || "[]");
  } catch (error) {
    return items.map(item => ({
      transactionId: item.id,
      mainCategory: MainCategory.NEEDS,
      subCategory: 'Друго'
    }));
  }
};

export const suggestBudget = async (income: number): Promise<AISuggestedBudget[]> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: [{ text: `Буџет за ${income} ден.` }] },
      config: {
        systemInstruction: "Врати JSON низа: Потреби, Желби, Итни случаи, Инвестиции.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              mainCategory: { type: Type.STRING },
              amount: { type: Type.NUMBER },
              percentage: { type: Type.NUMBER },
              reasoning: { type: Type.STRING },
            },
            required: ["mainCategory", "amount", "percentage", "reasoning"],
          },
        },
      },
    });
    return JSON.parse(response.text || "[]");
  } catch (error) {
    return [];
  }
};

export const getFinancialAdvice = async (transactions: any[], budgets: any[]): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: [{ text: `Совет за: ${JSON.stringify(transactions.slice(0, 20))}` }] },
      config: { 
        systemInstruction: "Краток, мотивирачки совет на македонски.", 
        temperature: 0.7 
      }
    });
    return response.text || "Продолжи со паметното штедење!";
  } catch (error) {
    return "Следи ги твоите трошоци редовно.";
  }
};

export const getGoalStrategy = async (goal: FinancialGoal, monthlyIncome: number, monthlyExpenses: number): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: { parts: [{ text: `План: ${JSON.stringify(goal)}` }] },
      config: { systemInstruction: "3 кратки чекори на македонски." }
    });
    return response.text || "Штеди фиксен износ секој месец.";
  } catch (error) {
    return "Грешка при генерирање стратегија.";
  }
};
