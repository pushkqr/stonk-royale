import { useEffect, useRef, useState } from "react";
import { useMatch } from "../state/MatchProvider";
import { useCountdown } from "../lib/useCountdown";
import { clock } from "../lib/format";
import { hasSeenBriefing, markBriefingSeen } from "../lib/briefing";
import RulesContent from "./RulesContent";

/**
 * The gate before the first round.
 *
 * Ready is withheld until the panel has actually been scrolled to the end, because a button
 * you can hit on arrival is a button everybody hits on arrival. Anyone who has read it on
 * this browser before skips straight to the waiting state, so a returning group passes
 * through in under a second.
 */
export default function Briefing() {
  const { phase, readyState, ready, connected, serverNow } = useMatch();
  const left = useCountdown(phase?.endsAtMillis, serverNow);

  // Lazy initializers rather than a ref: both need the one-time localStorage read, and
  // reading a ref's value during render (as `open`'s initial value would) is a footgun
  // React now flags outright.
  const [seenBefore] = useState(() => hasSeenBriefing());
  const [open, setOpen] = useState(() => !seenBefore);
  const [readAll, setReadAll] = useState(false);
  const [sent, setSent] = useState(() => seenBefore);
  const endRef = useRef(null);

  useEffect(() => {
    if (!seenBefore || !connected) return;
    ready();
  }, [seenBefore, ready, connected]);

  useEffect(() => {
    const end = endRef.current;
    if (!open || !end) return undefined;
    // rootMargin fires the observer slightly before the sentinel is flush against the
    // scroll container's bottom clip edge, where a zero-area intersection can otherwise
    // fail to register on short mobile viewports and leave Ready stuck disabled.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setReadAll(true);
      },
      { rootMargin: "0px 0px 40px 0px" },
    );
    observer.observe(end);
    return () => observer.disconnect();
  }, [open]);

  const confirm = () => {
    markBriefingSeen();
    setSent(true);
    ready();
  };

  // Anonymous on purpose: the count is a nudge to get on with it, not a way to put one
  // person's name on the screen in front of everybody.
  const readyNow = readyState?.ready ?? 0;
  const seats = readyState?.total ?? 0;

  const waiting = (
    <div className="briefing-waiting">
      <p className="eyebrow">Waiting for the others</p>
      <div className="ready-pips" aria-hidden="true">
        {Array.from({ length: seats }, (_, i) => (
          <span key={i} className={`ready-pip ${i < readyNow ? "is-in" : ""}`} />
        ))}
      </div>
      <p className="sr-only" role="status">
        {readyNow} of {seats} ready
      </p>
    </div>
  );

  return (
    <main className="center-page">
      <div className="briefing-plate">
        <span className="briefing-plate-name">House Rules</span>
        <span className="briefing-plate-sub">Read before trading</span>
      </div>

      <header className="hero">
        <h1 className="display briefing-title">Read this. They won&rsquo;t.</h1>
        <p className="eyebrow">
          Starts without you in <b className="scream">{clock(left)}</b>
        </p>
      </header>

      {open ? (
        <div className="panel sheet stack">
          <div className="rules-scroll">
            <RulesContent />
            <div ref={endRef} className="rules-end" />
          </div>

          {sent ? (
            <>
              {waiting}
              {/* Re-opened by choice after already readying up, so there has to be a way
                  back out — otherwise the only exit is sitting out the failsafe timer. */}
              <button type="button" className="btn" onClick={() => setOpen(false)}>
                Back to the room
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-big btn-scream" onClick={confirm} disabled={!readAll}>
                {readAll ? "Got it — I'm ready" : "Read to the end first"}
              </button>
              {!readAll && <p className="notice muted">Keep scrolling. It is short.</p>}
            </>
          )}
        </div>
      ) : (
        <div className="panel sheet stack">
          <p className="notice">You have done this before.</p>
          {waiting}
          <button type="button" className="link-btn muted" onClick={() => setOpen(true)}>
            Read the rules again
          </button>
        </div>
      )}
    </main>
  );
}
