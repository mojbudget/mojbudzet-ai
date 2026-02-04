
import { GoogleGenAI, Type } from "@google/genai";
import { MainCategory, SubCategoryMap, AICategorizationResponse, AISuggestedBudget, FinancialGoal } from "../types";

// Always use the process.env.API_KEY directly as per guidelines
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

export const categorizeTransactionsBatch = async (
  items: { id: string; description: string }[], 
  customCategories?: SubCategoryMap
): Promise<AICategorizationResponse[]> => {
  const schemaStr = customCategories ? JSON.stringify(customCategories) : "Use common Sense";
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [{
          text: `Ти си финансиски експерт. Категоризирај ги овие трансакции: ${JSON.stringify(items)}. 
          Користи ги овие категории: ${schemaStr}.
          
          ВАЖНИ ПРАВИЛА:
          1. Оброци купени надвор (Пица, Бургер, Сендвич, Кафе, Достава, Ресторан) МОРА да одат во "Желби" под "Ресторани", освен ако описот не е име на супермаркет (Тинекс, КАМ).
          2. Ако описот е име на супермаркет, оди во "Потреби" -> "Храна и пијалоци".
          3. Плаќања за услуги како Netflix, Spotify, iCloud одат во "Желби" -> "Забава" или "Шопинг".
          
          Врати само чист JSON.`
        }]
      },
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
    return items.map(item => ({
      transactionId: item.id,
      mainCategory: MainCategory.NEEDS,
      subCategory: 'Останато'
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
          {
            text: `Ти си експерт за македонски сметки. Најди трговец, вкупен износ и категорија од: ${JSON.stringify(customCategories)}. 
            ПРАВИЛО: Храна надвор (Pizza, Burger) -> Желби/Ресторани. Врати чист JSON.`
          }
        ]
      },
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
      contents: {
        parts: [{
          text: `Врз основа на месечен приход од ${income} денари, предложи 50/30/20 распределба: Потреби (50%), Желби (30%), Инвестиции/Штедење (20%). Врати чист JSON.`
        }]
      },
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
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [{
          text: `Анализирај и дај краток македонски совет: ${JSON.stringify({ transactions, budgets })}`
        }]
      },
      config: { 
        systemInstruction: "Ти си македонски финансиски советник.", 
        temperature: 0.7 
      }
    });
    return response.text || "Нема совет.";
  } catch (error) {
    return "Грешка.";
  }
};

export const getGoalStrategy = async (goal: FinancialGoal, monthlyIncome: number, monthlyExpenses: number): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: {
        parts: [{
          text: `Стратегија за штедење: ${JSON.stringify({goal, monthlyIncome, monthlyExpenses})}`
        }]
      },
      config: { 
        systemInstruction: "Биди прецизен.", 
        temperature: 0.8 
      }
    });
    return response.text || "Грешка.";
  } catch (error) {
    return "Грешка.";
  }
};
