import { useContext, useState, useRef, useEffect } from "react";
import {
  StartStreamTranscriptionCommand,
  TranscribeStreamingClient,
  TranscriptResultStream,
} from "@aws-sdk/client-transcribe-streaming";
import {
  AwsCredentialsContext,
  CredentialProperties,
} from "../context/AwsCredentialsContext";

const sampleRate = 48000;
const language = "en-US";

type TranscriptionProperties = {
  text: string;
  partial: boolean;
};

/**
 * Defines a custom React hook called `useAudioTranscription` that provides a
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
 *     including the text and a flag indicating if the transcription is partial or
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
  const [isReady, setIsReady] = useState<boolean>(false);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [transcribeResponse, setTranscribeResponse] =
    useState<TranscriptionProperties | null>(null);
  const { credentials } = useContext(AwsCredentialsContext);

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioWorkletRef = useRef<AudioWorkletNode | null>(null);
  const transcribeClientRef = useRef<TranscribeStreamingClient | null>(null);

  useEffect(() => {
    setIsReady(Boolean(audioStream && credentials));
  }, [audioStream, credentials]);

  const startTranscription = async () => {
    try {
      if (!audioStream || !credentials) {
        return;
      }

      transcribeClientRef.current = createTranscribeClient(credentials);
      if (!transcribeClientRef.current) {
        console.error("Transcribe client could not be created");
        return;
      }

      const audioWorklet = await createAudioWorklet(audioStream);
      if (!audioWorklet) {
        console.error("Failed to create audio recorder");
        return;
      }

      const command = createTranscriptionCommand(audioWorklet);
      const data = await transcribeClientRef.current.send(command);
      console.log("Transcribe session established ", data.SessionId);
      setIsTranscribing(true);

      if (data.TranscriptResultStream) {
        await processTranscriptStream(
          data.TranscriptResultStream,
          setTranscribeResponse
        );
      }
    } catch (error) {
      console.error("Error starting transcription:", error);
    }
  };

  const stopTranscription = async () => {
    if (audioWorkletRef.current) {
      cleanupAudioWorklet();
    }

    if (transcribeClientRef.current) {
      destroyTranscribeClient(transcribeClientRef.current);
      transcribeClientRef.current = null;
    }

    setIsTranscribing(false);
    resetTranscribeResponse();
  };

  const resetTranscribeResponse = () => {
    setTranscribeResponse(null);
  };

  const createTranscribeClient = (credentials: CredentialProperties) => {
    return new TranscribeStreamingClient({
      region: credentials.Region,
      credentials: {
        accessKeyId: credentials.AccessKeyId,
        secretAccessKey: credentials.SecretAccessKey,
        sessionToken: credentials.SessionToken,
      },
    });
  };

  const destroyTranscribeClient = (client: TranscribeStreamingClient) => {
    console.log("Transcribe session ended");
    client.destroy();
  };

  const createAudioWorklet = async (
    audioStream: MediaStream
  ): Promise<AudioWorkletNode | null> => {
    const audioContext = new AudioContext();
    audioContextRef.current = audioContext;

    const audioStreamSource = audioContext.createMediaStreamSource(audioStream);

    const audioProcessingOptions = {
      numberOfChannels: 1,
      sampleRate: audioContext.sampleRate,
      maxFrameCount: (audioContext.sampleRate * 1) / 10,
    };

    try {
      await audioContext.audioWorklet.addModule(
        "./worklets/audio-processor.js"
      );
    } catch (error) {
      console.log(`Error adding audio processor worklet: ${error}`);
    }

    const audioWorklet = new AudioWorkletNode(audioContext, "audio-processor", {
      processorOptions: audioProcessingOptions,
    });
    audioWorkletRef.current = audioWorklet;

    const audioStreamDestination = audioContext.createMediaStreamDestination();
    audioStreamSource.connect(audioWorklet).connect(audioStreamDestination);

    audioWorklet.port.postMessage({
      message: "UPDATE_RECORDING_STATE",
      setRecording: true,
    });

    audioWorklet.port.onmessageerror = (error) => {
      console.log(`Error receiving message from worklet ${error}`);
    };

    return audioWorklet;
  };

  const cleanupAudioWorklet = () => {
    const audioWorklet = audioWorkletRef.current;
    const audioContext = audioContextRef.current;

    if (audioWorklet) {
      audioWorklet.port.postMessage({
        message: "UPDATE_RECORDING_STATE",
        setRecording: false,
      });
      audioWorklet.port.close();
      audioWorklet.disconnect();
    }

    if (audioContext && audioContext.state !== "closed") {
      audioContext.close();
      audioContextRef.current = null;
    }
  };

  const createTranscriptionCommand = (audioRecorder: AudioWorkletNode) => {
    return new StartStreamTranscriptionCommand({
      LanguageCode: language,
      MediaEncoding: "pcm",
      MediaSampleRateHertz: sampleRate,
      AudioStream: getAudioStreamGenerator(audioRecorder),
    });
  };

  const processTranscriptStream = async (
    transcriptStream: AsyncIterable<TranscriptResultStream>,
    setTranscriptionResult: React.Dispatch<
      React.SetStateAction<TranscriptionProperties | null>
    >
  ) => {
    try {
      for await (const event of transcriptStream) {
        handleTranscriptEvent(event, setTranscriptionResult);
      }
    } catch (error) {
      console.error("Error processing transcript audioStream:", error);
    }
  };

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

      setTranscriptionResult({
        text: completeSentence,
        partial: isPartial,
      });
    }
  };

  const getAudioStreamGenerator = async function* (
    mediaRecorder: AudioWorkletNode
  ) {
    const audioEventIterator = createAudioEventIterator(mediaRecorder);

    for await (const chunk of audioEventIterator) {
      if (chunk.data.message === "SHARE_RECORDING_BUFFER") {
        const audioBuffer = chunk.data.buffer[0];
        const pcmEncodedBuffer = pcmEncode(audioBuffer);
        const audioData = new Uint8Array(pcmEncodedBuffer);
        yield {
          AudioEvent: {
            AudioChunk: audioData,
          },
        };
      }
    }
  };

  const createAudioEventIterator = async function* (
    mediaRecorder: AudioWorkletNode
  ): AsyncIterable<MessageEvent> {
    try {
      while (true) {
        const event = await new Promise<MessageEvent>((resolve) => {
          const handleEvent = (e: MessageEvent) => {
            resolve(e);
          };
          mediaRecorder.port.onmessage = handleEvent;
        });
        yield event;
      }
    } finally {
      mediaRecorder.port.onmessage = null;
    }
  };

  const pcmEncode = (input: Float32Array) => {
    const buffer = new ArrayBuffer(input.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buffer;
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
