import { Ora } from "ora";
import { PlatformKit } from "../platforms/_base";

export interface IIntegrationFlow {
  preRun?(): Promise<boolean>;
  run(): Promise<boolean>;
  postRun?(): Promise<void>;
}

export abstract class IntegrationFlow implements IIntegrationFlow {
  protected i18nBranchName?: string;

  constructor(
    protected ora: Ora,
    protected platformKit: PlatformKit,
  ) {}

  abstract run(): Promise<boolean>;
}

export const gitConfig = {
  userName: "Lingo.dev",
  userEmail: "support@example.com",
};

export function escapeShellArg(arg: string): string {
  return `'${arg.replace(/'/g, "'\\''")}'`;
}
