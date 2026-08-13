import { useState } from "react";
import { isMuted, setMuted, sound } from "../lib/sound";

export default function MuteToggle() {
  const [off, setOff] = useState(isMuted());

  const toggle = () => {
    const next = !off;
    setMuted(next);
    setOff(next);
    // Unmuting plays a cue, which both confirms the change and unlocks the audio
    // context while the click is still counted as a user gesture.
    if (!next) sound.open();
  };

  return (
    <button
      className="corner-tab mute mono"
      onClick={toggle}
      aria-pressed={off}
      title={off ? "Turn sound on" : "Turn sound off"}
    >
      {off ? "SOUND OFF" : "SOUND ON"}
    </button>
  );
}
