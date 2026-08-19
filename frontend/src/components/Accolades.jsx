import { memo } from "react";
import { computeAccolades } from "../lib/accolades";

function Accolades({ standings, settled, feed, matchLiquidations, roundHistory }) {
  const awards = computeAccolades(standings, settled, feed, matchLiquidations, roundHistory);
  if (awards.length === 0) return null;

  return (
    <section className="accolades-section">
      <h2 className="eyebrow accolades-title">Match Accolades</h2>
      <div className="accolades-grid">
        {awards.map((award) => {
          const Icon = award.icon;
          return (
            <div key={award.id} className="accolade-card">
              <div className="accolade-icon-wrap">
                <Icon size={16} strokeWidth={2.4} />
              </div>
              <div className="accolade-info">
                <span className="accolade-role eyebrow">{award.title}</span>
                <span className="accolade-player">{award.player}</span>
                <span className="accolade-sub mono muted">{award.subtitle}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default memo(Accolades);
