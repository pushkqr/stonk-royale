import { memo, useCallback, useEffect, useRef, useState } from "react";
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
import Avatar from "./Avatar";
import { avatarOf, getMood } from "../lib/avatars";

/** Stable identity, so the default never breaks the memo below. */
const NO_AVATARS = new Map();

/**
 * The five lines the game actually holds you to.
 *
 * Tapping one files a claim against your seat, and the Ledger prints it at settle beside the
 * tip you were really dealt, under "Said" and "Held" — with a SUS tag turning into "Caught!"
 * if the two disagree. Every regime gets a line, because a claim is checked against the tip
 * you were dealt: leaving one out would mean a player holding it could not tell the truth in
 * one tap while the liars could.
 *
 * The button shows the regime alone and the group heading carries the rest of the sentence.
 * Printed in full, five buttons differing only in their last word scanned as one block of
 * noise sitting in the same row as eight that bind you to nothing — so players were going on
 * the record without noticing, and finding out they had been caught lying about a tip they
 * thought they had only reacted to.
 */
const CLAIM_LINES = [
  { label: "PUMP", text: "my tip says PUMP", claim: "PUMP" },
  { label: "DUMP", text: "my tip says DUMP", claim: "DUMP" },
  { label: "CHOP", text: "my tip says CHOP", claim: "CHOP" },
  { label: "RUG", text: "it's a rug", claim: "RUG" },
  { label: "SQUEEZE", text: "it's a squeeze", claim: "SQUEEZE" },
];

/** Talk that costs nothing: said out loud, recorded nowhere, checked against nothing. */
const ASIDE_LINES = ["i'm long", "i'm short", "liar"];

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
 * The client's half of the Wire's rate limit. Deliberately one token tighter than the
 * server's, so an honest player runs out here — where the button simply stops lighting up —
 * rather than there, where the message would vanish with nothing to explain it.
 *
 * Only the tap rows are gated. Typing is limited by how fast anybody can type, and freezing
 * the field mid-sentence to solve a problem the field does not cause would be its own bug.
 */
const TAP_CAPACITY = 5;
const TAP_REFILL_MS = 1200;

/**
 * News, chat and carnage share one stream on purpose. A headline and a player's lie
 * arrive looking equally credible, which is exactly the position the game wants you in.
 *
 * Memoised because it hangs off the trading screen, which re-renders on every price tick —
 * and re-rendering a text input the player may be mid-sentence in, ten times a second, to
 * show a feed that has not changed, is pure cost.
 *
 * `avatars` arrives as a prop, and must keep arriving as one. Reading it from the match
 * context here would look tidier and would quietly undo the memo above: context is not
 * subscribed per field, so any consumer re-renders whenever the context value changes —
 * and it changes on every board broadcast, twice a second. The screens that render this
 * one already re-render then anyway, so the lookup is built there and passed down.
 */
