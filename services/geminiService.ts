
import { GoogleGenAI, Type } from "@google/genai";
import { MainCategory, SubCategoryMap, AICategorizationResponse, AISuggestedBudget, FinancialGoal } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Клучна промена: СТРОГА ИНСТРУКЦИЈА ЗА СИСТЕМОТ
const SYSTEM_INSTRUCTION = `Ти си врвен македонски финансиски експерт за класификација на трошоци. 
Твојата единствена задача е да ги мапираш описите на трансакциите во правилни категории.

СТРОГИ ПРАВИЛА (БЕЗ ИСКЛУЧОЦИ):
1. КАТЕГОРИЈА "Желби" -> "Ресторани": Овде МОРА да одат:
   - Сите пицерии (Pizza, Jakomo, Domino, Hot Slice, Enriko).
   - Брза храна (7-ca, Sedmica, Burger King, KFC, Vili, Sendvic).
   - Кафулиња и барови (Kafic, Bar, Coffee, Lounge).
   - Достава на храна (Kliknijadi, Korpa, Food Delivery).
   ЗАБРАНЕТО Е овие да одат во "Останато" или "Храна и пијалоци" (Потреби).

2. КАТЕГОРИЈА "Потреби" -> "Храна и пијалоци": Овде одат САМО супермаркети:
   - Tinex, KAM, Vero, Ramstore, Zito, Kipper, Stokmak, Reptil.

3. КАТЕГОРИЈА "Потреби" -> "Транспорт":
   - Бензински (Makpetrol, Lukoil, Okta).
   - Taxi, JSP, Картичка за автобус.

4. ФОРМАТ: Враќај резултати исклучиво како валиден JSON. Користи ги имињата на категориите точно како што се дадени.
ЈАЗИК: Секогаш користи македонски јазик.`;

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
      mainCategory: MainCategory.WANTS,
      subCategory: 'Ресторани'
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
          { text: `Анализирај ја фискалната сметка и категоризирај според: ${JSON.stringify(customCategories)}. Биди строг за пица/ресторани!` }
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
        systemInstruction: "Врати JSON низа од категории и износи.",
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
