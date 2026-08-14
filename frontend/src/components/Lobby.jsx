import { useState } from "react";
import { useMatch } from "../state/MatchProvider";
import MatchSettings from "./MatchSettings";
import { DEFAULTS } from "../lib/matchSettings";

export default function Lobby() {
  const { lobby, session, start, kick, configure } = useMatch();
  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [draft, setDraft] = useState(DEFAULTS);

  const [prevLobby, setPrevLobby] = useState(lobby);
  if (lobby !== prevLobby) {
    setPrevLobby(lobby);
    // Only while the editor is shut. Every join, leave or kick rebroadcasts the lobby as a
    // fresh object, so re-seeding unconditionally would wipe the host's half-finished
    // changes the moment anybody else moved in the room.
    if (lobby && !showSettings) {
      setDraft({
        rounds: lobby.totalRounds,
        roundSeconds: lobby.roundSeconds,
        intermissionSeconds: lobby.intermissionSeconds,
        maxPlayers: lobby.maxPlayers,
        startingCash: lobby.startingCash,
      });
    }
  }

  const players = lobby?.players ?? [];
  const ready = players.length >= 2;

  /*
    Read the badge off the room, not off the seat we were handed at join time.

    The server moves the host badge when a host leaves, and the saved seat never hears
    about it — so a promoted player used to be left staring at "Waiting for the host to
    start" with nobody able to start anything. That was reachable before only by clicking
    Leave; now that a closed window frees a lobby seat too, it is the common case.
  */
  const mySeat = players.find((player) => player.playerId === session.playerId);
  const isHost = mySeat?.host ?? session.host;

  const copyLink = async () => {
    const url = window.location.href;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        // Clipboard API needs a secure context (HTTPS or localhost); fall back
        // to the old execCommand trick for plain-HTTP access.
        const textarea = document.createElement("textarea");
        textarea.value = url;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Nothing we can do without a secure context or a user gesture; leave
      // the button label as-is rather than claiming success.
    }
  };

  return (
    <main className="center-page">
      <header className="hero">
        <p className="eyebrow">Get everyone in with</p>
        <h1 className="display hero-code">{lobby?.code ?? session.code}</h1>
        <button className="btn" onClick={copyLink}>
          {copied ? "Link copied" : "Copy invite link"}
        </button>
      </header>

      <div className="panel sheet stack">
        <div className="panel-head">
          <h2 className="display pane-title">
            In the room ({players.length}/{lobby?.maxPlayers ?? 12})
          </h2>
        </div>

        <ul className="lobby-list">
          {players.map((player) => (
            <li key={player.playerId} className="lobby-player">
              <span className="lobby-name">{player.nickname}</span>
              {player.bot && <span className="tag tag-bot">BOT</span>}
              {player.host && <span className="tag tag-scream">Host</span>}
              {player.playerId === session.playerId && <span className="tag">You</span>}
              {/* Host only, and never against themselves — Leave is how you remove you. */}
              {isHost && player.playerId !== session.playerId && (
                <button
                  type="button"
                  className="lobby-kick"
                  onClick={() => kick(player.playerId)}
                  title={`Remove ${player.nickname}`}
                  aria-label={`Remove ${player.nickname}`}
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>

        {isHost ? (
          <>
            <button
              type="button"
              className="link-btn muted"
              onClick={() => setShowSettings((v) => !v)}
              aria-expanded={showSettings}
            >
              {showSettings ? "Hide match settings" : "Change match settings"}
            </button>

            {showSettings && (
              <div className="stack" style={{ gap: "0.6rem" }}>
                <MatchSettings
                  settings={draft}
                  onChange={setDraft}
                  open={advanced}
                  onToggle={() => setAdvanced((v) => !v)}
                />
                <button type="button" className="btn" onClick={() => configure(draft)}>
                  Save settings
                </button>
              </div>
            )}

            <button className="btn btn-big btn-scream" onClick={start} disabled={!ready}>
              Start the match
            </button>
            {!ready && <p className="notice muted">You need one more player.</p>}
          </>
        ) : (
          <p className="notice muted">Waiting for the host to start.</p>
        )}
      </div>

      <p className="footnote muted">
        {lobby?.totalRounds ?? 5} rounds · {lobby?.roundSeconds ?? 90} seconds each · everyone
        starts each round with the same stack
      </p>
    </main>
  );
}
