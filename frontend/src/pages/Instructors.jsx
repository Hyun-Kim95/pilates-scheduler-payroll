import { useState, useEffect } from 'react';
import { listInstructors, createInstructor, updateInstructor, deleteInstructor } from '../api/instructors';

const initialForm = { name: '', color: '#3498db', rate_type: 'fixed', rate_value: 0, base_salary: 0, phone: '' };

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
    if (editing) {
      updateInstructor(editing.id, form).then(() => {
        resetForm();
        setShowModal(false);
        load();
      });
    } else {
      createInstructor(form).then(() => {
        resetForm();
        setShowModal(false);
        load();
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
    });
    setShowModal(true);
  };

  return (
    <div>
      <div className="page-header">
        <h2>강사 관리</h2>
        <div className="page-header-actions">
          <button type="button" onClick={openCreateModal}>
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
                  <button type="button" onClick={() => openEditModal(i)}>수정</button>
                  <button type="button" onClick={() => handleDelete(i.id)}>삭제</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {showModal && (
        <div
          className="schedule-modal-backdrop"
          onClick={() => setShowModal(false)}
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
              <div className="slot-form-actions">
                <button type="submit">{editing ? '수정' : '등록'}</button>
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }}>취소</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
