import { useState } from "react";
import { joinMatch } from "../lib/api";

export default function JoinGate({ code, onSeated }) {
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

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
      </header>

      <form className="panel sheet stack" onSubmit={submit}>
        <label className="stack" style={{ gap: "0.35rem" }}>
          <span className="eyebrow">Your name</span>
          <input
            className="field"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
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
