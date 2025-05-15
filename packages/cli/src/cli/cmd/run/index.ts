import { Command } from "interactive-commander";
import setup from "./setup";
import plan from "./plan";
import execute from "./execute";
import { CmdRunContext, flagsSchema } from "./_types";
import {
  renderClear,
  renderSpacer,
  renderBanner,
  renderHero,
  pauseIfDebug,
  renderSummary,
} from "./_render";

export default new Command()
  .command("run")
  .description("Run Lingo.dev localization engine")
  .helpOption("-h, --help", "Show help")
  .option(
    "--locale <locale>",
    "Locale to process",
    (val: string, prev: string[]) => (prev ? [...prev, val] : [val]),
  )
  .option(
    "--bucket <bucket>",
    "Bucket to process",
    (val: string, prev: string[]) => (prev ? [...prev, val] : [val]),
  )
  .option(
    "--key <key>",
    "Key to process. Process only a specific translation key, useful for debugging or updating a single entry",
  )
  .option(
    "--file [files...]",
    "File to process. Process only a specific path, may contain asterisk * to match multiple files. Useful if you have a lot of files and want to focus on a specific one. Specify more files separated by commas or spaces.",
  )
  .option(
    "--frozen",
    `Run in read-only mode - fails if any translations need updating, useful for CI/CD pipelines to detect missing translations`,
  )
  .option(
    "--force",
    "Ignore lockfile and process all keys, useful for full re-translation",
  )
  .option(
    "--verbose",
    "Show detailed output including intermediate processing data and API communication details",
  )
  .option(
    "--interactive",
    "Enable interactive mode for reviewing and editing translations before they are applied",
  )
  .option(
    "--api-key <api-key>",
    "Explicitly set the API key to use, override the default API key from settings",
  )
  .option(
    "--debug",
    "Pause execution at start for debugging purposes, waits for user confirmation before proceeding",
  )
  .option(
    "--strict",
    "Stop processing on first error instead of continuing with other locales/buckets",
  )
  .action(async (args) => {
    try {
      const ctx: CmdRunContext = {
        flags: flagsSchema.parse(args),
        config: null,
        results: new Map(),
        tasks: [],
        localizer: null,
      };

      await pauseIfDebug(ctx.flags.debug);
      await renderClear();
      await renderSpacer();
      await renderBanner();
      await renderHero();
      await renderSpacer();

      await setup(ctx);
      await renderSpacer();

      await plan(ctx);
      await renderSpacer();

      await execute(ctx);
      await renderSpacer();

      await renderSummary(ctx);
      await renderSpacer();
    } catch (error: any) {
      process.exit(1);
    }
  });
