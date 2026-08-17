import { FileText, MessageSquare, TrendingUp } from "lucide-react";

export default function GameplayHook() {
  return (
    <section className="tactical-flow" aria-label="How the game loop works">
      <div className="tactical-card">
        <div className="tactical-head">
          <span className="tactical-phase">01 / GET A TIP</span>
          <FileText size={15} strokeWidth={2.4} className="tactical-icon tactical-icon-intel" aria-hidden="true" />
        </div>
        <div className="tactical-body">
          <div className="tactical-title">You Get Intel</div>
          <div className="tactical-desc">A private tip on the coin</div>
        </div>
        <span className="tactical-tag tag-intel">PRIVATE</span>
      </div>

      <div className="tactical-card">
        <div className="tactical-head">
          <span className="tactical-phase">02 / SPOT LIES</span>
          <MessageSquare size={15} strokeWidth={2.4} className="tactical-icon tactical-icon-bluff" aria-hidden="true" />
        </div>
        <div className="tactical-body">
          <div className="tactical-title">Everyone Lies</div>
          <div className="tactical-desc">Chat and spot who is fake</div>
        </div>
        <span className="tactical-tag tag-bluff">MOSTLY FAKE</span>
      </div>

      <div className="tactical-card">
        <div className="tactical-head">
          <span className="tactical-phase">03 / TRADE IT</span>
          <TrendingUp size={15} strokeWidth={2.4} className="tactical-icon tactical-icon-trade" aria-hidden="true" />
        </div>
        <div className="tactical-body">
          <div className="tactical-title">Trade & Win</div>
          <div className="tactical-desc">Long or short to take cash</div>
        </div>
        <span className="tactical-tag tag-trade">TAKE PROFIT</span>
      </div>
    </section>
  );
}

