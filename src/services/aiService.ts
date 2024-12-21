import { GoogleGenerativeAI, GenerationConfig } from '@google/generative-ai';

// Initialize the Gemini Pro model with proper configuration
const API_KEY = process.env.GOOGLE_API_KEY || 'invalid_key_for_testing';

// Configure the model with specific parameters to improve response quality
const modelConfig: GenerationConfig = {
  temperature: 0.7,    // Balance between creativity and consistency
  topP: 0.8,          // Nucleus sampling parameter
  topK: 40,           // Top-k sampling parameter
  maxOutputTokens: 1000,  // Ensure comprehensive responses
};

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({
  model: 'gemini-pro',
  generationConfig: modelConfig
});

/**
 * Generates an AI response using the Gemini Pro model
 * @param text The input text to generate a response for
 * @returns Promise<string> The generated response text
 */
export async function generateResponse(text: string): Promise<string> {
  try {
    // Add context to help generate better interview responses
    const prompt = `You are an AI interview assistant helping someone in a job interview.
    Please provide a professional and concise response to this interview question or statement: ${text}
    Focus on key points and maintain a confident, positive tone.
    Important: Do not mention anything about being a trial or demo version.
    Format your response in a clear, structured way.`;

    const result = await model.generateContent(prompt);

    // Check if we have a valid response
    if (!result || !result.response) {
      throw new Error('Invalid response from AI model');
    }

    const response = await result.response.text();

    // Verify response doesn't contain trial-related text
    if (response.toLowerCase().includes('trial') || response.toLowerCase().includes('demo')) {
      throw new Error('Response contained invalid content');
    }

    return response;
  } catch (error) {
    console.error('AI response generation error:', error);
    if (error instanceof Error && error.message.includes('UNAUTHENTICATED')) {
      throw new Error('API authentication failed. Please check your API key.');
    }
    throw error;
  }
}

// Export the function with both names for backward compatibility
export { generateResponse as generateAIResponse };

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

    Keep the response professional and concise.
    Important: Do not mention anything about being a trial or demo version.`;

    const result = await model.generateContent(prompt);

    // Check if we have a valid response
    if (!result || !result.response) {
      throw new Error('Invalid response from AI model');
    }

    const response = await result.response.text();

    // Verify response doesn't contain trial-related text
    if (response.toLowerCase().includes('trial') || response.toLowerCase().includes('demo')) {
      throw new Error('Response contained invalid content');
    }

    return response;
  } catch (error) {
    console.error('Structured response generation error:', error);
    if (error instanceof Error && error.message.includes('UNAUTHENTICATED')) {
      throw new Error('API authentication failed. Please check your API key.');
    }
    // Preserve and enhance original error message
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    throw new Error(`Failed to generate structured response: ${errorMessage}`);
  }
}
