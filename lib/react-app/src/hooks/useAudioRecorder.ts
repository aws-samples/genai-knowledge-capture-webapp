import { useState, useEffect, useRef, useCallback } from "react";

const audioMimeType = "audio/webm;codecs=opus";  // Set audio file type to "webm"
const audioBitsPerSecond = 128000;               // Set audio kbps to 128

/**
 * Defines a custom React hook called `useAudioRecorder` that provides a reusable way
 * to handle audio recording functionality in a React application.
 *
 * @hook
 * @param {MediaStream | null} audioStream - A `MediaStream` object representing the
 *   user's system audio. This is used as the input for the audio recording.
 * @returns {[boolean, boolean, Blob[], () => Promise<void>, () => Promise<void>]}
 *   - `isReady`: Indicates whether the audio recording is ready to be used.
 *   - `isRecording`: Indicates whether the audio is currently being recorded.
 *   - `startRecording`: A function that starts the audio recording process.
 *   - `stopRecording`: A function that stops the audio recording process.
 *   - `audioBlobs`: An array of `Blob` objects containing the recorded audio data.
 *   - `resetAudioBlobs`: A function to reset the `audioBlobs` state after it is consumed.
 */
const useAudioRecorder = (
  audioStream: MediaStream | null
): [
  boolean,
  boolean,
  () => Promise<void>,
  () => Promise<void>,
  Blob[],
  () => void
] => {
  const [isReady, setIsReady] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [audioBlobs, setAudioBlobs] = useState<Blob[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    setIsReady(Boolean(audioStream));
    if (audioStream) {
      return () => {
        if (mediaRecorderRef.current) {
          mediaRecorderRef.current.stop();
        }
      };
    }
  }, [audioStream]);

  const startRecording = useCallback(async () => {
    if (!audioStream) return;

    const mediaRecorderOptions: MediaRecorderOptions = {
      mimeType: audioMimeType,
      audioBitsPerSecond: audioBitsPerSecond,
    };

    const mediaRecorder = new MediaRecorder(audioStream, mediaRecorderOptions);
    mediaRecorderRef.current = mediaRecorder;

    const audioBlobs: Blob[] = [];
    mediaRecorder.ondataavailable = (event) => {
      audioBlobs.push(event.data);
    };

    resetAudioBlobs();
    setIsRecording(true);
    mediaRecorder.start();
    console.log("Audio recording started.");
  }, [audioStream]);

  const stopRecording = useCallback(async () => {
    if (!mediaRecorderRef.current) return;

    mediaRecorderRef.current.stop();
    setIsRecording(false);

    const audioBlobs = await new Promise<Blob[]>((resolve) => {
      mediaRecorderRef.current?.addEventListener("dataavailable", (event) => {
        resolve([event.data]);
      });
    });
    setAudioBlobs(audioBlobs);

    mediaRecorderRef.current = null;
    console.log("Audio recording stopped.");
  }, []);

  const resetAudioBlobs = () => {
    setAudioBlobs([]);
  };

  return [
    isReady,
    isRecording,
    startRecording,
    stopRecording,
    audioBlobs,
    resetAudioBlobs,
  ];
};

export default useAudioRecorder;
