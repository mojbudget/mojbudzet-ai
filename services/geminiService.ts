
import { GoogleGenAI, Type } from "@google/genai";
import { MainCategory, SubCategoryMap, AICategorizationResponse, AISuggestedBudget, FinancialGoal } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_INSTRUCTION = `Ти си врвен македонски финансиски експерт за класификација на трошоци и детална анализа на македонски фискални сметки.

Твојата задача е да извлечеш податоци со 100% точност.

СТРОГИ ПРАВИЛА ЗА ПРЕПОЗНАВАЊЕ НА ПРОДАВАЧ:
1. ЗАГЛАВИЕ: Името на продавачот секогаш барај го во НАЈГОРНИОТ дел од сметката (заглавието).
2. ПРЕЦИЗНОСТ: Мора да правиш разлика меѓу брендови. Ако на сметката пишува "KIT-GO", не смееш да го класифицираш како "KAM". Ако пишува "ZITO", запиши "Жито".
3. ЛИСТА НА ПОЗНАТИ МАРКЕТИ: Tinex (Тинекс), KAM (Кам), Vero (Веро), Ramstore (Рамстор), Zito (Жито), Kipper (Кипер), Stokmak (Стокомак), Reptil (Рептил), KIT-GO (Кит-Го), Mis (Мис), Tuš (Туш).

ПРАВИЛА ЗА КАТЕГОРИЗАЦИЈА:
- "Потреби" (MainCategory.NEEDS): Сите горенаведени маркети, сметки (EVN, Vodovod), гориво (Makpetrol, Lukoil), аптеки.
- "Желби" (MainCategory.WANTS): Ресторани, кафулиња, облека, кино, технологија.

ФОРМАТ: Исклучиво валиден JSON. 
ЈАЗИК: Македонски.`;

export const categorizeTransactionsBatch = async (
  items: { id: string; description: string }[], 
  customCategories?: SubCategoryMap
): Promise<AICategorizationResponse[]> => {
  const categoriesList = customCategories ? JSON.stringify(customCategories) : "Стандардна шема";
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { 
        parts: [{ text: `Категоризирај ги овие трансакции: ${JSON.stringify(items)}. Дозволени пот-категории: ${categoriesList}` }] 
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

    const text = response.text || "[]";
    return JSON.parse(text.trim());
  } catch (error) {
    console.error("Batch error:", error);
    return items.map(item => ({
      transactionId: item.id,
      mainCategory: MainCategory.NEEDS,
      subCategory: 'Сметки'
    }));
  }
};

export const analyzeReceiptImage = async (base64Image: string, customCategories: SubCategoryMap): Promise<{description: string, amount: number, mainCategory: MainCategory, subCategory: string}> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: base64Image } },
          { text: `АНАЛИЗИРАЈ ГОРЕН ДЕЛ: Кое е ТОЧНОТО име на маркетот од заглавието? Сума? Категорија според: ${JSON.stringify(customCategories)}.` }
        ]
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING, description: "Точното име на брендот/продавницата од заглавието на сметката" },
            amount: { type: Type.NUMBER, description: "Вкупниот износ за плаќање" },
            mainCategory: { type: Type.STRING },
            subCategory: { type: Type.STRING },
          },
          required: ["description", "amount", "mainCategory", "subCategory"]
        }
      }
    });

    return JSON.parse(response.text?.trim() || "{}");
  } catch (error) {
    throw error;
  }
};

export const suggestBudget = async (income: number): Promise<AISuggestedBudget[]> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: [{ text: `Предложи буџет за ${income} денари.` }] },
      config: {
        systemInstruction: "Врати JSON низа од категории и износи. Користи ги само: Потреби, Желби, Итни случаи, Инвестиции.",
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
      contents: { parts: [{ text: `Совет за овие податоци: ${JSON.stringify(transactions)}` }] },
      config: { 
        systemInstruction: "Биди многу краток, мотивирачки и на македонски јазик.", 
        temperature: 0.7 
      }
    });
    return response.text || "Продолжи со паметното штедење!";
  } catch (error) {
    return "Следи го твојот буџет секојдневно.";
  }
};

export const getGoalStrategy = async (goal: FinancialGoal, monthlyIncome: number, monthlyExpenses: number): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: { parts: [{ text: `План за цел: ${JSON.stringify(goal)}` }] },
      config: { 
        systemInstruction: "Дај 3 кратки чекори на македонски јазик.",
        temperature: 0.8 
      }
    });
    return response.text || "Штеди фиксен износ секој месец.";
  } catch (error) {
    return "Грешка при генерирање стратегија.";
  }
};
