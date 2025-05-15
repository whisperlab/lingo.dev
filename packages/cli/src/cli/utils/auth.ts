import { CLIError } from "./errors";

export type AuthenticatorParams = {
  apiUrl: string;
  apiKey: string;
};

export type AuthPayload = {
  email: string;
  id: string;
};

export function createAuthenticator(params: AuthenticatorParams) {
  return {
    async whoami(): Promise<AuthPayload | null> {
      try {
        const res = await fetch(`${params.apiUrl}/whoami`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${params.apiKey}`,
            ContentType: "application/json",
          },
        });

        if (res.ok) {
          const payload = await res.json();
          if (!payload?.email) {
            return null;
          }

          return {
            email: payload.email,
            id: payload.id,
          };
        }

        return null;
      } catch (error) {
        const isNetworkError =
          error instanceof TypeError && error.message === "fetch failed";
        if (isNetworkError) {
          throw new CLIError({
            message: `Failed to connect to the API at ${params.apiUrl}. Please check your connection and try again.`,
            docUrl: "connectionFailed",
          });
        } else {
          throw error;
        }
      }
    },
  };
}
