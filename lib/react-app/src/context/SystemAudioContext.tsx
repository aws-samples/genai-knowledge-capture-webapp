import React, { createContext, useEffect, useState } from "react";

const audioSampleRate = 44100;  // Set the sample rate to 44.1 kHz
const audioSampleBitSize = 16;  // Set the sample size to 16 bits
const audioChannelCount = 1;    // Set the number of channels to 1 (mono)

interface SystemAudioContextValue {
  audioStream: MediaStream | null;
}

/**
 * Provides a React context for accessing the system audio stream.
 *
 * @context
 * @property {MediaStream | null} audioStream - The system audio stream.
 */
export const SystemAudioContext = createContext<SystemAudioContextValue>({
  audioStream: null,
});

interface SystemAudioProviderProps {
  children: React.ReactNode;
}

/**
 * Defines a React provider for accessing the system audio stream. The
 * `SystemAudioProvider` component uses the `navigator.mediaDevices.getUserMedia()`
 * API to retrieve the system audio stream and makes it available through the
 * `SystemAudioContext`.
 *
 * By using a React context, the `SystemAudioProvider` ensures that the user will be
 * prompted by the browser to grant permission to access the audio stream when the
 * application is first loaded.
 *
 * The context provides the following property:
 * - `audioStream`: A `MediaStream` object representing the user's system audio.
 *   This is used as the input for the audio transcription and recording hooks.
 *
 * @example
 * import { SystemAudioContext, SystemAudioProvider } from './SystemAudioContext';
 *
 * const App = () => {
 *   return (
 *     <SystemAudioProvider>
 *       {// Your application components //}
 *     </SystemAudioProvider>
 *   );
 * };
 */
export const SystemAudioProvider: React.FC<SystemAudioProviderProps> = ({
  children,
}) => {
  const [audioStream, setSystemAudio] = useState<MediaStream | null>(null);

  useEffect(() => {
    const getSystemAudio = async () => {

      const audioConstraints = {
        sampleRate: audioSampleRate,
        sampleSize: audioSampleBitSize,
        channelCount: audioChannelCount,
      }

      try {
        const systemAudio = await window.navigator.mediaDevices.getUserMedia({
          video: false,
          audio: audioConstraints,
        });
        setSystemAudio(systemAudio);
      } catch (error) {
        console.error("Error getting system audio:", error);
      }
    };

    getSystemAudio();
  }, []);

  return (
    <SystemAudioContext.Provider value={{ audioStream }}>
      {children}
    </SystemAudioContext.Provider>
  );
};
