import { useState } from "react";
import { joinMatch } from "../lib/api";

/**
 * The same key the home page writes. A player who set their name there and then clicked a
 * shared link should not be asked for it twice.
 */
const NAME_KEY = "stonk_nickname";

function savedName() {
  try {
    return localStorage.getItem(NAME_KEY) || "";
  } catch {
    return "";
  }
}

/**
 * What somebody sees when a shared link lands them in a room they have no seat in.
 *
 * For a lot of players this is the first screen of the game they ever see — they were sent
 * a link, not a pitch — so it says what the game is before it asks for anything.
 */
export default function JoinGate({ code, onSeated }) {
  const [nickname, setNickname] = useState(savedName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const updateNickname = (val) => {
    setNickname(val);
    try {
      localStorage.setItem(NAME_KEY, val);
    } catch {
      // ignore storage error
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!nickname.trim()) return;
    setBusy(true);
    setError(null);
    try {
      onSeated(await joinMatch(code.toUpperCase(), nickname.trim()));
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <main className="center-page">
      <header className="hero">
        <p className="eyebrow">You've been invited to</p>
        <h1 className="display hero-code">{code.toUpperCase()}</h1>
        <p className="join-pitch">
          <strong>Stonk Royale</strong> — everyone gets a private tip about the same coin.
          Most of the tips are lies. Trade it anyway.
        </p>
      </header>

      <form className="panel sheet stack" onSubmit={submit}>
        <label className="stack" style={{ gap: "0.35rem" }}>
          <span className="eyebrow">Your name</span>
          <input
            className="field"
            value={nickname}
            onChange={(e) => updateNickname(e.target.value)}
            placeholder="what should they call you"
            maxLength={16}
            autoFocus
          />
        </label>

        <button className="btn btn-big btn-scream" type="submit" disabled={busy}>
          Take a seat
        </button>

        {error && <p className="notice notice-bad">{error}</p>}
      </form>
    </main>
  );
}
