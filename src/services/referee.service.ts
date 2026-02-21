
import { Injectable } from '@angular/core';
import { GoogleGenAI } from "@google/genai";

export interface FightResult {
  leftScore: number;
  rightScore: number;
  winner: 'left' | 'right' | 'tie';
  commentary: string;
  sources?: { title: string; uri: string }[];
}

@Injectable({
  providedIn: 'root'
})
export class RefereeService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env['API_KEY'] || '' });
  }

  async judgeTerms(term1: string, term2: string): Promise<FightResult> {
    // 1. Normalize and sort terms
    const t1 = term1.trim();
    const t2 = term2.trim();
    
    // Sort to ensure "A vs B" generates the same seed/request as "B vs A"
    const isSwapped = t1.toLowerCase().localeCompare(t2.toLowerCase()) > 0;
    const firstTerm = isSwapped ? t2 : t1;
    const secondTerm = isSwapped ? t1 : t2;

    const requestSeed = this.generateSeed(`${firstTerm.toLowerCase()}_vs_${secondTerm.toLowerCase()}`);

    const prompt = `
      Use the Google Search tool to research the global popularity of "${firstTerm}" versus "${secondTerm}".
      
      GOAL: Determine the winner based on realistic, data-driven estimates of their total global indexed web pages or search volume.

      INSTRUCTIONS:
      1. Search for data regarding the popularity, search volume, or total number of web pages for "${firstTerm}".
      2. Search for data regarding the popularity, search volume, or total number of web pages for "${secondTerm}".
      3. Compare the two values.
      4. Since you cannot directly see the Google Search "About X results" counter, you MUST provide a highly realistic, data-driven estimate of the EXACT number of global search results or indexed pages for each term.
      5. The numbers MUST be EXACT integers (e.g., 5121322). DO NOT round to the nearest million or hundred thousand (e.g., do not output 5000000).
      6. Ensure the scale is realistic (e.g., common words like 'coffee' should have billions of results, niche terms should have thousands or millions).

      OUTPUT FORMAT (Strict):
      LEFT_SCORE: [exact integer representing search results for ${firstTerm}, e.g., 34125121322]
      RIGHT_SCORE: [exact integer representing search results for ${secondTerm}, e.g., 2184321999]
      WINNER: [left/right/tie]
      COMMENTARY: [Witty 1-sentence reason based on the actual search data]
    `;

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: prompt,
        config: {
          temperature: 0, // Force determinism
          seed: requestSeed, // Ensure consistent output for same terms
          tools: [{ googleSearch: {} }]
        }
      });

      const text = response.text || '';
      console.log('AI Response:', text); 

      // Parse
      const leftScoreMatch = text.match(/LEFT_SCORE:\s*([\d,]+)/);
      const rightScoreMatch = text.match(/RIGHT_SCORE:\s*([\d,]+)/);
      const winnerMatch = text.match(/WINNER:\s*(left|right|tie)/i);
      const commentaryMatch = text.match(/COMMENTARY:\s*(.+)/);

      if (!leftScoreMatch || !rightScoreMatch || !winnerMatch) {
        throw new Error('Failed to parse AI response');
      }

      const parsedLeftScore = parseInt(leftScoreMatch[1].replace(/,/g, ''), 10);
      const parsedRightScore = parseInt(rightScoreMatch[1].replace(/,/g, ''), 10);
      const parsedWinner = winnerMatch[1].toLowerCase() as 'left' | 'right' | 'tie';
      const parsedCommentary = commentaryMatch ? commentaryMatch[1].trim() : 'The results are in.';

      // Extract Sources
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const sources = chunks
        .filter((c: any) => c.web)
        .map((c: any) => ({
          title: c.web.title,
          uri: c.web.uri
        }));

      // Un-swap if needed
      if (isSwapped) {
        return {
          leftScore: parsedRightScore,
          rightScore: parsedLeftScore,
          winner: parsedWinner === 'left' ? 'right' : (parsedWinner === 'right' ? 'left' : 'tie'),
          commentary: parsedCommentary,
          sources
        };
      }

      return {
        leftScore: parsedLeftScore,
        rightScore: parsedRightScore,
        winner: parsedWinner,
        commentary: parsedCommentary,
        sources
      };

    } catch (error) {
      console.error('Error judging fight:', error);
      // Fallback
      return {
        leftScore: 0,
        rightScore: 0,
        winner: 'tie',
        commentary: 'Google Search is currently unavailable or the AI failed to parse the results.',
        sources: []
      };
    }
  }

  private generateSeed(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; 
    }
    return Math.abs(hash);
  }
}
