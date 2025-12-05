import { GoogleGenAI, Type } from "@google/genai";
import { Room, RoomStatus } from "../types";

// In a real app, this key should be secure. For this demo, we use the env.
// Initialization guideline: Use process.env.API_KEY directly.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const findBestRoom = async (query: string, availableRooms: Room[]): Promise<string> => {
  if (!process.env.API_KEY) {
    return "未检测到 API Key，请检查配置。";
  }

  // Optimize context to avoid token limits with large datasets
  // We summarize the data structure instead of sending every single JSON object if the list is huge.
  // For this demo, we map a simplified version.
  const simplifiedRooms = availableRooms.map(r => ({
    id: r.id,
    desc: `楼栋 ${r.building}, 楼层 ${r.floor}, 房号 ${r.number}, 面积 ${r.area}平米`
  }));

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `
        You are a helpful real estate concierge for Chinese users.
        User Query: "${query}"
        
        Here is a list of available rooms (JSON):
        ${JSON.stringify(simplifiedRooms.slice(0, 300))} 
        (Note: List may be truncated for performance. If no perfect match, find the closest.)
        
        Analyze the request and recommend the ONE single best room ID from the list.
        Explain why you chose it in 1 short sentence in Simplified Chinese (简体中文).
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            roomId: { type: Type.STRING },
            reason: { type: Type.STRING }
          }
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
    return result.reason ? `推荐: ${result.roomId?.split('-')[1] || ''}栋... ${result.reason}` : "抱歉，未找到匹配的房间。";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "抱歉，AI 助手暂时无法分析数据。";
  }
};