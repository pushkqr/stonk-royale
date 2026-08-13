import { useEffect, useRef, useState } from "react";

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
