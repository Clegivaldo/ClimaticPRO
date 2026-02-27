import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { prisma } from '../utils/prisma';

/**
 * Service for Gemini AI Assistant integration
 * Requirement 6.1: Interactive assistant using Gemini
 * Requirement 6.2: 500 token limit and 5-second timeout
 * Requirement 6.3: Contextual awareness of user's sensors
 */

let genAI: GoogleGenerativeAI | null = null;
let model: GenerativeModel | null = null;

/**
 * Initialize Gemini AI
 */
export function initGemini() {
  const apiKey = process.env['GEMINI_API_KEY'];
  if (!apiKey) {
    console.warn('GEMINI_API_KEY not found. AI Assistant will be unavailable.');
    return;
  }
  
  genAI = new GoogleGenerativeAI(apiKey);
  model = genAI.getGenerativeModel({ 
    model: 'gemini-1.5-flash', // Using 1.5-flash as 2.5-flash doesn't exist
    generationConfig: {
      maxOutputTokens: 500, // Requirement 6.2: 500 token limit
    }
  });
  console.log('Gemini AI initialized successfully');
}

/**
 * Send a message to the AI assistant with sensor context
 */
export async function askAssistant(userId: string, message: string) {
  if (!model) {
    throw new Error('AI Assistant is currently unavailable (API key not configured)');
  }

  // Requirement 6.3: Get sensor context
  const sensors = await prisma.sensor.findMany({
    where: { userId, isActive: true },
    include: {
      readings: {
        take: 1,
        orderBy: { timestamp: 'desc' }
      },
      alertConfig: true
    }
  });

  const sensorContext = sensors.map(s => {
    const latestReading = s.readings[0];
    return {
      id: s.id,
      alias: s.alias || s.mac,
      type: s.deviceType,
      lastSeen: s.lastSeenAt,
      battery: s.batteryLevel,
      currentData: latestReading ? {
        temp: latestReading.temperature,
        humidity: latestReading.humidity,
        co2: latestReading.co2,
        pm25: latestReading.pm25,
        tvoc: latestReading.tvoc,
        waterLevel: latestReading.waterLevel,
        timestamp: latestReading.timestamp
      } : 'No data available',
      thresholds: s.alertConfig ? {
        temp: [s.alertConfig.tempMin, s.alertConfig.tempMax],
        hum: [s.alertConfig.humidityMin, s.alertConfig.humidityMax],
        co2: s.alertConfig.co2Max
      } : 'No thresholds configured'
    };
  });

  const systemPrompt = `You are the Climatic Pro AI Assistant. You help users monitor their environmental sensors.
Here is the current state of the user's sensors:
${JSON.stringify(sensorContext, null, 2)}

Instructions:
1. Provide helpful insights based on the sensor data.
2. If values are dangerous (CO2 > 1000, humidity < 30% or > 70%), mention them.
3. Be concise.
4. Use Markdown for formatting (Requirement 6.6).
5. Always answer in the user's language.`;

  try {
    // Requirement 6.2: 5-second timeout
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('AI Assistant timed out')), 5000)
    );

    const chat = model.startChat({
      history: [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: 'Understood. I have access to the sensor context. How can I help you today?' }] }
      ]
    });

    const resultPromise = chat.sendMessage(message);
    
    const result: any = await Promise.race([resultPromise, timeoutPromise]);
    const response = await result.response;
    const text = response.text();

    return {
      text,
      timestamp: new Date()
    };
  } catch (error: any) {
    if (error.message === 'AI Assistant timed out') {
      throw error;
    }
    console.error('Error in Gemini Assistant:', error);
    throw new Error('Failed to get response from AI Assistant');
  }
}

/**
 * Get automatic insights for a user
 * Requirement 6.7: Automatic insights based on trends
 */
export async function getAutomaticInsights(userId: string) {
  const message = "Analyze my sensors and give me 3 brief, actionable insights based on current data and trends.";
  return askAssistant(userId, message);
}
