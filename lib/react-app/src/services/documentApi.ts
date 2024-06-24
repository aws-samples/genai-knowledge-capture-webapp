/**
 * This file contains the API-related functionality for calling the document summarization
 * and generation Lambda function, including the definition of the payload and response
 * types and the function to call the API.
 *
 * @module documentApi
 */

/**
 * Represents the payload required to call the document summarization and generation API.
 *
 * @interface DocumentApiPayload
 * @property {string} documentName - The name of the document to be generated, without the ".pdf" extension.
 * @property {string} questionText - The text of the question or topic to be addressed in the document.
 * @property {string} documentText - The text content of the document to be summarized and generated.
 */
export interface DocumentApiPayload {
  documentName: string;
  questionText: string;
  documentText: string;
}

/**
 * Represents the response from the document summarization and generation API.
 *
 * @interface DocumentApiResponse
 * @property {string} pdfFileS3Uri - The S3 URI of the generated PDF document.
 */
export interface DocumentApiResponse {
  pdfFileS3Uri: string;
}

const apiUrl = import.meta.env.VITE_API_URL;
const apiKeyValue = import.meta.env.VITE_API_KEY;

/**
 * Calls the document summarization and generation API to generate a PDF document.
 *
 * @function callDocumentApi
 * @param {DocumentApiPayload} payload - The payload containing the document details.
 * @returns {Promise<DocumentApiResponse | null>} - The API response, or `null` if the request failed.
 */
export const callDocumentApi = async (
  payload: DocumentApiPayload
): Promise<DocumentApiResponse | null> => {
  try {
    const response = await fetch(`${apiUrl}/summarize-and-generate`, {
      method: "POST",
      headers: {
        "x-api-key": apiKeyValue,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data;
  } catch (err) {
    console.error("Error generating document:", err);
    return null;
  }
};
