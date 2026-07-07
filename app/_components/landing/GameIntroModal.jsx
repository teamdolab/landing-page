'use client';

/**
 * @param {{
 *   game: { name: string; accent: string } | null;
 *   meta?: { intro_text?: string | null; is_coming_soon?: boolean } | null;
 *   onClose: () => void;
 *   onApply: () => void;
 * }} props
 */
export function GameIntroModal({ game, meta, onClose, onApply }) {
  if (!game) return null;

  const introText = meta?.intro_text?.trim();
  const comingSoon = meta?.is_coming_soon === true;

  const handleApply = () => {
    onClose();
    onApply();
  };

  return (
    <div className="game-intro-overlay" onClick={onClose} role="presentation">
      <div
        className="sub-panel wide game-intro-panel"
        style={{ '--ga': game.accent }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="game-intro-title"
      >
        <div className="sub-head game-intro-head">
          <b id="game-intro-title">
            <span className="sq" aria-hidden />
            {game.name}
          </b>
        </div>
        {introText ? <div className="sub-body">{introText}</div> : null}
        <div className={`sub-foot${comingSoon ? '' : ' split'}`}>
          {comingSoon ? (
            <button type="button" className="btn btn-line btn-block" onClick={onClose}>
              닫기
            </button>
          ) : (
            <>
              <button type="button" className="btn btn-line" onClick={onClose}>
                닫기
              </button>
              <button type="button" className="btn btn-fill game-intro-apply" onClick={handleApply}>
                이 게임 신청하기
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
