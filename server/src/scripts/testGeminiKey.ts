import dotenv from 'dotenv';
dotenv.config();

import { GoogleGenAI } from '@google/genai';
import { GeminiProvider } from '../ai/geminiProvider.js';
import { z } from 'zod';

async function verifyGeminiKey() {
  console.log('====================================================');
  console.log('🤖 Verifying Gemini API Key for Flowdesk CRM');
  console.log('====================================================\n');

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('❌ Error: GEMINI_API_KEY is not defined in server/.env');
    process.exit(1);
  }

  console.log(`🔑 Key detected: ${apiKey.substring(0, 10)}... (length: ${apiKey.length})`);

  // 1. Direct SDK test
  console.log('\n--- 1. Testing Direct @google/genai SDK Call ---');
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: 'Respond with: "Gemini 3.8 Flash is connected and operational in Flowdesk!"',
    });
    console.log('✅ SDK Response received:');
    console.log(`   "${response.text?.trim()}"`);
  } catch (err: any) {
    console.error('❌ Direct SDK call failed:', err?.message || err);
    process.exit(1);
  }

  // 2. Flowdesk GeminiProvider test
  console.log('\n--- 2. Testing Flowdesk GeminiProvider Class ---');
  try {
    const provider = new GeminiProvider();
    console.log(`   Is Configured: ${provider.isConfigured()}`);
    console.log(`   Strong Model:  ${provider.getModelName('strong')}`);
    console.log(`   Fast Model:    ${provider.getModelName('fast')}`);

    const result = await provider.generateText({
      prompt: 'Summarize the value proposition of Flowdesk CRM in one powerful sentence.',
      model: provider.getModelName('strong'),
      systemPrompt: 'You are an enterprise AI assistant for Flowdesk CRM.',
    });

    console.log('✅ GeminiProvider generation succeeded:');
    console.log(`   Output: "${result.text.trim()}"`);
    console.log(`   Usage:  ${result.usage.inputTokens} input tokens, ${result.usage.outputTokens} output tokens`);
  } catch (err: any) {
    console.error('❌ GeminiProvider test failed:', err?.message || err);
    process.exit(1);
  }

  // 3. Structured JSON test
  console.log('\n--- 3. Testing Structured JSON Generation ---');
  try {
    const provider = new GeminiProvider();
    const crmFeatureSchema = z.object({
      status: z.string(),
      features: z.array(z.string()),
    });

    const jsonResult = await provider.generateStructuredJson({
      prompt:
        'Return a JSON object strictly matching this schema:\n{\n  "status": "active",\n  "features": ["Lead Management", "Pipeline Tracking", "AI Scoring"]\n}',
      model: provider.getModelName('fast'),
      schema: crmFeatureSchema,
    });

    console.log('✅ Structured JSON Output:');
    console.log('  ', JSON.stringify(jsonResult.data, null, 2));
  } catch (err: any) {
    console.error('❌ Structured JSON test failed:', err?.message || err);
    process.exit(1);
  }

  // 4. Automated Model Quota Fallback Chaining test
  console.log('\n--- 4. Testing Automated Model Quota Fallback Chaining ---');
  try {
    const fallbackChain = new GeminiProvider().getFallbackChain();
    console.log('   Fallback Priority Chain:', fallbackChain.slice(0, 5).join(' -> '));

    // Simulate exhausted quota on the primary model by overriding client to fail on primary model
    const attemptedModels: string[] = [];
    const mockQuotaClient = {
      models: {
        generateContent: async (params: any) => {
          attemptedModels.push(params.model);
          if (params.model === 'gemini-3.8-flash') {
            const quotaErr: any = new Error('Resource has been exhausted (quota exceeded) - 429');
            quotaErr.status = 429;
            throw quotaErr;
          }
          return {
            text: `Successfully answered by fallback model: ${params.model}`,
            usageMetadata: { promptTokenCount: 15, candidatesTokenCount: 10 },
          };
        },
      },
    } as unknown as GoogleGenAI;

    const fallbackTestProvider = new GeminiProvider(mockQuotaClient);
    fallbackTestProvider.isMockClient = false; // enable fallback for this test

    const fallbackOutput = await fallbackTestProvider.generateText({
      prompt: 'Test prompt during quota exhaustion',
    });

    console.log('   Attempted Models in order:', attemptedModels.join(' -> '));
    console.log('✅ Fallback response successfully received:');
    console.log(`   "${fallbackOutput.text}"`);
  } catch (err: any) {
    console.error('❌ Model fallback test failed:', err?.message || err);
    process.exit(1);
  }

  console.log('\n====================================================');
  console.log('🎉 ALL GEMINI API KEY & MODEL FALLBACK TESTS PASSED!');
  console.log('====================================================');
  process.exit(0);
}

verifyGeminiKey().catch((err) => {
  console.error('\n❌ Unhandled exception:', err);
  process.exit(1);
});
