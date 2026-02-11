
import { GoogleGenAI, Type } from "@google/genai";
import { MainCategory, SubCategoryMap, AICategorizationResponse, AISuggestedBudget, FinancialGoal } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_INSTRUCTION = `Ти си македонски финансиски експерт за анализа на фискални сметки. 
Твоја задача е да извлечеш податоци од QR код кој најчесто е MojDDV линк.

ПРАВИЛА ЗА ИЗВЛЕКУВАЊЕ:
1. Ако линкот содржи параметар 'am=', таа бројка е ВКУПНАТА СУМА (износот) на сметката. Извлечи ја точно таа бројка.
2. Ако линкот содржи 'dt=', тоа е датумот.
3. Врз основа на останатите параметри или доменот во линкот, одреди го продавачот (description).
4. Категоризирај го трошокот во една од понудените категории.

Врати исклучиво JSON објект.`;

/**
 * Анализа на текстуални податоци добиени директно од QR код
 */
export const analyzeQrData = async (qrString: string, customCategories: SubCategoryMap): Promise<{description: string, amount: number, mainCategory: MainCategory, subCategory: string} | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [{ text: `Анализирај го овој македонски QR код: "${qrString}". 
        ПРОНАЈДИ ГО ИЗНОСОТ (параметарот am) И КАТЕГОРИЗИРАЈ ГО.
        Достапни поткатегории: ${JSON.stringify(customCategories)}.` }]
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING, description: "Име на маркет/продавница" },
            amount: { type: Type.NUMBER, description: "Точниот износ извлечен од 'am' параметарот" },
            mainCategory: { type: Type.STRING },
            subCategory: { type: Type.STRING },
          },
          required: ["description", "amount", "mainCategory", "subCategory"]
        }
      }
    });

    const text = response.text?.trim();
    if (!text) return null;
    
    const result = JSON.parse(text);
    // Дополнителна заштита: Ако сумата е нереално голема или мала поради грешка во AI, 
    // овде може да се додаде рачна проверка на стрингот ако е потребно.
    return result;
  } catch (error) {
    console.error("QR Analysis Error:", error);
    return null;
  }
};

export const analyzeReceiptImage = async (base64Image: string, customCategories: SubCategoryMap): Promise<{description: string, amount: number, mainCategory: MainCategory, subCategory: string} | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: base64Image } },
          { text: `Анализирај ја оваа фискална сметка. Извлечи го името на продавачот (description), вкупниот износ (amount) и категоризирај го трошокот користејќи ги овие достапни поткатегории: ${JSON.stringify(customCategories)}.` }
        ]
      },
      config: {
        systemInstruction: "Ти си македонски финансиски асистент. Врати исклучиво JSON објект.",
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
    return text ? JSON.parse(text) : null;
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
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { 
        parts: [{ text: `Категоризирај ги овие трошоци: ${JSON.stringify(items)}. Користи ги овие категории ако е можно: ${JSON.stringify(customCategories)}.` }] 
      },
      config: {
        systemInstruction: "Врати исклучиво JSON низа со категории.",
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
    return items.map(item => ({ transactionId: item.id, mainCategory: MainCategory.NEEDS, subCategory: 'Друго' }));
  }
};

export const suggestBudget = async (income: number): Promise<AISuggestedBudget[]> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: [{ text: `Предложи буџет за месечен приход од ${income} денари.` }] },
      config: {
        systemInstruction: "Врати JSON низа со предлог распределба за категориите: Потреби, Желби, Итни случаи, Инвестиции.",
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
  } catch (error) { return []; }
};

export const getFinancialAdvice = async (transactions: any[], budgets: any[]): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: [{ text: `Врз основа на овие трансакции: ${JSON.stringify(transactions.slice(0, 10))}, дај еден краток финансиски совет на македонски.` }] },
      config: { systemInstruction: "Биди краток, мотивирачки и користи македонски јазик.", temperature: 0.7 }
    });
    return response.text || "Продолжи со паметното штедење!";
  } catch (error) { return "Следи ги твоите трошоци редовно."; }
};

export const getGoalStrategy = async (goal: FinancialGoal, monthlyIncome: number, monthlyExpenses: number): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: { parts: [{ text: `Направи стратегија за штедење за целта: ${goal.title}, со буџет од ${monthlyIncome} и трошоци ${monthlyExpenses}.` }] },
      config: { systemInstruction: "Дај 3 кратки и конкретни чекори на македонски." }
    });
    return response.text || "Штеди фиксен износ секој месец.";
  } catch (error) { return "Грешка при генерирање стратегија."; }
};
