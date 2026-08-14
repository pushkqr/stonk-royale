import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createMatch, joinMatch, practiceMatch } from "../lib/api";
import { authAvailable, signIn } from "../lib/auth";
import { saveSeat } from "../lib/session";
import { DEFAULTS } from "../lib/matchSettings";
import MatchSettings from "../components/MatchSettings";

export default function Home() {
  const navigate = useNavigate();
  const [nickname, setNickname] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [token, setToken] = useState(null);
  const [settings, setSettings] = useState(DEFAULTS);
  const [showSettings, setShowSettings] = useState(false);

  const go = async (action) => {
    if (!nickname.trim()) {
      setError("Pick a name first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const seat = await action();
      saveSeat(seat);
      navigate(`/m/${seat.code}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const host = () => go(() => createMatch(nickname.trim(), settings, token));

  const join = (event) => {
    event.preventDefault();
    if (code.trim().length !== 5) {
      setError("Codes are five characters.");
      return;
    }
    go(() => joinMatch(code.trim().toUpperCase(), nickname.trim(), token));
  };

  return (
    <main className="center-page">
      <header className="hero">
        <h1 className="display hero-title">
          Stonk<span className="hero-title-break">Royale</span>
        </h1>
        <p className="hero-sub">
          Ten minutes. Five rounds. Everyone gets a tip, and
          <em> most of them are lies.</em>
        </p>
      </header>

      <div className="panel sheet stack">
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

        <MatchSettings
          settings={settings}
          onChange={setSettings}
          open={showSettings}
          onToggle={() => setShowSettings((v) => !v)}
        />

        <button className="btn btn-big btn-scream" onClick={host} disabled={busy}>
          Start a game
        </button>

        <div className="or">
          <span className="eyebrow">or join one</span>
        </div>

        <form className="join-row" onSubmit={join}>
          <input
            className="field field-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 5))}
            placeholder="CODE"
            maxLength={5}
            aria-label="Game code"
          />
          <button className="btn btn-big" type="submit" disabled={busy}>
            Join
          </button>
        </form>

        {error && <p className="notice notice-bad">{error}</p>}

        {/* Without this, arriving with nobody else around is a dead end — the lobby needs
            a second player, so an unaccompanied visitor never sees the game at all. */}
        <button
          className="link-btn muted"
          onClick={() => go(() => practiceMatch(nickname.trim() || "you", token))}
          disabled={busy}
        >
          Or try one round on your own
        </button>

        {authAvailable && (
          <button
            className="link-btn muted"
            onClick={async () => setToken(await signIn())}
            disabled={busy}
          >
            {token ? "Signed in — your stats will stick" : "Sign in to keep your stats"}
          </button>
        )}
      </div>

      <p className="footnote muted">
        Fake tickers, fake money, real lying. Nothing here is investment advice.
      </p>
    </main>
  );
}
