import { FileText, MessageSquare, TrendingUp } from "lucide-react";

export default function GameplayHook() {
  return (
    <section className="tactical-flow" aria-label="How the game loop works">
      <div className="tactical-card">
        <div className="tactical-head">
          <span className="tactical-phase">01 / DOSSIER</span>
          <FileText size={15} strokeWidth={2.4} className="tactical-icon tactical-icon-intel" aria-hidden="true" />
        </div>
        <div className="tactical-body">
          <div className="tactical-title">Secret Intel</div>
          <div className="tactical-desc">One private tip per round</div>
        </div>
        <span className="tactical-tag tag-intel">CONFIDENTIAL</span>
      </div>

      <div className="tactical-card">
        <div className="tactical-head">
          <span className="tactical-phase">02 / THE WIRE</span>
          <MessageSquare size={15} strokeWidth={2.4} className="tactical-icon tactical-icon-bluff" aria-hidden="true" />
        </div>
        <div className="tactical-body">
          <div className="tactical-title">Bluff & Snoop</div>
          <div className="tactical-desc">Chat and spot the lies</div>
        </div>
        <span className="tactical-tag tag-bluff">70% LIE CHANCE</span>
      </div>

      <div className="tactical-card">
        <div className="tactical-head">
          <span className="tactical-phase">03 / THE PIT</span>
          <TrendingUp size={15} strokeWidth={2.4} className="tactical-icon tactical-icon-trade" aria-hidden="true" />
        </div>
        <div className="tactical-body">
          <div className="tactical-title">10x Execution</div>
          <div className="tactical-desc">Squeeze prices & profit</div>
        </div>
        <span className="tactical-tag tag-trade">LONG / SHORT</span>
      </div>
    </section>
  );
}

