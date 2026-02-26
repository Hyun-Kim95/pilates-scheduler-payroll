/**
 * 카카오 알림톡 발송 서비스
 * - KAKAO_ALIMTALK_ENABLED=true, API_URL·API_KEY·템플릿 코드 설정 시 실제 HTTP 발송
 * - 미설정 시 스텁(로그만)
 */

const ENABLED = process.env.KAKAO_ALIMTALK_ENABLED === 'true';
const API_KEY = process.env.KAKAO_ALIMTALK_API_KEY;
const API_URL = process.env.KAKAO_ALIMTALK_API_URL?.trim() || '';
const TEMPLATE_CONFIRMED = process.env.KAKAO_ALIMTALK_TEMPLATE_CONFIRMED?.trim() || '';
const TEMPLATE_CANCELLED = process.env.KAKAO_ALIMTALK_TEMPLATE_CANCELLED?.trim() || '';
const TEMPLATE_REMINDER = process.env.KAKAO_ALIMTALK_TEMPLATE_REMINDER?.trim() || '';

export const NotificationType = {
  RESERVATION_CONFIRMED: 'reservation_confirmed',
  RESERVATION_CANCELLED: 'reservation_cancelled',
  REMINDER: 'reminder',
};

const TEMPLATE_BY_TYPE = {
  [NotificationType.RESERVATION_CONFIRMED]: TEMPLATE_CONFIRMED,
  [NotificationType.RESERVATION_CANCELLED]: TEMPLATE_CANCELLED,
  [NotificationType.REMINDER]: TEMPLATE_REMINDER,
};

/**
 * 알림톡 HTTP 발송 (공통)
 * - 업체별 API 형식에 맞게 body 조정 가능. 아래는 범용 예시.
 */
async function sendViaApi(templateCode, phone, templateParams) {
  if (!API_URL || !templateCode) {
    console.log('[Alimtalk] No API_URL or template code, skip send');
    return true;
  }
  const phoneNormalized = String(phone).replace(/\D/g, '');
  if (phoneNormalized.length < 10) return false;

  const body = {
    template_code: templateCode,
    receiver: phoneNormalized,
    template_params: templateParams,
  };

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
      ...(API_KEY?.startsWith('Basic ') ? {} : { 'X-API-Key': API_KEY }),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Alimtalk API ${res.status}: ${text}`);
  }
  return true;
}

/**
 * 알림 발송: 스텁 또는 실제 API 호출
 */
export async function sendAlimtalk(type, phone, data = {}) {
  if (!phone) return false;
  if (!ENABLED) {
    console.log('[Alimtalk stub]', type, phone, data);
    return true;
  }
  const templateCode = TEMPLATE_BY_TYPE[type];
  const templateParams = {
    회원명: data.memberName ?? '',
    날짜: data.slotDate ?? '',
    시간: data.startTime ?? '',
    강사명: data.instructorName ?? '',
  };
  if (!API_URL || !templateCode) {
    console.log('[Alimtalk stub]', type, phone, data);
    return true;
  }
  try {
    await sendViaApi(templateCode, phone, templateParams);
    return true;
  } catch (err) {
    console.error('Alimtalk send error:', err);
    return false;
  }
}

export async function sendReservationConfirmed(phone, { memberName, slotDate, startTime, instructorName }) {
  return sendAlimtalk(NotificationType.RESERVATION_CONFIRMED, phone, {
    memberName,
    slotDate,
    startTime,
    instructorName,
  });
}

export async function sendReservationCancelled(phone, { memberName, slotDate, startTime }) {
  return sendAlimtalk(NotificationType.RESERVATION_CANCELLED, phone, {
    memberName,
    slotDate,
    startTime,
  });
}

export async function sendReminder(phone, { memberName, slotDate, startTime }) {
  return sendAlimtalk(NotificationType.REMINDER, phone, {
    memberName,
    slotDate,
    startTime,
  });
}
