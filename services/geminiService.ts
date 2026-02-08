
import { GoogleGenAI, Type } from "@google/genai";
import { MainCategory, SubCategoryMap, AICategorizationResponse, AISuggestedBudget, FinancialGoal } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_INSTRUCTION = `Ти си македонски финансиски експерт. Твоја задача е исклучиво да ги категоризираш трошоците врз основа на податоци добиени од QR код или слика од македонска фискална сметка.
Ако податоците се MojDDV линк (со параметри како am, dt, и сл.), категоризирај го трошокот и извлечи ја точната сума од параметрите.
Врати исклучиво JSON.`;

/**
 * Анализа на текстуални податоци добиени директно од QR код
 */
export const analyzeQrData = async (qrString: string, customCategories: SubCategoryMap): Promise<{description: string, amount: number, mainCategory: MainCategory, subCategory: string} | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [{ text: `Врз основа на овој QR код: "${qrString}", одреди ја категоријата и извлечи го износот (amount) од линкот. Користи ги овие достапни поткатегории: ${JSON.stringify(customCategories)}.` }]
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING, description: "Краток опис (пр. Маркет, Ресторан)" },
            amount: { type: Type.NUMBER, description: "Вкупниот износ од сметката" },
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
        parts: [{ text: `Категоризирај: ${JSON.stringify(items)}.` }] 
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
    return items.map(item => ({ transactionId: item.id, mainCategory: MainCategory.NEEDS, subCategory: 'Друго' }));
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
  } catch (error) { return []; }
};

export const getFinancialAdvice = async (transactions: any[], budgets: any[]): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: [{ text: `Совет на македонски.` }] },
      config: { systemInstruction: "Биди краток и мотивирачки.", temperature: 0.7 }
    });
    return response.text || "Продолжи со паметното штедење!";
  } catch (error) { return "Следи ги твоите трошоци редовно."; }
};

export const getGoalStrategy = async (goal: FinancialGoal, monthlyIncome: number, monthlyExpenses: number): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: { parts: [{ text: `План на македонски.` }] },
      config: { systemInstruction: "3 кратки чекори." }
    });
    return response.text || "Штеди фиксен износ секој месец.";
  } catch (error) { return "Грешка при генерирање стратегија."; }
};
