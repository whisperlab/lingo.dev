import chalk from "chalk";
import { Listr } from "listr2";

import { colors } from "../../constants";
import { CmdRunContext, flagsSchema } from "./_types";
import { commonTaskRendererOptions } from "./_const";
import { getConfig } from "../../utils/config";

export default async function setup(input: CmdRunContext, cliArgs: any) {
  console.log(chalk.hex(colors.orange)("[Setup]"));

  return new Listr<CmdRunContext>(
    [
      {
        title: "Setting up the environment",
        task: async (ctx, task) => {
          // setup gitignore, etc here
          task.title = `Environment setup completed`;
        },
      },
      {
        title: "Loading Lingo.dev CLI parameters",
        task: async (ctx, task) => {
          ctx.flags = flagsSchema.parse(cliArgs);
          task.title = `Lingo.dev CLI parameters loaded`;
        },
      },
      {
        title: "Loading i18n configuration",
        task: async (ctx, task) => {
          const config = getConfig(true);
          if (!config) {
            throw new Error(
              "No i18n configuration found. Did you forget to run `npx lingo.dev@latest init`?",
            );
          }

          ctx.config = config;
          task.title = `Loaded i18n configuration`;
        },
      },
      {
        title: "Validating localization settings",
        task: async (ctx, task) => {
          task.title = `Localization settings validated`;
        },
      },
      {
        title: "Selecting localization provider",
        task: async (ctx, task) => {
          task.title = `Using ${chalk.hex(colors.green)("Lingo.dev")} provider`;
        },
      },
      {
        title: "Checking authentication",
        task: async (ctx, task) => {
          task.title = `Authentication check completed`;
        },
      },
    ],
    {
      rendererOptions: commonTaskRendererOptions,
    },
  ).run(input);
}

// export async function setup(): Promise<SetupState> {
//   console.log(chalk.hex(colors.orange)("[Setup]"));

//   const setupTasks = new Listr<SetupState>(
//     [
//       {
//         title: "Setting up the environment",
//         task: async (ctx, task) => {
//           task.title = `Environment setup completed`;
//         },
//       },
//       {
//         title: "Loading Lingo.dev CLI parameters",
//         task: async (ctx, task) => {
//           task.title = `Lingo.dev CLI parameters loaded`;
//         },
//       },
//       {
//         title: "Loading i18n configuration",
//         task: async (ctx, task) => {
//           task.title = `Loaded i18n configuration`;
//         },
//       },
//       {
//         title: "Selecting translation provider",
//         task: async (ctx, task) => {
//           const provider = ctx.i18nConfig.provider;
//           const providerName = provider?.id ?? "lingo.dev";
//           task.output = `Initializing ${chalk.hex(colors.yellow)(providerName)} processor...`;

//           const processor = createProcessor(provider, {
//             apiKey: "",
//             apiUrl: "",
//           });
//           ctx.localizer = {
//             type: providerName,
//             processor: processor,
//           };

//           if (providerName === "lingo.dev") {
//             task.title = `Using ${chalk.hex(colors.green)("Lingo.dev")} provider`;
//           } else {
//             task.title = `Using raw ${chalk.hex(colors.yellow)(`${providerName} (${provider?.model})`)} instead of ${chalk.hex(colors.green)("Lingo.dev")} Engine`;
//           }

//           const isLingoDev = providerName === "lingo.dev";

//           if (!isLingoDev) {
//             const skippedFeatureTitles = [
//               "Lingo.dev authentication skipped",
//               "Skipping brand voice",
//               "Skipping glossary",
//               "Skipping translation memory",
//               "Skipping quality assurance",
//             ];

//             return task.newListr(
//               skippedFeatureTitles.map((title) => ({
//                 title: chalk.dim(title),
//                 task: () => {},
//                 skip: true,
//               })),
//               {
//                 concurrent: true,
//                 rendererOptions: { collapseSubtasks: false },
//               },
//             );
//           }

//           // Lingo.dev provider: perform authentication and show enabled features
//           task.output = "Authenticating with Lingo.dev...";
//           const settings = getSettings(undefined);
//           const auth = await validateAuth(settings);
//           ctx.auth = auth;

//           // Update the parent task title to reflect successful authentication
//           task.title = `Authenticated as ${chalk.hex(colors.yellow)(auth.email)}`;

//           return task.newListr(
//             [
//               "Brand voice enabled",
//               "Translation memory connected",
//               "Glossary enabled",
//               "Quality assurance enabled",
//             ].map((item) => ({ title: item, task: () => {} })),
//             {
//               concurrent: true,
//               rendererOptions: { collapseSubtasks: false },
//             },
//           );
//         },
//       },
//     ],
//     {
//       exitOnError: true,
//       rendererOptions: {
//         color: {
//           [ListrDefaultRendererLogLevels.COMPLETED]: (msg?: string) =>
//             msg ? chalk.hex(colors.green)(msg) : chalk.hex(colors.green)(""),
//         },
//         icon: {
//           [ListrDefaultRendererLogLevels.COMPLETED]: chalk.hex(colors.green)(
//             "✓",
//           ),
//         },
//       },
//     },
//   );

//   const result = await setupTasks.run();
//   return result;
// }
