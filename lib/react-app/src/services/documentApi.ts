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
  audioFiles: string[];
}

/**
 * Represents the response from the document summarization and generation API.
 *
 * @interface DocumentApiResponse
 * @property {string} pdfFileS3Uri - The S3 URI of the generated PDF document.
 */
export interface DocumentApiResponse {
  pdfFileS3Uri: string;
  audioS3Uris: string[];
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
  filename: string,
  question: string,
  answer: string,
  audioFiles: Blob[],
): Promise<DocumentApiResponse | null> => {
  const base64Array: string[] = [];

  // Convert each audio file Blob to a base64-encoded string
  for (const audioFile of audioFiles) {
    const base64 = await blobToBase64(audioFile);
    base64Array.push(base64);
  }

  // Generate the API payload
  const payload: DocumentApiPayload = {
    documentName: filename.endsWith(".pdf")
      ? filename.replace(".pdf", "")
      : filename,
    questionText: question,
    documentText: answer,
    audioFiles: base64Array,
  };

  // Call the API
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

// Helper function to convert a Blob to a base64-encoded string
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.split(',')[1]);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(blob);
  });
}
