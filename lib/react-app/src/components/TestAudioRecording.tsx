import React, { useEffect } from "react";
import useAudioRecorder from "../hooks/useAudioRecorder";
import { SystemAudioContext } from "../context/SystemAudioContext";
import { Button, Container } from "@cloudscape-design/components";

/**
  * Provides a simple user interface for testing the audio recording functionality of the
  * application. It uses the SystemAudioContext context to get the user's system audio stream,
  * and uses the useAudioRecorder hook to manage the audio recording process. It displays the
  * recorded audio segments for playback.
  * @component
  * @example
  * import TestAudioRecording from './TestAudioRecording';
  * 
  * const App = () => {
  *   return (
  *     <SystemAudioContext.Provider value={{ audioStream: ... }}>
  *       <TestAudioRecording />
  *     </SystemAudioContext.Provider>
  *   );
  * };
  */
const TestAudioRecording: React.FC = () => {
  const { audioStream } = React.useContext(SystemAudioContext);
  const [
    isRecordingReady,
    isRecording,
    audioBlobs,
    startRecording,
    stopRecording,
  ] = useAudioRecorder(audioStream);

  // When an audio recording is complete, do something with it
  useEffect(() => {
    if (audioBlobs.length > 0) {
      console.log("Audio Blobs:", audioBlobs);
    }
  }, [audioBlobs]);

  const handleStartStop = async () => {
    if (!isRecording) {
      await startRecording();
    } else {
      await stopRecording();
    }
  };

  return (
    <Container header={<h3>Test Audio Recording</h3>}>
      <Button
        onClick={handleStartStop}
        iconAlign="left"
        iconName={isRecording ? "microphone" : "microphone-off"}
        variant={isRecording ? "primary" : "normal"}
        disabled={!isRecordingReady}
      >
        {isRecording ? "Stop" : "Start"}
      </Button>
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

export default TestAudioRecording;
