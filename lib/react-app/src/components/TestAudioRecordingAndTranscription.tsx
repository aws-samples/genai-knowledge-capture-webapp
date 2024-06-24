import React, { useEffect, useState } from "react";
import { SystemAudioContext } from "../context/SystemAudioContext";
import useAudioRecorder from "../hooks/useAudioRecorder";
import useAudioTranscription from "../hooks/useAudioTranscription";
import { Button, Container } from "@cloudscape-design/components";

/**
  * Provides a simple user interface for testing the audio recording and audio transcription
  * functionality of the application. It uses the SystemAudioContext context to get the user's
  * system audio stream, uses the useAudioRecorder hook to manage the audio recording process,
  * and uses the useAudioTranscription hook to manage the audio transcription process. It
  * displays the recorded audio segments for playback and displays the transcribed text.
  * @component
  * @example
  * import TestAudioRecordingAndTranscription from './TestAudioRecordingAndTranscription';
  * 
  * const App = () => {
  *   return (
  *     <SystemAudioContext.Provider value={{ audioStream: ... }}>
  *       <TestAudioRecordingAndTranscription />
  *     </SystemAudioContext.Provider>
  *   );
  * };
  */
const TestAudioRecordingAndTranscription: React.FC = () => {
  const [transcription, setTranscription] = useState("");
  const { audioStream } = React.useContext(SystemAudioContext);
  const [
    isRecordingReady,
    isRecording,
    audioBlobs,
    startRecording,
    stopRecording,
  ] = useAudioRecorder(audioStream);
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

  // When an audio recording is complete, do something with it
  useEffect(() => {
    if (audioBlobs.length > 0) {
      console.log("Audio Blobs:", audioBlobs);
    }
  }, [audioBlobs]);

  const handleStartStop = async () => {
    if (!isRecording && !isTranscribing) {
      await startRecording();
      await startTranscription();
    } else {
      await stopRecording();
      await stopTranscription();
    }
  };

  return (
    <Container header={<h3>Test Audio Recording and Transcription</h3>}>
      <Button
        onClick={handleStartStop}
        iconAlign="left"
        iconName={isRecording ? "microphone" : "microphone-off"}
        variant={isRecording ? "primary" : "normal"}
        disabled={!isRecordingReady || !isTranscriptionReady}
      >
        {isRecording ? "Stop" : "Start"}
      </Button>
      <br />
      <br />
      <strong>Transcription Result:</strong>
      <br />
      {transcription}
      <br />
      <p>
        <strong>Recorded audio:</strong>
      </p>
      <div>
        {audioBlobs.map((blob, index) => (
          <div key={index}>
            <audio controls src={URL.createObjectURL(blob)}>
              Your browser does not support the audio element.
            </audio>
          </div>
        ))}
      </div>
    </Container>
  );
};

export default TestAudioRecordingAndTranscription;
