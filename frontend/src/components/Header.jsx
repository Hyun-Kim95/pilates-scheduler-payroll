import ThemeToggle from './ThemeToggle';

export default function Header() {
  return (
    <header className="header">
      <h1 className="header-title">필라테스 스케줄 · 정산</h1>
      <ThemeToggle />
    </header>
  );
}
