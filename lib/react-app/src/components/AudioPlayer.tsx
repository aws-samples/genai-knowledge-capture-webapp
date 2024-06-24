import { Button } from "@cloudscape-design/components";
import { useEffect, useRef, useState } from "react";

/**
 * The `AudioPlayer` component provides a reusable way to play and control audio recordings
 * in a React application.
 *
 * @component
 * @example
 * import AudioPlayer from './AudioPlayer';
 *
 * {recordings.map((recording, index) => (
 *   <AudioPlayer key={index} index={index} recording={recording} isDisabled={isDisabled} />
 * ))}
 *
 * @param {Object} props - The component's props.
 * @param {number} props.index - The index of the current audio recording.
 * @param {Blob} props.recording - The audio data to be played.
 * @param {boolean} props.isDisabled - Whether the audio player should be disabled.
 * @returns {JSX.Element} - The `AudioPlayer` component.
 */
function AudioPlayer({
  index,
  recording,
  isDisabled,
}: {
  index: number;
  recording: Blob;
  isDisabled: boolean;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleAudioClick = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      } else {
        audioRef.current.play();
      }
      setIsPlaying((prevState) => !prevState);
    }
  };

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.src = URL.createObjectURL(recording);

      const handleAudioEnded = () => {
        setIsPlaying(false);
      };

      audioRef.current.addEventListener("ended", handleAudioEnded);
      const audioElement = audioRef.current;

      return () => {
        audioElement?.removeEventListener("ended", handleAudioEnded);
      };
    }
  }, [recording]);

  return (
    <div>
      <Button
        onClick={handleAudioClick}
        variant={isPlaying ? "primary" : "normal"}
        iconAlign="left"
        iconName={!isPlaying ? "caret-right-filled" : "audio-full"}
        ariaLabel={isPlaying ? "Stop audio" : `Play audio ${index + 1}`}
        disabled={isDisabled}
      />
      <audio ref={audioRef} style={{ display: "none" }} />
    </div>
  );
}

export default AudioPlayer;
