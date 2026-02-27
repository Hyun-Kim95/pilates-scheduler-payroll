import { useState, useEffect } from 'react';
import { listInstructors, createInstructor, updateInstructor, deleteInstructor } from '../api/instructors';

const initialForm = {
  name: '',
  color: '#3498db',
  rate_type: 'fixed',
  rate_value: 0,
  base_salary: 0,
  phone: '',
  login_email: '',
  login_password: '',
};

export default function Instructors() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(initialForm);
  const [editing, setEditing] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const load = () => {
    setLoading(true);
    listInstructors().then(setList).catch(() => setList([])).finally(() => setLoading(false));
  };

  useEffect(() => load(), []);

  const resetForm = () => {
    setForm(initialForm);
    setEditing(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // 로그인 정보 유효성: 이메일이 있으면 비밀번호도 있어야 함
    if (!editing && form.login_email && !form.login_password) {
      alert('로그인 이메일을 입력했다면 비밀번호도 입력해야 합니다.');
      return;
    }
    if (editing) {
      // 기존 강사 수정 시에는 로그인 정보는 건드리지 않음
      const { login_email, login_password, ...payload } = form;
      updateInstructor(editing.id, payload)
        .then(() => {
          resetForm();
          setShowModal(false);
          load();
        })
        .catch((err) => {
          alert(err.response?.data?.error || '강사 수정에 실패했습니다.');
        });
    } else {
      createInstructor(form)
        .then(() => {
          resetForm();
          setShowModal(false);
          load();
        })
        .catch((err) => {
          alert(err.response?.data?.error || '강사 등록에 실패했습니다.');
        });
    }
  };

  const handleDelete = (id) => {
    if (window.confirm('삭제하시겠습니까?')) deleteInstructor(id).then(load);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (i) => {
    setEditing(i);
    setForm({
      name: i.name,
      color: i.color,
      rate_type: i.rate_type,
      rate_value: i.rate_value,
      base_salary: i.base_salary,
      phone: i.phone || '',
      // 기존 강사는 이메일/비밀번호는 수정하지 않음 (빈 값 유지)
      login_email: '',
      login_password: '',
    });
    setShowModal(true);
  };

  return (
    <div>
      <div className="page-header">
        <h2>강사 관리</h2>
        <div className="page-header-actions">
          <button type="button" className="btn btn-primary" onClick={openCreateModal}>
            강사 등록
          </button>
        </div>
      </div>
      {loading ? <p>로딩 중...</p> : (
        <table className="data-table">
          <thead>
            <tr><th>이름</th><th>색상</th><th>요율</th><th>기본급</th><th>연락처</th><th></th></tr>
          </thead>
          <tbody>
            {list.map((i) => (
              <tr key={i.id}>
                <td>{i.name}</td>
                <td><span style={{ display: 'inline-block', width: 20, height: 20, backgroundColor: i.color, borderRadius: 4 }} /></td>
                <td>{i.rate_type === 'fixed' ? `${Number(i.rate_value).toLocaleString()}원` : `${i.rate_value}%`}</td>
                <td>{Number(i.base_salary).toLocaleString()}원</td>
                <td>{i.phone || '-'}</td>
                <td>
                  <button type="button" className="btn btn-secondary" onClick={() => openEditModal(i)}>수정</button>
                  <button type="button" className="btn btn-danger" onClick={() => handleDelete(i.id)}>삭제</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {showModal && (
        <div
          className="schedule-modal-backdrop"
        >
          <div
            className="schedule-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>{editing ? '강사 수정' : '강사 등록'}</h3>
            <form onSubmit={handleSubmit} className="slot-form">
              <input
                placeholder="강사명"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                title="색상"
              />
              <select
                value={form.rate_type}
                onChange={(e) => setForm({ ...form, rate_type: e.target.value })}
              >
                <option value="fixed">금액</option>
                <option value="percent">%</option>
              </select>
              <input
                type="number"
                placeholder="요율"
                value={form.rate_value || ''}
                onChange={(e) => setForm({ ...form, rate_value: e.target.value })}
              />
              <input
                type="number"
                placeholder="기본급"
                value={form.base_salary || ''}
                onChange={(e) => setForm({ ...form, base_salary: e.target.value })}
              />
              <input
                placeholder="연락처"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
              {!editing && (
                <>
                  <input
                    type="email"
                    placeholder="로그인 이메일 (선택)"
                    value={form.login_email}
                    onChange={(e) => setForm({ ...form, login_email: e.target.value })}
                  />
                  <input
                    type="password"
                    placeholder="로그인 비밀번호 (이메일 입력 시 필수)"
                    value={form.login_password}
                    onChange={(e) => setForm({ ...form, login_password: e.target.value })}
                  />
                </>
              )}
              <div className="slot-form-actions">
                <button type="submit" className="btn btn-primary">{editing ? '수정' : '등록'}</button>
                <button type="button" className="btn btn-secondary" onClick={() => { setShowModal(false); resetForm(); }}>취소</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
