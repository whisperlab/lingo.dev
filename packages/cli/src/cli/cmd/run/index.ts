import { Command } from "interactive-commander";
import chalk from "chalk";
import figlet from "figlet";
import { vice } from "gradient-string";
import readline from "readline";
// Local modules
import { colors } from "../../constants";
import setup from "./setup";
import plan from "./plan";
import execute from "./execute";
import { CmdRunContext, flagsSchema } from "./_types";

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
      await renderClear();
      await renderSpacer();
      await renderBanner();
      await renderHero();
      await renderSpacer();

      const ctx = createEmptyCmdRunCtx();

      await setup(ctx, args);
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

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

function createEmptyCmdRunCtx(): CmdRunContext {
  return {
    config: null,
    flags: flagsSchema.parse({}),
    results: new Map(),
    tasks: [],
    localizer: null,
  };
}

async function exitIfNoTasks(tasks: unknown[]): Promise<void> {
  if (!tasks.length) {
    console.log(
      chalk.yellow(
        `Notice: Nothing to translate. Please check your i18n configuration file for proper bucket and locale settings.`,
      ),
    );
    await renderSpacer();
    console.log(
      chalk.dim(
        `Hint: Ensure your i18n.json has valid source and target locales, and that your bucket paths match existing files.`,
      ),
    );
    await renderSpacer(); // Add spacer for better visual separation before exit
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Render helpers (kept in this file for quick reference & CLI UX tweaks)
// ---------------------------------------------------------------------------

export async function renderClear() {
  console.log("\x1Bc");
}

export async function renderSpacer() {
  console.log(" ");
}

export async function renderBanner() {
  console.log(
    vice(
      figlet.textSync("LINGO.DEV", {
        font: "ANSI Shadow",
        horizontalLayout: "default",
        verticalLayout: "default",
      }),
    ),
  );
}

export async function renderHero() {
  console.log(
    `⚡️ ${chalk.hex(colors.green)("Lingo.dev")} - open-source, AI-powered i18n CLI for web & mobile localization.`,
  );
  console.log("");

  const label1 = "⭐ GitHub Repo:";
  const label2 = "📚 Docs:";
  const label3 = "💬 24/7 Support:";
  const maxLabelWidth = 17; // Approximate visual width accounting for emoji

  console.log(
    `${chalk.hex(colors.blue)(label1.padEnd(maxLabelWidth))} ${chalk.hex(colors.blue)("https://lingo.dev/go/gh")}`,
  );
  console.log(
    `${chalk.hex(colors.blue)(label2.padEnd(maxLabelWidth + 1))} ${chalk.hex(colors.blue)("https://lingo.dev/go/docs")}`,
  ); // Docs emoji seems narrower
  console.log(
    `${chalk.hex(colors.blue)(label3.padEnd(maxLabelWidth + 1))} ${chalk.hex(colors.blue)("hi@lingo.dev")}`,
  );
}

async function waitForUserPrompt(message: string): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(chalk.dim(`[${message}]\n`), () => {
      rl.close();
      resolve();
    });
  });
}

async function renderSummary(ctx: CmdRunContext) {
  console.log(chalk.hex(colors.green)("All translation tasks completed!"));
}
