import { useState } from 'react';
import { changePassword } from '../api/auth';

export default function ChangePassword() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!current || !next) {
      setError('현재 비밀번호와 새 비밀번호를 입력하세요.');
      return;
    }
    if (next !== confirm) {
      setError('새 비밀번호와 확인 비밀번호가 일치하지 않습니다.');
      return;
    }
    setLoading(true);
    try {
      await changePassword(current, next);
      setSuccess('비밀번호가 변경되었습니다.');
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      setError(err.response?.data?.error || '비밀번호 변경에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>비밀번호 변경</h2>
      </div>
      <form onSubmit={handleSubmit} className="slot-form" style={{ maxWidth: 400 }}>
        <input
          type="password"
          placeholder="현재 비밀번호"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          autoComplete="current-password"
          required
        />
        <input
          type="password"
          placeholder="새 비밀번호"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          autoComplete="new-password"
          required
        />
        <input
          type="password"
          placeholder="새 비밀번호 확인"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          required
        />
        {error && <div className="schedule-move-error">{error}</div>}
        {success && <div className="schedule-moving">{success}</div>}
        <div className="slot-form-actions">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? '변경 중...' : '비밀번호 변경'}
          </button>
        </div>
      </form>
    </div>
  );
}

