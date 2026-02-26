
import { GoogleGenAI } from "@google/genai";
import { SensorData } from "../types";

class AiService {
  private client: GoogleGenAI | null = null;

  constructor() {
    this.init();
  }

  init() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.client = new GoogleGenAI({ apiKey });
    } else {
      console.warn("GEMINI_API_KEY not found in environment variables.");
    }
  }

  async sendMessage(message: string, sensors: SensorData[]) {
    if (!this.client) {
      throw new Error("Serviço de IA não disponível (Chave de API ausente).");
    }

    // Prepare context about sensors
    const sensorContext = sensors.map(s => {
      let dataString = `Sensor: ${s.alias || s.mac} (${s.type || 'Unknown'}). Status: ${s.status}. Power: ${s.power}%.`;
      if (s.temperature !== undefined) dataString += ` Temp: ${s.temperature}°C.`;
      if (s.humidity !== undefined) dataString += ` Umidade: ${s.humidity}%.`;
      if (s.co2 !== undefined) dataString += ` CO2: ${s.co2}ppm.`;
      if (s.pm25 !== undefined) dataString += ` PM2.5: ${s.pm25}.`;
      if (s.tvocPpm !== undefined) dataString += ` TVOC: ${s.tvocPpm}.`;
      return dataString;
    }).join('\n');

    const systemInstruction = `
      Você é o Climatic AI, um assistente inteligente especialista em monitoramento ambiental e qualidade do ar.
      Você tem acesso aos dados em tempo real dos sensores do usuário listados abaixo.
      
      Regras:
      1. Seja extremamente conciso (Low Latency Mode).
      2. Se notar valores perigosos (ex: CO2 > 1000, Umidade > 70% ou < 30%, Temp extrema), alerte o usuário.
      3. Analise tendências ou correlações se perguntado.
      4. Use formatação Markdown simples.
      5. Responda em Português do Brasil.
      
      Dados Atuais dos Sensores:
      ${sensorContext}
    `;

    try {
      const response = await this.client.models.generateContent({
        model: 'gemini-2.5-flash-lite-latest', // Low latency model
        contents: message,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.7, // Slightly creative but focused
          maxOutputTokens: 500, // Keep responses short for speed
        }
      });

      return response.text || "Não consegui gerar uma resposta.";
    } catch (error: any) {
      console.error("Gemini Error:", error);
      throw new Error(error.message || "Erro ao comunicar com a IA.");
    }
  }
}

export const aiService = new AiService();
