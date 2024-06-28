import { useContext, useState, useRef, useEffect, useCallback } from "react";
import {
  StartStreamTranscriptionCommand,
  TranscribeStreamingClient,
  TranscriptResultStream,
} from "@aws-sdk/client-transcribe-streaming";
import { AwsCredentialsContext } from "../context/AwsCredentialsContext";
import useAudioProcessing from "./useAudioProcessing";

const audioSampleRate = 48000;
const audioEncodingType = "pcm";
const transcribeLanguage = "en-US";

type TranscriptionProperties = { text: string; partial: boolean };

/**
 * A custom React hook called `useAudioTranscription` that provides a
 * reusable way to handle real-time audio transcription functionality in a
 * React application. It uses the AWS Transcribe Streaming API to perform
 * real-time audio transcription.
 *
 * @hook
 * @param {MediaStream | null} audioStream - A `MediaStream` object representing
 *   the user's system audio. This is used as the input for the audio transcription.
 * @returns {[
 *   boolean,
 *   boolean,
 *   TranscriptionProperties | null,
 *   () => Promise<void>,
 *   () => Promise<void>,
 *   () => void
 * ]}
 *   - `isReady`: Indicates whether the audio transcription is ready to be used.
 *   - `isTranscribing`: Indicates whether the audio is currently being transcribed.
 *     complete.
 *   - `startTranscription`: A function that starts the audio transcription process.
 *   - `stopTranscription`: A function that stops the audio transcription process.
 *   - `transcribeResponse`: An object containing the current transcription result,
 *     including the text and a flag indicating if it is a partial result.
 *   - `resetTranscriptionResult`: A function to reset the `transcriptionResult` state
 *     after it is consumed.
 */
const useAudioTranscription = (
  audioStream: MediaStream | null
): [
  boolean,
  boolean,
  () => Promise<void>,
  () => Promise<void>,
  TranscriptionProperties | null,
  () => void
] => {
  const [isReady, setIsReady] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeResponse, setTranscribeResponse] =
    useState<TranscriptionProperties | null>(null);
  const { credentials } = useContext(AwsCredentialsContext);

  const {
    createAudioWorkletNode,
    cleanupAudioWorklet,
    getAudioStreamGenerator,
  } = useAudioProcessing();

  const transcribeClientRef = useRef<TranscribeStreamingClient | null>(null);

  useEffect(() => {
    setIsReady(Boolean(audioStream && credentials));
  }, [audioStream, credentials]);

  const startTranscription = useCallback(async () => {
    try {
      if (!audioStream || !credentials) return;

      // Create Audio Worklet Node
      await createAudioWorkletNode(audioStream);

      // Create Transcribe client
      transcribeClientRef.current = new TranscribeStreamingClient({
        region: credentials.Region,
        credentials: {
          accessKeyId: credentials.AccessKeyId,
          secretAccessKey: credentials.SecretAccessKey,
          sessionToken: credentials.SessionToken,
        },
      });

      // Create Transcribe Start Command
      const transcribeStartCommand = new StartStreamTranscriptionCommand({
        LanguageCode: transcribeLanguage,
        MediaEncoding: audioEncodingType,
        MediaSampleRateHertz: audioSampleRate,
        AudioStream: getAudioStreamGenerator(),
      });

      // Start Transcribe session
      const data = await transcribeClientRef.current.send(
        transcribeStartCommand
      );
      console.log("Transcribe session established ", data.SessionId);
      setIsTranscribing(true);

      // Process Transcribe result stream
      if (data.TranscriptResultStream) {
        try {
          for await (const event of data.TranscriptResultStream) {
            handleTranscriptEvent(event, setTranscribeResponse);
          }
        } catch (error) {
          console.error("Error processing transcript result stream:", error);
        }
      }
    } catch (error) {
      console.error("Error starting transcription:", error);
    }
  }, [
    audioStream,
    credentials,
    createAudioWorkletNode,
    getAudioStreamGenerator,
  ]);

  const stopTranscription = useCallback(async () => {
    // Cleanup Audio Worklet Node
    await cleanupAudioWorklet();

    // Cleanup Transcribe client
    if (transcribeClientRef.current) {
      transcribeClientRef.current.destroy();
      transcribeClientRef.current = null;
    }

    setIsTranscribing(false);
    setTranscribeResponse(null);
  }, [cleanupAudioWorklet]);

  const resetTranscribeResponse = useCallback(() => {
    setTranscribeResponse(null);
  }, []);

  const handleTranscriptEvent = (
    event: TranscriptResultStream,
    setTranscriptionResult: React.Dispatch<
      React.SetStateAction<TranscriptionProperties | null>
    >
  ) => {
    const { Transcript } = event?.TranscriptEvent || {};
    if (!Transcript) return;

    const { Results: results = [] } = Transcript;
    for (const result of results) {
      const { Alternatives } = result || [];
      if (!Alternatives || !Alternatives[0].Items) continue;

      const items = Alternatives[0].Items;
      const completeSentence = items
        .map((item) => item.Content)
        .join(" ")
        .replace(/\s*(\.|,|\?)/g, "$1");
      const isPartial = result.IsPartial || false;

      setTranscriptionResult({ text: completeSentence, partial: isPartial });
    }
  };

  return [
    isReady,
    isTranscribing,
    startTranscription,
    stopTranscription,
    transcribeResponse,
    resetTranscribeResponse,
  ];
};

export default useAudioTranscription;
