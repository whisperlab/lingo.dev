import { I18nConfig } from "@lingo.dev/_spec";
import chalk from "chalk";
import dedent from "dedent";
import { LocalizerFn } from "./_base";
import { createLingoLocalizer } from "./lingo";
import { createBasicTranslator } from "./basic";
import { createOpenAI } from "@ai-sdk/openai";
import { colors } from "../constants";
import { createAnthropic } from "@ai-sdk/anthropic";

export default function createProcessor(
  provider: I18nConfig["provider"],
  params: { apiKey: string; apiUrl: string },
): LocalizerFn {
  if (!provider || provider.id === "lingo") {
    const result = createLingoLocalizer(params);
    return result;
  } else {
    const model = getPureModelProvider(provider);
    const result = createBasicTranslator(model, provider.prompt);
    return result;
  }
}

function getPureModelProvider(provider: I18nConfig["provider"]) {
  const createMissingKeyErrorMessage = (
    providerId: string,
    envVar: string,
  ) => dedent`
  You're trying to use raw ${chalk.dim(providerId)} API for translation, however, ${chalk.dim(envVar)} environment variable is not set.

  To fix this issue:
  1. Set ${chalk.dim(envVar)} in your environment variables, or
  2. Remove the ${chalk.italic("provider")} node from your i18n.json configuration to switch to ${chalk.hex(colors.green)("Lingo.dev")}

  ${chalk.hex(colors.blue)("Docs: https://lingo.dev/go/docs")}
`;

  const createUnsupportedProviderErrorMessage = (providerId?: string) =>
    dedent`
  You're trying to use unsupported provider: ${chalk.dim(providerId)}.

  To fix this issue:
  1. Switch to one of the supported providers, or
  2. Remove the ${chalk.italic("provider")} node from your i18n.json configuration to switch to ${chalk.hex(colors.green)("Lingo.dev")}

  ${chalk.hex(colors.blue)("Docs: https://lingo.dev/go/docs")}
  `;

  switch (provider?.id) {
    case "openai":
      if (!process.env.OPENAI_API_KEY) {
        throw new Error(
          createMissingKeyErrorMessage("OpenAI", "OPENAI_API_KEY"),
        );
      }
      return createOpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        baseURL: provider.baseUrl,
      })(provider.model);
    case "anthropic":
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error(
          createMissingKeyErrorMessage("Anthropic", "ANTHROPIC_API_KEY"),
        );
      }
      return createAnthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      })(provider.model);
    default:
      throw new Error(createUnsupportedProviderErrorMessage(provider?.id));
  }
}
