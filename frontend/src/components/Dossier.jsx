import { memo } from "react";
import { ShieldCheck, EyeOff } from "lucide-react";
import RumorCard from "./RumorCard";
import { tipCountLine } from "../lib/regime";

/**
 * Everything the game has told you, still on screen while you trade.
 *
 * Playtesting found people traded blind: the tip was dealt in the intermission and then
 * left the screen when the round opened, and headlines scrolled away in a feed that also
 * carries chat and trades. Neither could reach the decision they were meant to inform.
 *
 * The headlines matter most here. Exactly one true and one false headline fire per round,
 * up to forty seconds apart, so a single one is a coin flip — the pair is the information,
 * because they contradict each other and one of them is provably lying. Pinned together
 * they are finally readable as a pair.
 *
 * Everything shown is data the client already had; nothing new is requested from the
 * server.
 *
 * Memoised because it hangs off the trading screen, which re-renders on every price tick.
 * Its own inputs change at most twice a second.
 *
 * The feed is never cleared between rounds — it is also the wire's chat backlog, which is
 * meant to persist. So headlines are tagged with the round they fired in at ingest, and
 * `roundIndex` scopes the list to the round on screen rather than the whole match.
 */
function Dossier({
  rumor,
  truthfulTips,
  feed,
  roundIndex,
  players = [],
  meId,
  suspects = {},
  onToggleSuspect,
}) {
  const news = feed.filter((item) => item.kind === "NEWS" && item.round === roundIndex);
  const opponents = players.filter((p) => p.playerId !== meId && !p.left);

  return (
    <section className="panel stack dossier">
      <header className="panel-head">
        <h2 className="display pane-title">What you know</h2>
      </header>

      <RumorCard text={rumor?.text} claimedRegime={rumor?.claimedRegime} compact />

      {/* Withheld below two players, where the count would name its own holder. */}
      {truthfulTips != null && (
        <p className="dossier-count mono">{tipCountLine(truthfulTips)}</p>
      )}

      <div className="dossier-news">
        {news.length === 0 ? (
          <p className="dossier-quiet muted">No headlines yet.</p>
        ) : (
          <ul className="dossier-news-list">
            {/* Newest first: the most recent headline is the one still worth acting on. */}
            {news
              .slice()
              .reverse()
              .map((item) => (
                <li key={item.id} className="dossier-headline">
                  {item.text}
                </li>
              ))}
          </ul>
        )}
      </div>

      {opponents.length > 0 && (
        <div className="dossier-suspects">
          <p className="eyebrow dossier-subhead">Suspect Tracker</p>
          <ul className="suspect-list">
            {opponents.map((p) => {
              const status = suspects[p.playerId];
              return (
                <li key={p.playerId} className="suspect-row">
                  <span className="suspect-name">
                    {p.nickname}
                    {p.bot && <span className="tag tag-bot">BOT</span>}
                  </span>
                  <div className="suspect-actions">
                    <button
                      type="button"
                      className={`suspect-btn btn-trust ${status === "TRUSTED" ? "is-active" : ""}`}
                      onClick={() => onToggleSuspect?.(p.playerId, "TRUSTED")}
                      title="Mark as Trusted"
                    >
                      <ShieldCheck size={11} strokeWidth={2.5} /> Trust
                    </button>
                    <button
                      type="button"
                      className={`suspect-btn btn-sus ${status === "SUS" ? "is-active" : ""}`}
                      onClick={() => onToggleSuspect?.(p.playerId, "SUS")}
                      title="Mark as Suspect"
                    >
                      <EyeOff size={11} strokeWidth={2.5} /> Sus
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

export default memo(Dossier);

