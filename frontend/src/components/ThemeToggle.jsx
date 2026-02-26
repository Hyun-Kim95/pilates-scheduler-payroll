import { useState, useEffect } from 'react';

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  return (
    <button
      type="button"
      onClick={() => setIsDark((prev) => !prev)}
      className="theme-toggle"
      title={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
      aria-label={isDark ? '라이트 모드' : '다크 모드'}
    >
      {isDark ? (
        <span className="theme-icon" aria-hidden>☀️</span>
      ) : (
        <span className="theme-icon" aria-hidden>🌙</span>
      )}
      <span className="theme-label">{isDark ? '라이트' : '다크'}</span>
    </button>
  );
}
