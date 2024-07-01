import { useRef, useEffect, useCallback } from "react";

/**
 * A custom React hook that provides functionality for audio processing and
 * audio worklet management. It is used in conjunction with the `useAudioTranscription`
 * hook to handle the audio processing and streaming requirements for real-time
 * audio transcription using the AWS Transcribe Streaming API.
 *
 * @hook
 * @param {MediaStream} audioStream - The audio stream to be processed.
 * @returns {Object}
 *   - `createAudioWorkletNode`: A function that creates an `AudioWorkletNode` for
 *     processing the audio stream.
 *   - `cleanupAudioWorklet`: A function that cleans up the `AudioWorkletNode` and
 *     the `AudioContext`.
 *   - `getAudioStreamGenerator`: A function that generates an async iterable that
 *     streams the encoded audio data to the Transcribe Streaming API.
 */
const useAudioProcessing = () => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioWorkletNodeRef = useRef<AudioWorkletNode | null>(null);

  const createAudioWorkletNode = useCallback(
    async (audioStream: MediaStream) => {
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const audioStreamSource =
        audioContext.createMediaStreamSource(audioStream);

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
        return null;
      }

      const audioWorkletNode = new AudioWorkletNode(
        audioContext,
        "audio-processor",
        {
          processorOptions: audioProcessingOptions,
        }
      );
      audioWorkletNodeRef.current = audioWorkletNode;

      const audioStreamDestination =
        audioContext.createMediaStreamDestination();
      audioStreamSource
        .connect(audioWorkletNode)
        .connect(audioStreamDestination);

      audioWorkletNode.port.postMessage({
        message: "UPDATE_RECORDING_STATE",
        setRecording: true,
      });
      audioWorkletNode.port.onmessageerror = (error) =>
        console.log(`Error receiving message from worklet ${error}`);

      return audioWorkletNode;
    },
    []
  );

  const cleanupAudioWorklet = useCallback(() => {
    if (audioWorkletNodeRef.current) {
      audioWorkletNodeRef.current.port.postMessage({
        message: "UPDATE_RECORDING_STATE",
        setRecording: false,
      });
      audioWorkletNodeRef.current.port.close();
      audioWorkletNodeRef.current.disconnect();
      audioWorkletNodeRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, []);

  const createAudioEventIterator = useCallback(
    async function* (): AsyncIterable<MessageEvent> {
      const audioWorkletNode = audioWorkletNodeRef.current;
      if (!audioWorkletNode) {
        return;
      }

      try {
        while (true) {
          const event = await new Promise<MessageEvent>((resolve) => {
            const handleEvent = (e: MessageEvent) => resolve(e);
            audioWorkletNode.port.onmessage = handleEvent;
          });
          yield event;
        }
      } finally {
        audioWorkletNode.port.onmessage = null;
      }
    },
    [audioWorkletNodeRef]
  );

  const pcmEncode = useCallback((input: Float32Array) => {
    const buffer = new ArrayBuffer(input.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buffer;
  }, []);

  const getAudioStreamGenerator = useCallback(
    async function* () {
      const audioWorkletNode = audioWorkletNodeRef.current;
      if (!audioWorkletNode) return;

      const audioEventIterator = await createAudioEventIterator();

      for await (const chunk of audioEventIterator) {
        if (chunk.data.message === "SHARE_RECORDING_BUFFER") {
          const audioBuffer = chunk.data.buffer[0];
          const pcmEncodedBuffer = pcmEncode(audioBuffer);
          const audioData = new Uint8Array(pcmEncodedBuffer);
          yield { AudioEvent: { AudioChunk: audioData } };
        }
      }
    },
    [createAudioEventIterator, pcmEncode]
  );

  useEffect(() => {
    return () => {
      if (audioWorkletNodeRef.current) {
        cleanupAudioWorklet();
      }
    };
  }, [cleanupAudioWorklet]);

  return {
    createAudioWorkletNode,
    cleanupAudioWorklet,
    getAudioStreamGenerator,
  };
};

export default useAudioProcessing;
