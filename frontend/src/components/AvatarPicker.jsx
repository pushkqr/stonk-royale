import { ARCHETYPES, getMyAvatar, setMyAvatar } from "../lib/avatars";
import Avatar from "./Avatar";

export default function AvatarPicker({ onSelect, onClose }) {
  const current = getMyAvatar();

  const handleChoose = (id) => {
    setMyAvatar(id);
    if (onSelect) onSelect(id);
  };

  return (
    <div className="avatar-picker-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="avatar-picker-modal panel sheet"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="avatar-picker-header">
          <h2 className="display">SELECT YOUR DEGEN AVATAR</h2>
          <button
            type="button"
            className="btn btn-muted btn-close-modal"
            onClick={onClose}
            aria-label="Close avatar selector"
          >
            ✕
          </button>
        </header>

        <div className="avatar-grid">
          {ARCHETYPES.map((a) => {
            const isSelected = a.id === current;
            return (
              <button
                key={a.id}
                type="button"
                className={`avatar-card ${isSelected ? "is-selected" : ""}`}
                onClick={() => handleChoose(a.id)}
              >
                <div className="avatar-preview-wrap">
                  <Avatar archetypeId={a.id} mood={isSelected ? "laser" : "neutral"} size={52} />
                </div>
                <div className="avatar-info">
                  <span className="avatar-name display">{a.name}</span>
                  <span className="avatar-role eyebrow">{a.role}</span>
                </div>
                {isSelected && <span className="tag tag-ready">ACTIVE</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
