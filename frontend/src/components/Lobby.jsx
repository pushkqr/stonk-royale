import { useState } from "react";
import { useMatch } from "../state/MatchProvider";

export default function Lobby() {
  const { lobby, session, start } = useMatch();
  const [copied, setCopied] = useState(false);

  const players = lobby?.players ?? [];
  const ready = players.length >= 2;

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
              {player.host && <span className="tag tag-scream">Host</span>}
              {player.playerId === session.playerId && <span className="tag">You</span>}
            </li>
          ))}
        </ul>

        {session.host ? (
          <>
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
