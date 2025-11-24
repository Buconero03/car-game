import { GoogleGenAI } from "@google/genai";
import { CarStats } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getCrewChiefCommentary = async (stats: CarStats, eventType: 'start' | 'crash' | 'speeding' | 'idle' | 'nitro'): Promise<string> => {
  try {
    const prompt = `
      Sei il co-pilota più "tamarro" e gasato della storia delle corse illegali italiane. 
      Siamo nel 2077, ma tu parli come un ragazzo di periferia col motorino truccato.
      
      Stato attuale:
      - Velocità: ${Math.floor(stats.speed)} km/h
      - Nitro: ${Math.floor(stats.nitro)}%
      - Evento: ${eventType}

      Dammi UN SOLO commento brevissimo (max 8 parole) in ITALIANO.
      
      Stile e Personalità:
      - Usa slang pesante (tipo: "Zio", "Drifta", "Sverniciati", "Chiodo", "Molla", "Sbirri").
      - Sii esageratamente drammatico o esageratamente felice.
      - Se andiamo piano, prendimi in giro ferocemente (es: "Mia nonna è più veloce").
      - Se usiamo il Nitro, urla come un pazzo.
      - Se facciamo un incidente, insulta la macchina o il muro.

      NON usare hashtag. NON usare emoji. Solo testo puro e cattiveria agonistica.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 0 },
        temperature: 1.0, // Maximum chaos
      }
    });

    return response.text.trim() || "Daje col gas zio!";
  } catch (error) {
    console.error("Gemini Crew Chief error:", error);
    return "Radio disturbata...";
  }
};