function Wire({ feed, onSay, disabled, roundIndex, suspects = {}, avatars = NO_AVATARS,
  className = "" }) {
  const [draft, setDraft] = useState("");
  const [cooling, setCooling] = useState(false);
  const [onRecord, setOnRecord] = useState(null);
  const [recordRound, setRecordRound] = useState(roundIndex);
  const listRef = useRef(null);
  const bucketRef = useRef({ tokens: TAP_CAPACITY, lastRefill: 0, timer: null });

  // The server wipes every claim the moment the next intermission deals a new tip, so this
  // mirror has to forget at the same instant or it would keep showing a record that no
  // longer exists. Keying on the round is what makes that exact: an intermission and the
  // round it opens share a roundIndex, which is also why a claim made while the market is
  // still shut correctly stands once it opens.
  if (recordRound !== roundIndex) {
    setRecordRound(roundIndex);
    setOnRecord(null);
  }

  useEffect(() => {
    const bucket = bucketRef.current;
    bucket.lastRefill = Date.now();
    return () => {
      if (bucket.timer) {
        clearTimeout(bucket.timer);
      }
    };
  }, []);

  // Scroll the list's own box, never scrollIntoView. scrollIntoView walks up and scrolls
  // every ancestor container too — on mobile, where the page itself scrolls, that dragged
  // the whole viewport down to the wire on every incoming message and made trading
  // impossible.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [feed]);

  const spend = useCallback(() => {
    const bucket = bucketRef.current;
    const now = Date.now();
    if (bucket.lastRefill === 0) {
      bucket.lastRefill = now;
    }
    if (now > bucket.lastRefill) {
      const elapsed = now - bucket.lastRefill;
      const replenished = Math.floor(elapsed / TAP_REFILL_MS);
      if (replenished > 0) {
        bucket.tokens = Math.min(TAP_CAPACITY, bucket.tokens + replenished);
        if (bucket.tokens === TAP_CAPACITY) {
          bucket.lastRefill = now;
        } else {
          bucket.lastRefill += replenished * TAP_REFILL_MS;
        }
      }
    }
    if (bucket.tokens > 0) {
      bucket.tokens -= 1;
      if (bucket.tokens === 0) {
        setCooling(true);
        if (bucket.timer) clearTimeout(bucket.timer);
        const waitMs = Math.max(0, TAP_REFILL_MS - (now - bucket.lastRefill));
        bucket.timer = setTimeout(() => {
          setCooling(false);
          bucket.timer = null;
        }, waitMs);
      }
      return true;
    }
    return false;
  }, []);

  const handleQuick = (text, claim) => {
    if (!spend()) return;
    onSay(text, claim);
    // Mirrored only once the token is spent, and the local bucket is a token tighter than
    // the server's — so anything counted here is something the server will accept.
    if (claim) setOnRecord(claim);
  };

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
                <span className="wire-name">
                  <Avatar
                    archetypeId={avatarOf(avatars.get(item.playerId))}
                    mood={getMood({ wasLie: suspects[item.playerId] === "SUS" })}
                    size={18}
                  />
                  <span>{item.nickname}</span>
                  {suspects[item.playerId] === "TRUSTED" && (
                    <span
                      className="badge-suspect badge-trust"
                      title="You marked this player as Trusted"
                    >
                      TRUST
                    </span>
                  )}
                  {suspects[item.playerId] === "SUS" && (
                    <span
                      className="badge-suspect badge-sus"
                      title="You marked this player as Suspect"
                    >
                      SUS
                    </span>
                  )}
                </span>
                <span className="wire-text">{item.text}</span>
              </>
            ) : (
              <span className="wire-text">{item.text}</span>
            )}
          </li>
        ))}
      </ul>

      {/* A round leaves no time to read a chart, size a position and type a convincing
          lie. One tap keeps the talking going while the market moves.

          Split in two because the two halves have different stakes and used to look
          identical. The heading is doing the teaching: it says what a tap costs before the
          tap, which is the only moment the warning is any use — the Ledger already says it
          afterwards, when it is a verdict rather than a choice. */}
      <p className="eyebrow quick-head">
        Go on record
        <span className="quick-head-note">the room sees this at settle</span>
      </p>
      <div className="quick-row">
        {CLAIM_LINES.map(({ label, text, claim }) => (
          <button
            key={claim}
            type="button"
            className={`quick quick-claim ${onRecord === claim ? "is-claimed" : ""}`}
            onClick={() => handleQuick(text, claim)}
            disabled={disabled || cooling}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Stays up for the rest of the round. Knowing you are on the record is what makes
          lying a decision instead of an accident, and it is the one thing a player cannot
          read back off the feed once a few messages have pushed it out of sight. */}
      {onRecord && (
        <p className="on-record" role="status">
          <span className="on-record-stamp">On record</span>
          <span className="on-record-text">
            You told the room your tip says {onRecord}
          </span>
        </p>
      )}

      <p className="eyebrow quick-head">Off the record</p>
      <div className="quick-row">
        {ASIDE_LINES.map((text) => (
          <button
            key={text}
            type="button"
            className="quick"
            onClick={() => handleQuick(text)}
            disabled={disabled || cooling}
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
            onClick={() => handleQuick(label)}
            disabled={disabled || cooling}
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
