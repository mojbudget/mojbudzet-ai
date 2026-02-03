
import { GoogleGenAI, Type } from "@google/genai";
import { MainCategory, SubCategoryMap, AICategorizationResponse, AISuggestedBudget, FinancialGoal } from "../types";

// Читање на API клучот од околината
const getApiKey = () => {
  try {
    return (process.env as any).API_KEY || "";
  } catch (e) {
    return "";
  }
};

const ai = new GoogleGenAI({ apiKey: getApiKey() });

export const categorizeTransactionsBatch = async (
  items: { id: string; description: string }[], 
  customCategories?: SubCategoryMap
): Promise<AICategorizationResponse[]> => {
  const schemaStr = customCategories ? JSON.stringify(customCategories) : "Use common Sense";
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Категоризирај ги следниве трансакции (одливи/приливи): ${JSON.stringify(items)}. 
      Користи ги овие категории: ${schemaStr}.
      За секоја трансакција (според нејзиното ID), врати соодветна mainCategory и subCategory. Врати само чист JSON.`,
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
      contents: [
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: base64Image
          }
        },
        {
          text: `Ти си експерт за анализа на МАКЕДОНСКИ фискални сметки. 
          На сликата има македонска фискална сметка која содржи текст и QR код на дното.
          
          ИНСТРУКЦИИ:
          1. Идентификувај го трговецот (пр. КАМ, ТИНЕКС, ВЕРО, МАКПЕТРОЛ, ЛУКОИЛ, СТОКОМАК, КИПЕР, ЗЕГИН).
          2. Најди го вкупниот износ за плаќање (обично стои до "ВКУПНО" или "TOTAL").
          3. Категоризирај го трошокот според овие понудени категории: ${JSON.stringify(customCategories)}.
          
          ЛОГИКА ЗА МАКЕДОНИЈА:
          - Маркети (KAM, Tinex, Vero, Stokomak, Kipper, Ramstore) -> NEEDS / Храна и пијалоци.
          - Аптеки (Zegin, Eurofarm) -> NEEDS / Здравје.
          - Бензински (Makpetrol, Lukoil, Okta) -> NEEDS / Транспорт.
          - Ресторани/Кафулиња (Пелистер, Distrikt, итн.) -> WANTS / Ресторани.

          Врати го резултатот како чист JSON објект.`
        }
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

    const result = JSON.parse(response.text?.trim() || "{}");
    return result;
  } catch (error) {
    console.error("Error analyzing receipt:", error);
    throw error;
  }
};

export const suggestBudget = async (income: number): Promise<AISuggestedBudget[]> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Врз основа на месечен приход од ${income} денари, предложи распределба на буџетот за одливи: Потреби, Желби, Итни случаи и Инвестиции. Врати чист JSON.`,
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

    const text = response.text || "[]";
    return JSON.parse(text.trim());
  } catch (error) {
    console.error("Error suggesting budget:", error);
    return [];
  }
};

export const getFinancialAdvice = async (transactions: any[], budgets: any[]): Promise<string> => {
  try {
    const dataString = JSON.stringify({ transactions, budgets });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Анализирај ги овие финансиски податоци и дај краток совет на македонски јазик за подобро менаџирање со одливите. Податоци: ${dataString}`,
      config: {
        systemInstruction: "Ти си професионален финансиски советник од Македонија. Зборувај пријателски и користи конкретни примери.",
        temperature: 0.7,
      }
    });
    return response.text || "Не можев да генерирам совет.";
  } catch (error) {
    return "Проблем со советувањето.";
  }
};

export const getGoalStrategy = async (goal: FinancialGoal, monthlyIncome: number, monthlyExpenses: number): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Направи кратка стратегија на македонски јазик за штедење за целта: "${goal.title}". 
      Износ на целта: ${goal.targetAmount} ден. 
      Моментално заштедено: ${goal.currentAmount} ден. 
      Рок: ${goal.deadline}. 
      Месечен приход на корисникот: ${monthlyIncome} ден. 
      Месечни одливи: ${monthlyExpenses} ден.
      Кажи му колку треба да трга на страна месечно и дај му 2 конкретини идеи како да ги скрати одливите за да стигне до целта.`,
      config: {
        systemInstruction: "Ти си стручњак за штедење. Биди мотивирачки и прецизен.",
        temperature: 0.8,
      }
    });
    return response.text || "Не можев да генерирам стратегија.";
  } catch (error) {
    return "Проблем со генерирање стратегија.";
  }
};
