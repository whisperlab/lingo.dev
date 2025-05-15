import chalk from "chalk";
import { Listr } from "listr2";

import { colors } from "../../../constants";
import { CmdRunContext, flagsSchema } from "../_types";
import { commonTaskRendererOptions } from "../_const";
import { getConfig } from "../../../utils/config";
import createLocalizer from "./localizer";

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
          ctx.config = getConfig(true);

          if (!ctx.config) {
            throw new Error(
              "i18n.json not found. Please run `lingo.dev init` to initialize the project.",
            );
          } else if (
            !ctx.config.buckets ||
            !Object.keys(ctx.config.buckets).length
          ) {
            throw new Error(
              "No buckets found in i18n.json. Please add at least one bucket containing i18n content.",
            );
          } else if (
            ctx.flags.locale?.some(
              (locale) => !ctx.config?.locale.targets.includes(locale),
            )
          ) {
            throw new Error(
              `One or more specified locales do not exist in i18n.json locale.targets. Please add them to the list first and try again.`,
            );
          } else if (
            ctx.flags.bucket?.some(
              (bucket) =>
                !ctx.config?.buckets[bucket as keyof typeof ctx.config.buckets],
            )
          ) {
            throw new Error(
              `One or more specified buckets do not exist in i18n.json. Please add them to the list first and try again.`,
            );
          }
          task.title = `Loaded i18n configuration`;
        },
      },
      {
        title: "Selecting localization provider",
        task: async (ctx, task) => {
          ctx.localizer = createLocalizer(ctx.config?.provider);
          if (!ctx.localizer) {
            throw new Error(
              "Could not create localization provider. Please check your i18n.json configuration.",
            );
          }
          task.title =
            ctx.localizer.id === "Lingo.dev"
              ? `Using ${chalk.hex(colors.green)(ctx.localizer.id)} provider`
              : `Using raw ${chalk.hex(colors.yellow)(ctx.localizer.id)} API`;
        },
      },
      {
        title: "Checking authentication",
        task: async (ctx, task) => {
          const authStatus = await ctx.localizer!.checkAuth();
          if (!authStatus.authenticated) {
            throw new Error(
              `Failed to authenticate with ${chalk.hex(colors.yellow)(ctx.localizer!.id)} provider. Please check your API key and try again.`,
            );
          }
          task.title = `Authenticated as ${chalk.hex(colors.yellow)(authStatus.username)}`;
        },
      },
      {
        title: "Initializing localization provider",
        async task(ctx, task) {
          const isLingoDotDev = ctx.localizer!.id === "Lingo.dev";

          const subTasks = isLingoDotDev
            ? [
                "Brand voice enabled",
                "Translation memory connected",
                "Glossary enabled",
                "Quality assurance enabled",
              ].map((title) => ({ title, task: () => {} }))
            : [
                "Skipping brand voice",
                "Skipping glossary",
                "Skipping translation memory",
                "Skipping quality assurance",
              ].map((title) => ({ title, task: () => {}, skip: true }));

          return task.newListr(subTasks, {
            concurrent: true,
            rendererOptions: { collapseSubtasks: false },
          });
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
