import ThemeToggle from './ThemeToggle';

export default function Header({ onMenuClick }) {
  return (
    <header className="header">
      <button
        type="button"
        className="header-menu-btn"
        onClick={() => typeof onMenuClick === 'function' && onMenuClick()}
        aria-label="메뉴 열기"
      >
        <span className="header-menu-icon" aria-hidden>☰</span>
      </button>
      <h1 className="header-title">필라테스 스케줄 · 정산</h1>
      <div className="header-actions">
        <ThemeToggle />
      </div>
    </header>
  );
}
