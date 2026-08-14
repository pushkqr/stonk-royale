import { memo } from "react";
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
 */
function Dossier({ rumor, truthfulTips, feed }) {
  const news = feed.filter((item) => item.kind === "NEWS");

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
    </section>
  );
}

export default memo(Dossier);
