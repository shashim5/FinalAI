import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the Gemini Pro model
const API_KEY = 'AIzaSyDfbugjoSRGIb40hn4JoxT8kLL39tIzCzM';
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

/**
 * Generates an AI response using the Gemini Pro model
 * @param text The input text to generate a response for
 * @returns Promise<string> The generated response text
 * @throws Error if the API call fails
 */
export async function generateResponse(text: string): Promise<string> {
  try {
    // Add context to help generate better interview responses
    const prompt = `You are an AI interview assistant helping someone in a job interview.
    Please provide a professional and concise response to this interview question or statement: ${text}
    Focus on key points and maintain a confident, positive tone.`;

    const result = await model.generateContent(prompt);
    const response = await result.response.text();

    return response;
  } catch (error) {
    console.error('AI response generation error:', error);
    throw new Error('Failed to generate AI response. Please try again.');
  }
}

/**
 * Formats the interview question and generates a structured response
 * @param question The interview question to analyze
 * @returns Promise<string> A structured response with key points
 */
export async function generateStructuredResponse(question: string): Promise<string> {
  try {
    const prompt = `As an AI interview assistant, analyze this interview question and provide a structured response:
    Question: ${question}

    Please format the response with:
    1. A brief understanding of what the interviewer is looking for
    2. Key points to address
    3. A sample answer
    4. Follow-up points if needed

    Keep the response professional and concise.`;

    const result = await model.generateContent(prompt);
    const response = await result.response.text();

    return response;
  } catch (error) {
    console.error('Structured response generation error:', error);
    throw new Error('Failed to generate structured response. Please try again.');
  }
}
