import React, { useCallback, useEffect, useState } from "react";
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
import useAudioRecorder from "../hooks/useAudioRecorder";
import useAudioTranscription from "../hooks/useAudioTranscription";
import { callDocumentApi } from "../services/documentApi";
import AudioPlayer from "./AudioPlayer";

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
  const [recordings, setRecordings] = useState<Blob[]>([]);
  const [partialTranscribeResponse, setPartialTranscribeResponse] =
    useState("");
  const [documentLink, setDocumentLink] = useState<string | null>(null);
  const [audioLinks, setAudioLinks] = useState<string[]>([]);
  const [isGeneratingDocument, setIsGeneratingDocument] = useState(false);
  const [alert, setAlert] = useState(false);

  const { audioStream } = React.useContext(SystemAudioContext);
  const [
    isRecordingReady,
    isRecording,
    startRecording,
    stopRecording,
    audioBlobs,
    resetAudioBlobs,
  ] = useAudioRecorder(audioStream);
  const [
    isTranscriptionReady,
    isTranscribing,
    startTranscription,
    stopTranscription,
    transcribeResponse,
    resetTranscribeResponse,
  ] = useAudioTranscription(audioStream);

  // Handle Start Transcription / Stop Transcription button click
  const handleStartStop = async () => {
    if (!isTranscribing) {
      // Clear links to previously created artifacts
      setAudioLinks([]);
      setDocumentLink(null);
      // Start recording and transcription
      await startRecording();
      await startTranscription();
    } else {
      // Stop recording and transcription
      await stopRecording();
      await stopTranscription();
      // Capture any partial transcription remaining
      if (transcribeResponse) {
        appendAnswer(transcribeResponse.text);
      }
    }
  };

  // Handle manual editing of transcribed answer
  const handleManualAnswerChange = (newAnswer: string) => {
    setAnswer(newAnswer);
  };

  // Handle Generate Document button click
  const generateDocument = async () => {
    setIsGeneratingDocument(true);
    setDocumentLink(null);
    setAudioLinks([]);

    const response = await callDocumentApi(
      filename,
      question,
      answer,
      recordings
    );
    if (response?.pdfFileS3Uri && response?.audioS3Uris) {
      setDocumentLink(response.pdfFileS3Uri);
      setAudioLinks(response.audioS3Uris);
    } else {
      setAlert(true);
    }
    setIsGeneratingDocument(false);
  };

  // Append transcription text to user's answer
  const appendAnswer = useCallback(
    (text: string) => {
      console.log("Transcription captured:", text);
      setAnswer(`${answer} ${text}`.trim());
      setPartialTranscribeResponse("");
      resetTranscribeResponse();
    },
    [answer, resetTranscribeResponse]
  );

  // When an audio recording is complete, add it to the existing recording
  useEffect(() => {
    if (audioBlobs.length > 0) {
      console.log("Recording captured:", audioBlobs);
      setRecordings((prev) => [...prev, ...audioBlobs]);
      resetAudioBlobs();
    }
  }, [audioBlobs, recordings, resetAudioBlobs]);

  // When new transcription is complete, append it to the existing answer text
  useEffect(() => {
    if (transcribeResponse) {
      if (transcribeResponse.partial) {
        setPartialTranscribeResponse(transcribeResponse.text);
      } else {
        appendAnswer(transcribeResponse.text);
      }
    }
  }, [appendAnswer, transcribeResponse]);

  return (
    <Box margin="xl">
      <SpaceBetween direction="vertical" size="xl">
        {alert && (
          <Alert
            dismissible
            statusIconAriaLabel="Error"
            type="error"
            header="There was an error with your request"
            onDismiss={() => setAlert(false)}
          ></Alert>
        )}
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
            value={`${answer}${partialTranscribeResponse ? " " : ""}${partialTranscribeResponse}`}
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

        {recordings.length > 0 && (
          <FormField
            label="Recorded Audio"
            description={
              audioLinks.length === 0
                ? "Use the Play buttons to play the recorded audio clips."
                : "Use the Download buttons to open the saved audio files, or right-click and choose Save As."
            }
          >
            <SpaceBetween direction="horizontal" size="xs">
              {recordings.length > 0 &&
                audioLinks.length === 0 &&
                recordings.map((recording, index) => (
                  <AudioPlayer
                    key={index}
                    index={index}
                    recording={recording}
                    isDisabled={isRecording || isGeneratingDocument}
                  />
                ))}
              {audioLinks.length > 0 &&
                audioLinks.map((link, index) => (
                  <Button
                    key={index}
                    href={link}
                    target="_blank"
                    iconAlign="left"
                    iconName="download"
                    ariaLabel={`Download audio ${index + 1}`}
                  ></Button>
                ))}
            </SpaceBetween>
          </FormField>
        )}

        <div style={{ marginTop: "10px" }}>
          <SpaceBetween direction="horizontal" size="xl">
            <Button
              onClick={handleStartStop}
              iconAlign="left"
              iconName={isTranscribing ? "microphone" : "microphone-off"}
              variant={isTranscribing ? "primary" : "normal"}
              disabled={
                !isRecordingReady ||
                !isTranscriptionReady ||
                isGeneratingDocument
              }
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
                  Generating Document{" "}
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
                    isRecording ||
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
  );
};

export default TranscribeForm;
