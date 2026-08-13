import { useEffect, useRef, useState } from "react";

/** The four speech acts that matter: claim a tip, state a position, accuse, reassure. */
const QUICK_LINES = [
  "my tip says PUMP",
  "my tip says DUMP",
  "it's a rug",
  "i'm long",
  "i'm short",
  "liar",
];

/**
 * News, chat and carnage share one stream on purpose. A headline and a player's lie
 * arrive looking equally credible, which is exactly the position the game wants you in.
 */
export default function Wire({ feed, onSay, disabled }) {
  const [draft, setDraft] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [feed]);

  const submit = (event) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    onSay(text);
    setDraft("");
  };

  return (
    <section className="panel stack wire">
      <header className="panel-head">
        <h2 className="display pane-title">The Wire</h2>
      </header>

      <ul className="wire-list">
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
        <li ref={endRef} />
      </ul>

      {/* A round leaves no time to read a chart, size a position and type a convincing
          lie. One tap keeps the talking going while the market moves. */}
      <div className="quick-row">
        {QUICK_LINES.map((line) => (
          <button
            key={line}
            type="button"
            className="quick"
            onClick={() => onSay(line)}
            disabled={disabled}
          >
            {line}
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
