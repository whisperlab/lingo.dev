import { LanguageModelV1 } from "ai";
import { BasicEngine } from "@whisperlab/lingo.dev_sdk";
import { LocalizerInput, LocalizerProgressFn } from "./_base";

export function createBasicTranslator(model: LanguageModelV1, systemPrompt: string) {
  return async (input: LocalizerInput, onProgress: LocalizerProgressFn) => {
    if (!Object.keys(input.processableData).length) {
      return input.processableData;
    }

    if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
      throw new Error("OPENAI_API_KEY or ANTHROPIC_API_KEY is not set");
    }

    const basic = new BasicEngine({
      model,
      systemPrompt,
    });

    const result = await basic.localizeObject(
      input.processableData,
      {
        sourceLocale: input.sourceLocale,
        targetLocale: input.targetLocale,
        reference: {
          [input.sourceLocale]: input.sourceData,
          [input.targetLocale]: input.targetData,
        },
      },
      onProgress,
    );

    return result;
  };
}
