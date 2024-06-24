import { useState, useEffect, useRef, useCallback } from "react";

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
 *   - `audioBlobs`: An array of `Blob` objects containing the recorded audio data.
 *   - `startRecording`: A function that starts the audio recording process.
 *   - `stopRecording`: A function that stops the audio recording process.
 */
const useAudioRecorder = (
  audioStream: MediaStream | null
): [boolean, boolean, Blob[], () => Promise<void>, () => Promise<void>] => {
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

    const mediaRecorder = new MediaRecorder(audioStream);
    mediaRecorderRef.current = mediaRecorder;

    const audioBlobs: Blob[] = [];
    mediaRecorder.ondataavailable = (event) => {
      audioBlobs.push(event.data);
    };

    mediaRecorder.start();
    setIsRecording(true);
    setAudioBlobs([]);
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

  return [isReady, isRecording, audioBlobs, startRecording, stopRecording];
};

export default useAudioRecorder;
