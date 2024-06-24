import React, { useEffect, useState } from "react";
import { SystemAudioContext } from "../context/SystemAudioContext";
import useAudioTranscription from "../hooks/useAudioTranscription";
import { Button, Container } from "@cloudscape-design/components";

/**
  * Provides a simple user interface for testing the audio transcription
  * functionality of the application. It uses the SystemAudioContext
  * context to get the user's system audio stream, and uses the
  * useAudioTranscription hook to manage the audio transcription process.
  * It displays the transcribed text.
  * @component
  * @example
  * import TestAudioTranscription from './TestAudioTranscription';
  * 
  * const App = () => {
  *   return (
  *     <SystemAudioContext.Provider value={{ audioStream: ... }}>
  *       <TestAudioTranscription />
  *     </SystemAudioContext.Provider>
  *   );
  * };
  */
const TestAudioTranscription: React.FC = () => {
  const [transcription, setTranscription] = useState("");
  const { audioStream } = React.useContext(SystemAudioContext);
  const [
    isTranscriptionReady,
    isTranscribing,
    transcriptionResult,
    startTranscription,
    stopTranscription,
    resetTranscriptionResult,
  ] = useAudioTranscription(audioStream);

  // When new transcription is complete, append it to the previous text
  useEffect(() => {
    if (transcriptionResult && !transcriptionResult.partial) {
      console.log("Transcription:", transcriptionResult.text);
      setTranscription(`${transcription} ${transcriptionResult.text}`.trim());
      resetTranscriptionResult();
    }
  }, [resetTranscriptionResult, transcription, transcriptionResult]);

  const handleStartStop = async () => {
    if (!isTranscribing) {
      await startTranscription();
    } else {
      await stopTranscription();
    }
  };

  return (
    <Container header={<h3>Test Audio Transcription</h3>}>
      <Button
        onClick={handleStartStop}
        iconAlign="left"
        iconName={isTranscribing ? "microphone" : "microphone-off"}
        variant={isTranscribing ? "primary" : "normal"}
        disabled={!isTranscriptionReady}
      >
        {isTranscribing ? "Stop" : "Start"}
      </Button>
      <br />
      <br />
      <strong>Transcription Result:</strong>
      <br />
      {transcription}
    </Container>
  );
};

export default TestAudioTranscription;
