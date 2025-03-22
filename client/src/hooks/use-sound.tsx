import { useEffect, useRef, useState } from "react";

type SoundOptions = {
  volume?: number;
  loop?: boolean;
  autoplay?: boolean;
};

const defaultOptions: SoundOptions = {
  volume: 0.5,
  loop: false,
  autoplay: false,
};

type SoundEffects = {
  [key: string]: string;
};

// Sound effect URLs
const SOUND_EFFECTS: SoundEffects = {
  win: "https://cdn.freesound.org/previews/536/536108_11861866-lq.mp3",
  lose: "https://cdn.freesound.org/previews/385/385052_7094838-lq.mp3",
  click: "https://cdn.freesound.org/previews/242/242501_3509815-lq.mp3",
  slotSpin: "https://cdn.freesound.org/previews/240/240776_4107740-lq.mp3",
  diceRoll: "https://cdn.freesound.org/previews/240/240777_4107740-lq.mp3",
  cashout: "https://cdn.freesound.org/previews/536/536109_11861866-lq.mp3",
  crash: "https://cdn.freesound.org/previews/369/369953_6687639-lq.mp3",
};

export function useSound() {
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});
  const [isEnabled, setIsEnabled] = useState<boolean>(true);

  useEffect(() => {
    // Preload all sounds
    Object.entries(SOUND_EFFECTS).forEach(([key, url]) => {
      const audio = new Audio();
      audio.src = url;
      audio.preload = "auto";
      audioRefs.current[key] = audio;
    });

    // Cleanup on unmount
    return () => {
      Object.values(audioRefs.current).forEach((audio) => {
        audio.pause();
        audio.src = "";
      });
    };
  }, []);

  const play = (soundName: string, options?: SoundOptions) => {
    if (!isEnabled) return;

    const audio = audioRefs.current[soundName];
    if (!audio) return;

    const { volume, loop, autoplay } = { ...defaultOptions, ...options };

    // Reset the audio to the beginning
    audio.currentTime = 0;
    audio.volume = volume || 0.5;
    audio.loop = loop || false;
    
    // Play the sound
    audio.play().catch((e) => console.error("Error playing sound:", e));
  };

  const stop = (soundName: string) => {
    const audio = audioRefs.current[soundName];
    if (!audio) return;
    
    audio.pause();
    audio.currentTime = 0;
  };

  const toggleSound = () => {
    setIsEnabled((prev) => !prev);
    
    // If disabling, stop all currently playing sounds
    if (isEnabled) {
      Object.values(audioRefs.current).forEach((audio) => {
        audio.pause();
        audio.currentTime = 0;
      });
    }
  };

  return { play, stop, isEnabled, toggleSound };
}
