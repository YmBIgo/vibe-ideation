import OpenAI from "openai";
import Anthropic from '@anthropic-ai/sdk';

export type LLMType = 'openai' | 'anthropic'
export const openAIModel = "gpt-5.5";
export const anthropicModel = "claude-opus-4-8";

export const getLLMResponse = async (
  llmType: LLMType,
  prompt: string,
  systemPrompt: string
): Promise<string> => {
  switch(llmType) {
    case 'openai':
      const openAiClient = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY || '',
      });
      const response = await openAiClient.responses.create({
        model: openAIModel,
        input: prompt,
        instructions: systemPrompt,
      });
      return response.output_text.replace(/```json/, "").replace(/```/, "").replace(/出力/, "");
    case 'anthropic':
      const anthropicClient = new Anthropic({
        apiKey: process.env['ANTHROPIC_API_KEY'], // This is the default and can be omitted
      });
      const response2 = await anthropicClient.messages.create({
        model: anthropicModel,
        system: systemPrompt,
        messages: [
          {role: "user", content: prompt}
        ],
        max_tokens: 8096
      });
      const contents = response2.content;
      const textContent = contents.find((c: any) => c.type === "text");
      if (!textContent) {
        console.error("Unexpected response format from Anthropic API:", response2.content);
        throw new Error("Unexpected response format from Anthropic API");
      }
      if (textContent?.type === "text") {
        return textContent.text.replace(/```json/, "").replace(/```/g, "").replace(/^\s*出力/, "");
      }
    default:
      throw new Error(`Unsupported LLM type: ${llmType}`);
  }
};