import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createMatch, joinMatch, practiceMatch, quickMatch } from "../lib/api";
import { authAvailable, signIn } from "../lib/auth";
import { saveSeat } from "../lib/session";
import { DEFAULTS } from "../lib/matchSettings";
import MatchSettings from "../components/MatchSettings";
import RulesTab from "../components/RulesTab";
import MuteToggle from "../components/MuteToggle";
import GameplayHook from "../components/GameplayHook";

export default function Home() {
  const navigate = useNavigate();
  const [homeMode, setHomeMode] = useState("play");
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
    <>
      <RulesTab />
      <MuteToggle />
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

        <GameplayHook />

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

          <div className="home-tab-switcher" role="tablist" aria-label="Game Modes">
            <button
              type="button"
              role="tab"
              aria-selected={homeMode === "play"}
              className={`home-tab-btn ${homeMode === "play" ? "is-active" : ""}`}
              onClick={() => setHomeMode("play")}
            >
              ⚔️ Play / Join
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={homeMode === "host"}
              className={`home-tab-btn ${homeMode === "host" ? "is-active" : ""}`}
              onClick={() => setHomeMode("host")}
            >
              🛠️ Host Lobby
            </button>
          </div>

          {homeMode === "play" ? (
            <div className="stack" style={{ gap: "0.85rem" }}>
              <div className="stack" style={{ gap: "0.25rem" }}>
                <button
                  className="btn btn-big btn-scream"
                  onClick={() => go(() => quickMatch(nickname.trim(), token))}
                  disabled={busy}
                >
                  ⚡ Find a Game
                </button>
                <span className="quick-match-sub">Quick match with players & bots</span>
              </div>

              <div className="or">
                <span className="eyebrow">or enter room code</span>
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

              <button
                className="link-btn muted"
                onClick={() => go(() => practiceMatch(nickname.trim() || "you", token))}
                disabled={busy}
              >
                🤖 Or play solo vs bots
              </button>
            </div>
          ) : (
            <div className="stack" style={{ gap: "0.85rem" }}>
              <MatchSettings
                settings={settings}
                onChange={setSettings}
                open={showSettings}
                onToggle={() => setShowSettings((v) => !v)}
              />

              <button className="btn btn-big btn-scream" onClick={host} disabled={busy}>
                Create Lobby
              </button>
            </div>
          )}

          {error && <p className="notice notice-bad">{error}</p>}

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

        <footer className="footer-credit muted">
          <p className="footnote-disclaimer">
            Fake tickers, fake money, real lying. Nothing here is investment advice.
          </p>
          <p className="footnote-watermark">
            Made with <span className="credit-heart" aria-hidden="true">♥</span> by pushkqr
          </p>
        </footer>
      </main>
    </>
  );
}
