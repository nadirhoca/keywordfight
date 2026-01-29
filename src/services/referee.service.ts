
import { Injectable } from '@angular/core';
import { GoogleGenAI, Type, SchemaType } from "@google/genai";

export interface FightResult {
  leftScore: number;
  rightScore: number;
  winner: 'left' | 'right' | 'tie';
  commentary: string;
}

@Injectable({
  providedIn: 'root'
})
export class RefereeService {
  private ai: GoogleGenAI;

  constructor() {
    // Initialize Gemini with the API key from environment variables
    this.ai = new GoogleGenAI({ apiKey: process.env['API_KEY'] || '' });
  }

  async judgeTerms(term1: string, term2: string): Promise<FightResult> {
    const prompt = `
      Compare the two terms: "${term1}" and "${term2}".
      
      Estimate the "Number of Results" or "Global Search Volume" for each term.
      These should be LARGE integers, representing how many hits these terms would get on a search engine. 
      Values should typically range from 100,000 to 10,000,000,000 (billions).
      
      Crucial: 
      1. The more popular term must have a significantly higher number.
      2. If one term is very niche and the other is global, the difference should be massive (e.g. 500,000 vs 2,000,000,000).
      
      Provide a witty, short, sarcastic, or funny one-sentence commentary explaining why the winner won.
    `;

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              leftScore: { type: Type.INTEGER, description: "Estimated search result count for term 1 (can be very large)" },
              rightScore: { type: Type.INTEGER, description: "Estimated search result count for term 2 (can be very large)" },
              winner: { type: Type.STRING, enum: ["left", "right", "tie"], description: "The winner of the fight" },
              commentary: { type: Type.STRING, description: "Short witty reason for the result" }
            },
            required: ["leftScore", "rightScore", "winner", "commentary"]
          }
        }
      });

      const text = response.text;
      if (!text) {
        throw new Error('No response from AI');
      }

      return JSON.parse(text) as FightResult;

    } catch (error) {
      console.error('Error judging fight:', error);
      // Fallback in case of AI error
      return {
        leftScore: 100000,
        rightScore: 100000,
        winner: 'tie',
        commentary: 'The referee is confused. Try again!'
      };
    }
  }
}
