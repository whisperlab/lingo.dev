import {
  bucketTypeSchema,
  I18nConfig,
  localeCodeSchema,
} from "@lingo.dev/_spec";
import { z } from "zod";
import { LocalizerFn } from "../../processor/_base";

export type CmdRunContext = {
  flags: CmdRunFlags;
  config: I18nConfig | null;
  localizer: ILocalizer | null;
  tasks: CmdRunTask[];
  results: Map<CmdRunTask, { success: boolean; error?: Error }>;
};

export type CmdRunTask = {
  sourceLocale: string;
  targetLocale: string;
  bucketType: string;
  filePathPlaceholder: string;
};

export const flagsSchema = z.object({
  apiKey: z.string().optional(),
  locale: z.array(localeCodeSchema).optional(),
  bucket: z.array(bucketTypeSchema).optional(),
  force: z.boolean().optional(),
  frozen: z.boolean().optional(),
  verbose: z.boolean().optional(),
  strict: z.boolean().optional(),
  key: z.string().optional(),
  file: z.array(z.string()).optional(),
  interactive: z.boolean().default(false),
  concurrency: z.number().positive().default(4),
  debug: z.boolean().default(false),
});
export type CmdRunFlags = z.infer<typeof flagsSchema>;

export type LocalizerData = {
  sourceLocale: string;
  sourceData: Record<string, any>;
  processableData: Record<string, any>;
  targetLocale: string;
  targetData: Record<string, any>;
};
export type LocalizerProgressFn = (progress: number) => void;
export interface ILocalizer {
  id: "Lingo.dev" | NonNullable<I18nConfig["provider"]>["id"];
  checkAuth: () => Promise<{ authenticated: boolean; username?: string }>;
  localize: (
    input: LocalizerData,
    onProgress?: LocalizerProgressFn,
  ) => Promise<LocalizerData["processableData"]>;
}
