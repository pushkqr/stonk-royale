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
  const { phase, readyState, ready, serverNow } = useMatch();
  const left = useCountdown(phase?.endsAtMillis, serverNow);

  // Lazy initializers rather than a ref: both need the one-time localStorage read, and
  // reading a ref's value during render (as `open`'s initial value would) is a footgun
  // React now flags outright.
  const [seenBefore] = useState(() => hasSeenBriefing());
  const [open, setOpen] = useState(() => !seenBefore);
  const [readAll, setReadAll] = useState(false);
  const [sent, setSent] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    if (!seenBefore || sent) return;
    setSent(true);
    ready();
  }, [seenBefore, ready, sent]);

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

  const count = readyState ? `${readyState.ready}/${readyState.total} ready` : "";

  return (
    <main className="center-page">
      <header className="hero">
        <p className="eyebrow">Before the first round · starts anyway in {clock(left)}</p>
        <h1 className="display hero-verdict">Here is how this works</h1>
        {count && <p className="tip-count mono" role="status">{count}</p>}
      </header>

      {open ? (
        <div className="panel sheet">
          <div className="rules-scroll">
            <RulesContent />
            <div ref={endRef} className="rules-end" />
          </div>

          {sent ? (
            <p className="notice muted">Waiting for the others.</p>
          ) : (
            <>
              <button
                className="btn btn-big btn-scream"
                onClick={confirm}
                disabled={!readAll}
              >
                {readAll ? "Got it — I'm ready" : "Read to the end first"}
              </button>
              {!readAll && <p className="notice muted">Scroll down. It is short.</p>}
            </>
          )}
        </div>
      ) : (
        <div className="panel sheet stack">
          <p className="notice">You have played before. Waiting for the others.</p>
          <button type="button" className="link-btn muted" onClick={() => setOpen(true)}>
            Read the rules again
          </button>
        </div>
      )}
    </main>
  );
}
