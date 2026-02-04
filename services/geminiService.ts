
import { GoogleGenAI, Type } from "@google/genai";
import { MainCategory, SubCategoryMap, AICategorizationResponse, AISuggestedBudget, FinancialGoal } from "../types";

// Директно користење на клучот според упатствата
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const categorizeTransactionsBatch = async (
  items: { id: string; description: string }[], 
  customCategories?: SubCategoryMap
): Promise<AICategorizationResponse[]> => {
  const schemaStr = customCategories ? JSON.stringify(customCategories) : "Use common sense financial grouping";
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Ти си македонски финансиски експерт. Категоризирај ги следните трансакции: ${JSON.stringify(items)}. 
      
      ЛИСТА НА ДОЗВОЛЕНИ КАТЕГОРИИ:
      ${schemaStr}
      
      СТРОГИ ПРАВИЛА:
      1. Сѐ што е купено во ресторан, пицерија, кафе бар (пр: Пица, Бургер, Кафе, Достава на храна) МОРА да биде во "Желби" -> "Ресторани".
      2. Сѐ што е купено во супермаркет (пр: Тинекс, КАМ, Веро, Рамстор) ОДИ во "Потреби" -> "Храна и пијалоци".
      3. Плаќања за гориво или автобус одат во "Потреби" -> "Транспорт".
      
      Врати го одговорот исклучиво како JSON низа од објекти со 'transactionId', 'mainCategory' и 'subCategory'.`,
      config: {
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
    console.error("Error in batch categorization:", error);
    // Враќање на почетната состојба наместо 'Останато' за да не се изгуби контекстот при грешка
    return items.map(item => ({
      transactionId: item.id,
      mainCategory: MainCategory.NEEDS,
      subCategory: 'Проверка...'
    }));
  }
};

export const analyzeReceiptImage = async (base64Image: string, customCategories: SubCategoryMap): Promise<{description: string, amount: number, mainCategory: MainCategory, subCategory: string}> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        { inlineData: { mimeType: "image/jpeg", data: base64Image } },
        { text: `Анализирај ја оваа македонска фискална сметка. Извлечи: трговец (description), вкупен износ (amount) и категоризирај според: ${JSON.stringify(customCategories)}. Врати само JSON.` }
      ],
      config: {
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
      contents: `Предложи 50/30/20 буџет за приход од ${income} денари. Врати само JSON.`,
      config: {
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
  if (transactions.length === 0) return "Внеси ги твоите први трансакции за да добиеш совет.";
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Како македонски финансиски советник, дај еден краток и корисен совет за овие податоци: ${JSON.stringify({ transactions, budgets })}`,
      config: { 
        systemInstruction: "Биди концизен, мотивирачки и зборувај на македонски јазик.", 
        temperature: 0.7 
      }
    });
    return response.text || "Продолжи со паметното менаџирање на буџетот!";
  } catch (error) {
    console.error("Advice error:", error);
    return "Моментално не можам да генерирам совет. Пробај подоцна.";
  }
};

export const getGoalStrategy = async (goal: FinancialGoal, monthlyIncome: number, monthlyExpenses: number): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Направи конкретна стратегија за штедење за целта: ${JSON.stringify(goal)}. Приход: ${monthlyIncome}, Трошоци: ${monthlyExpenses}.`,
      config: { 
        systemInstruction: "Биди прецизен и дај реални чекори на македонски јазик.", 
        temperature: 0.8 
      }
    });
    return response.text || "Постави помал месечен лимит за да заштедиш побрзо.";
  } catch (error) {
    return "Грешка при генерирање на стратегија.";
  }
};
