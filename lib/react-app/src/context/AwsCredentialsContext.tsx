import React, { createContext, useEffect, useState } from "react";

export type CredentialProperties = {
  AccessKeyId: string;
  SecretAccessKey: string;
  SessionToken: string;
  Expiration: string;
  Region: string;
};

export interface AwsCredentialsContextValue {
  credentials: CredentialProperties | null;
}

/**
 * Provides a React context for managing AWS credentials within the application.
 *
 * @context
 * @property {CredentialProperties | null} credentials - The AWS credentials, including
 *   the access key ID, secret access key, session token, and expiration date.
 */
export const AwsCredentialsContext = createContext<AwsCredentialsContextValue>({
  credentials: null,
});

/**
 * Defines a React provider for managing AWS credentials within the application. The
 * `AwsCredentialsProvider` component is responsible for fetching the necessary AWS
 * credentials from a backend API and making them available through the `AwsCredentialsContext`.
 *
 * The context provides the following properties:
 * - `AccessKeyId`: The AWS access key ID.
 * - `SecretAccessKey`: The AWS secret access key.
 * - `SessionToken`: The AWS session token.
 * - `Expiration`: The expiration date of the AWS credentials.
 * - `Region`: The AWS region associated with the credentials.
 *
 * @example
 * import { AwsCredentialsContext, AwsCredentialsProvider } from './AwsCredentialsContext';
 *
 * const App = () => {
 *   return (
 *     <AwsCredentialsProvider>
 *       {// Your application components //}
 *     </AwsCredentialsProvider>
 *   );
 * };
 */
export const AwsCredentialsProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [credentials, setCredentials] = useState<CredentialProperties | null>(
    null
  );

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL + "get-credentials";
    const apiKeyValue = import.meta.env.VITE_API_KEY;

    const fetchCredentials = async () => {
      try {
        const response = await fetch(apiUrl, {
          headers: {
            "x-api-key": apiKeyValue,
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}`);
        }

        const data: CredentialProperties = await response.json();
        setCredentials(data);
      } catch (err) {
        console.error("An unknown error occurred while fetching credentials.");
      }
    };

    fetchCredentials();
  }, []);

  return (
    <AwsCredentialsContext.Provider value={{ credentials }}>
      {children}
    </AwsCredentialsContext.Provider>
  );
};
