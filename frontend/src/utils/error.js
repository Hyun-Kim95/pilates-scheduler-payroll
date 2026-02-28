/**
 * API 에러에서 화면/alert에 쓸 문자열 하나만 꺼냄.
 * err.response?.data?.error 가 객체({ code, message } 등)일 수 있어서
 * 그대로 setState/alert 하면 [Object Object] 또는 React #31 발생 방지.
 */
export function getErrorMessage(err, fallback = '오류가 발생했습니다.') {
  if (!err) return fallback;
  const data = err.response?.data;
  if (!data) return fallback;
  const e = data.error;
  if (typeof e === 'string') return e;
  if (e && typeof e.message === 'string') return e.message;
  if (typeof data.message === 'string') return data.message;
  return fallback;
}
