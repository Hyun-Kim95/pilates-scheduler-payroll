/**
 * API 에러에서 화면/alert에 쓸 문자열 하나만 꺼냄.
 * err.response?.data?.error 가 객체({ code, message } 등)일 수 있어서
 * 그대로 setState/alert 하면 [Object Object] 또는 React #31 발생 방지.
 */
export function getErrorMessage(err, fallback = '오류가 발생했습니다.') {
  if (!err) return fallback;
  const status = err.response?.status;
  const data = err.response?.data;
  // 404 = API 경로 없음 (Vercel 등에서 잘못된 API URL로 요청했을 때)
  if (status === 404) {
    return 'API 주소를 찾을 수 없습니다. Vercel 환경 변수 VITE_API_URL(백엔드 주소 + /api)을 확인하고 재배포하세요.';
  }
  if (!data) return fallback;
  const e = data.error;
  if (typeof e === 'string') return e;
  if (e && typeof e.message === 'string') return e.message;
  if (typeof data.message === 'string') return data.message;
  return fallback;
}
