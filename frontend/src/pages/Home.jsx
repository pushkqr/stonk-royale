import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Gamepad2, SlidersHorizontal, Zap, Bot, Heart, Dice5 } from "lucide-react";
import { createMatch, joinMatch, practiceMatch, quickMatch } from "../lib/api";
import { authAvailable, signIn } from "../lib/auth";
import { saveSeat } from "../lib/session";
import { DEFAULTS } from "../lib/matchSettings";
import MatchSettings from "../components/MatchSettings";
import RulesTab from "../components/RulesTab";
import MuteToggle from "../components/MuteToggle";
import GameplayHook from "../components/GameplayHook";

const TRADER_NAMES = [
  "Bull42",
  "MoonShot",
  "GigaChad",
  "DiamondHands",
  "PaperHands",
  "GordonGekko",
  "Whale99",
  "AlphaSeeker",
  "ShortSqueeze",
  "MarginCall",
];

export default function Home() {
  const navigate = useNavigate();
  const [homeMode, setHomeMode] = useState("play");
  const [nickname, setNickname] = useState(() => {
    try {
      return localStorage.getItem("stonk_nickname") || "";
    } catch {
      return "";
    }
  });
  const [nameError, setNameError] = useState(false);
  const nameInputRef = useRef(null);

  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [token, setToken] = useState(null);
  const [settings, setSettings] = useState(DEFAULTS);
  const [showSettings, setShowSettings] = useState(false);

  const updateNickname = (val) => {
    setNickname(val);
    setNameError(false);
    try {
      localStorage.setItem("stonk_nickname", val);
    } catch {
      // ignore storage error
    }
  };

  const rollNickname = () => {
    const available = TRADER_NAMES.filter((n) => n !== nickname);
    const chosen = available[Math.floor(Math.random() * available.length)] || TRADER_NAMES[0];
    updateNickname(chosen);
  };

  const go = async (action) => {
    if (!nickname.trim()) {
      setError("Pick a name first.");
      setNameError(true);
      nameInputRef.current?.focus();
      return;
    }
    setNameError(false);
    setBusy(true);
    setError(null);
    try {
      try {
        localStorage.setItem("stonk_nickname", nickname.trim());
      } catch {
        // ignore storage error
      }
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
          <div className="hero-aura" aria-hidden="true" />
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
            <div className="eyebrow-row">
              <span className="eyebrow">Your name</span>
              <button
                type="button"
                className="dice-btn"
                onClick={rollNickname}
                title="Roll random trader name"
                aria-label="Roll random trader name"
              >
                <Dice5 size={13} strokeWidth={2.4} />
                <span>Random</span>
              </button>
            </div>
            <input
              ref={nameInputRef}
              className={`field ${nameError ? "field-error" : ""}`}
              value={nickname}
              onChange={(e) => updateNickname(e.target.value)}
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
              <Gamepad2 size={16} strokeWidth={2.4} />
              <span>Play / Join</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={homeMode === "host"}
              className={`home-tab-btn ${homeMode === "host" ? "is-active" : ""}`}
              onClick={() => setHomeMode("host")}
            >
              <SlidersHorizontal size={16} strokeWidth={2.4} />
              <span>Host Lobby</span>
            </button>
          </div>

          <div key={homeMode} className="home-mode-panel">
            {homeMode === "play" ? (
              <div className="stack" style={{ gap: "0.85rem" }}>
                <div className="stack" style={{ gap: "0.25rem" }}>
                  <button
                    className="btn btn-big btn-scream btn-icon-center btn-arcade-cta"
                    onClick={() => go(() => quickMatch(nickname.trim(), token))}
                    disabled={busy}
                  >
                    <Zap size={18} strokeWidth={2.5} />
                    <span>Find a Game</span>
                  </button>
                  <span className="quick-match-sub">Quick match with players & bots</span>
                </div>

                <div className="or">
                  <span className="eyebrow">or enter room code</span>
                </div>

                <form className="join-row" onSubmit={join}>
                  <div className="code-slots-container">
                    <input
                      className="field field-code code-real-input"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 5))}
                      placeholder="CODE"
                      maxLength={5}
                      aria-label="Game code"
                      autoComplete="off"
                      spellCheck="false"
                    />
                    <div className="code-slots" aria-hidden="true">
                      {Array.from({ length: 5 }).map((_, i) => {
                        const char = code[i] || "";
                        const isFilled = Boolean(char);
                        const isActive = i === code.length && code.length < 5;
                        return (
                          <div
                            key={i}
                            className={`code-slot ${isFilled ? "is-filled" : ""} ${isActive ? "is-active" : ""}`}
                          >
                            {char || "·"}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <button
                    className={`btn btn-big ${code.trim().length === 5 ? "btn-join-armed" : ""}`}
                    type="submit"
                    disabled={busy}
                  >
                    Join
                  </button>
                </form>

                <button
                  className="link-btn muted link-btn-icon"
                  onClick={() => go(() => practiceMatch(nickname.trim() || "you", token))}
                  disabled={busy}
                >
                  <Bot size={15} strokeWidth={2.2} />
                  <span>Or play solo vs bots</span>
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
          </div>

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
            Made with <Heart size={11} fill="var(--dump)" stroke="var(--dump)" className="credit-heart" aria-hidden="true" /> by pushkqr
          </p>
        </footer>
      </main>
    </>
  );
}
