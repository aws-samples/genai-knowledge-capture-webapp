import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  FormField,
  Input,
  SpaceBetween,
  Spinner,
  Textarea,
} from "@cloudscape-design/components";
import { SystemAudioContext } from "../context/SystemAudioContext";
import useAudioTranscription from "../hooks/useAudioTranscription";
import { callDocumentApi, DocumentApiPayload } from "../services/documentApi";

/**
 * Provides the input form for the document summarization and generation functionality.
 * It captures audio transcriptions using Amazon Transcribe's streaming transcription
 * capabilities. It uses the SystemAudioContext context to get the user's system audio
 * stream, uses the useAudioTranscription hook to manage the audio transcription process,
 * and uses the useAudioRecorder hook to manage audio recording. It displays the
 * transcribed text for editing, and provides a form for submitting the transcribed text
 * to the backend API for document generation.
 *
 * @component
 * @example
 * import TranscribeForm from './TranscribeForm';
 *
 * const App = () => {
 *   return (
 *     <SystemAudioContext.Provider value={{ audioStream: ... }}>
 *       <TranscribeForm />
 *     </SystemAudioContext.Provider>
 *   );
 * };
 */
const TranscribeForm: React.FC = () => {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [filename, setFilename] = useState("");
  const [alert, setAlert] = useState(false);
  const [documentLink, setDocumentLink] = useState<string | null>(null);
  const [isGeneratingDocument, setIsGeneratingDocument] = useState(false);

  const { audioStream } = React.useContext(SystemAudioContext);
  const [
    isTranscriptionReady,
    isTranscribing,
    transcriptionResult,
    startTranscription,
    stopTranscription,
    resetTranscriptionResult,
  ] = useAudioTranscription(audioStream);

  const handleStartStop = async () => {
    if (!isTranscribing) {
      await startTranscription();
    } else {
      await stopTranscription();
    }
  };

  const handleManualAnswerChange = (newAnswer: string) => {
    setAnswer(newAnswer);
  };

  const generateDocument = async () => {
    setIsGeneratingDocument(true);
    setDocumentLink(null);

    const payload: DocumentApiPayload = {
      documentName: filename.endsWith(".pdf")
        ? filename.replace(".pdf", "")
        : filename,
      questionText: question,
      documentText: answer,
    };

    const response = await callDocumentApi(payload);
    if (response?.pdfFileS3Uri) {
      setDocumentLink(response.pdfFileS3Uri);
    } else {
      setAlert(true);
    }
    setIsGeneratingDocument(false);
  };

  // When new transcription is complete, append it to the existing text
  useEffect(() => {
    if (transcriptionResult && !transcriptionResult.partial) {
      console.log("Transcription:", transcriptionResult.text);
      setAnswer(`${answer} ${transcriptionResult.text}`.trim());
      resetTranscriptionResult();
    }
  }, [answer, resetTranscriptionResult, transcriptionResult]);

  return (
    <SpaceBetween direction="vertical" size="s">
      {alert && (
        <Alert
          dismissible
          statusIconAriaLabel="Error"
          type="error"
          header="There was an error with your request"
          onDismiss={() => setAlert(false)}
        ></Alert>
      )}
      <Box margin="xl">
        <SpaceBetween direction="vertical" size="s">
          <FormField
            description="Enter the question or topic here."
            label="Question"
          >
            <Input
              value={question}
              autoComplete={false}
              onChange={(event) => setQuestion(event.detail.value)}
              disabled={isGeneratingDocument || isTranscribing}
            />
          </FormField>

          <FormField
            description="The live transcription results will appear here. You can manually edit the text if needed."
            label="Transcription"
            stretch={true}
          >
            <Textarea
              value={answer}
              autoComplete={false}
              onChange={(event) => handleManualAnswerChange(event.detail.value)}
              rows={10}
              readOnly={isTranscribing}
              disabled={isGeneratingDocument}
            />
          </FormField>

          <FormField
            label="Filename"
            description="Enter a filename for the generated PDF."
          >
            <div style={{ width: "100%", maxWidth: "250px" }}>
              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <Input
                  value={filename}
                  autoComplete={false}
                  onChange={(event) => setFilename(event.detail.value)}
                  disabled={isGeneratingDocument || isTranscribing}
                />
                <span
                  style={{
                    marginLeft: "2px",
                    fontWeight: "550",
                    color: "darkslategray",
                  }}
                >
                  .pdf
                </span>
              </div>
            </div>
          </FormField>

          <div style={{ marginTop: "10px" }}>
            <SpaceBetween direction="horizontal" size="xl">
              <Button
                onClick={handleStartStop}
                iconAlign="left"
                iconName={isTranscribing ? "microphone" : "microphone-off"}
                variant={isTranscribing ? "primary" : "normal"}
                disabled={!isTranscriptionReady || isGeneratingDocument}
              >
                {isTranscribing ? "Stop Transcription" : "Start Transcription"}
              </Button>
              {!isGeneratingDocument && (
                <div>
                  <Button
                    onClick={generateDocument}
                    iconAlign="right"
                    iconName="upload"
                    variant="normal"
                    disabled={
                      !answer ||
                      !filename ||
                      isGeneratingDocument ||
                      isTranscribing
                    }
                  >
                    Generate Document
                  </Button>
                </div>
              )}
              {isGeneratingDocument && (
                <div>
                  <Button variant="primary">
                    Generate Document{" "}
                    <span>
                      <Spinner size="normal" />
                    </span>
                  </Button>
                </div>
              )}
              <div>
                {documentLink && (
                  <Button
                    href={documentLink}
                    target="_blank"
                    iconAlign="left"
                    iconName="file"
                    variant="normal"
                    disabled={
                      !answer ||
                      !documentLink ||
                      isGeneratingDocument ||
                      isTranscribing
                    }
                  >
                    View Document
                  </Button>
                )}
              </div>
            </SpaceBetween>
          </div>
        </SpaceBetween>
      </Box>
    </SpaceBetween>
  );
};

export default TranscribeForm;
