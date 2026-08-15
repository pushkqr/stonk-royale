import { memo, useEffect, useRef, useState } from "react";
import {
  Rocket,
  TrendingDown,
  Skull,
  Laugh,
  Droplets,
  EyeOff,
  Gem,
  Drama,
} from "lucide-react";

/**
 * The speech acts that matter: claim a tip, state a position, accuse.
 *
 * Every regime gets a line, because a claim is checked against the tip you were dealt at
 * settle — leaving one out would mean a player holding it could not tell the truth in one
 * tap while the liars could.
 */
const QUICK_LINES = [
  { text: "my tip says PUMP", claim: "PUMP" },
  { text: "my tip says DUMP", claim: "DUMP" },
  { text: "my tip says CHOP", claim: "CHOP" },
  { text: "it's a rug", claim: "RUG" },
  { text: "it's a squeeze", claim: "SQUEEZE" },
  { text: "i'm long" },
  { text: "i'm short" },
  { text: "liar" },
];

const QUICK_ICONS = [
  { icon: Rocket, label: "🚀 PUMP", title: "Pump (Rocket)" },
  { icon: TrendingDown, label: "📉 DUMP", title: "Dump (Trending Down)" },
  { icon: Skull, label: "💀 REKT", title: "Rekt (Skull)" },
  { icon: Laugh, label: "🤣 LMAO", title: "Laugh (LMAO)" },
  { icon: Droplets, label: "💦 SWEAT", title: "Sweat (Droplets)" },
  { icon: Drama, label: "🤡 CLOWN", title: "Clown (Drama)" },
  { icon: EyeOff, label: "🤥 LIAR", title: "Liar (Eye Off)" },
  { icon: Gem, label: "💎 HODL", title: "Diamond Hands" },
];

/**
 * News, chat and carnage share one stream on purpose. A headline and a player's lie
 * arrive looking equally credible, which is exactly the position the game wants you in.
 *
 * Memoised because it hangs off the trading screen, which re-renders on every price tick —
 * and re-rendering a text input the player may be mid-sentence in, ten times a second, to
 * show a feed that has not changed, is pure cost.
 */
function Wire({ feed, onSay, disabled, className = "" }) {
  const [draft, setDraft] = useState("");
  const listRef = useRef(null);

  // Scroll the list's own box, never scrollIntoView. scrollIntoView walks up and scrolls
  // every ancestor container too — on mobile, where the page itself scrolls, that dragged
  // the whole viewport down to the wire on every incoming message and made trading
  // impossible.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [feed]);

  const submit = (event) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    onSay(text);
    setDraft("");
  };

  return (
    <section className={`panel stack wire ${className}`}>
      <header className="panel-head">
        <h2 className="display pane-title">The Wire</h2>
      </header>

      <ul className="wire-list" ref={listRef}>
        {feed.length === 0 && <li className="wire-empty muted">Nobody's talking. Suspicious.</li>}

        {feed.map((item) => (
          <li key={item.id} className={`wire-item wire-${item.kind.toLowerCase()}`}>
            {item.kind === "CHAT" ? (
              <>
                <span className="wire-name">{item.nickname}</span>
                <span className="wire-text">{item.text}</span>
              </>
            ) : (
              <span className="wire-text">{item.text}</span>
            )}
          </li>
        ))}
      </ul>

      {/* A round leaves no time to read a chart, size a position and type a convincing
          lie. One tap keeps the talking going while the market moves. */}
      <div className="quick-row">
        {QUICK_LINES.map(({ text, claim }) => (
          <button
            key={text}
            type="button"
            className="quick"
            onClick={() => onSay(text, claim)}
            disabled={disabled}
          >
            {text}
          </button>
        ))}
      </div>

      <div className="quick-row icon-reactions-row">
        {QUICK_ICONS.map(({ icon: Icon, label, title }) => (
          <button
            key={label}
            type="button"
            className="quick quick-icon-btn"
            onClick={() => onSay(label)}
            disabled={disabled}
            title={title}
            aria-label={title}
          >
            <Icon size={13} strokeWidth={2.2} />
          </button>
        ))}
      </div>

      <form className="wire-form" onSubmit={submit}>
        <input
          className="field"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={disabled ? "Wait for the round" : "Tell them anything"}
          maxLength={200}
          disabled={disabled}
          aria-label="Message the room"
        />
        <button className="btn btn-scream" type="submit" disabled={disabled || !draft.trim()}>
          Say
        </button>
      </form>
    </section>
  );
}

export default memo(Wire);
