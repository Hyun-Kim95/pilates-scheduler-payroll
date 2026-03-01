import { useState, useEffect } from 'react';
import { listMembers, createMember, updateMember, deleteMember } from '../api/members';
import { listInstructors } from '../api/instructors';
import { useInfiniteList } from '../hooks/useInfiniteList';

const PAGE_SIZE = 20;
const initialForm = { name: '', phone: '', instructor_id: '', memo: '' };

export default function Members() {
  const { list, total, loading, hasMore, sentinelRef, reset } = useInfiniteList(
    (offset) => listMembers({ limit: PAGE_SIZE, offset }),
    { pageSize: PAGE_SIZE }
  );
  const [instructors, setInstructors] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editing, setEditing] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    listInstructors()
      .then((data) => setInstructors(Array.isArray(data) ? data : (data?.items ?? [])))
      .catch(() => setInstructors([]));
  }, []);

  const load = () => reset();

  const resetForm = () => {
    setForm(initialForm);
    setEditing(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = { ...form, instructor_id: form.instructor_id || null };
    if (editing) {
      updateMember(editing.id, payload).then(() => {
        resetForm();
        setShowModal(false);
        load();
      });
    } else {
      createMember(payload).then(() => {
        resetForm();
        setShowModal(false);
        load();
      });
    }
  };

  const handleDelete = (id) => {
    if (window.confirm('삭제하시겠습니까?')) deleteMember(id).then(load);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (m) => {
    setEditing(m);
    setForm({
      name: m.name,
      phone: m.phone || '',
      instructor_id: m.instructor_id || '',
      memo: m.memo || '',
    });
    setShowModal(true);
  };

  return (
    <div className="members-page page-layout">
      <div className="page-header">
        <h2>회원 관리</h2>
        <div className="page-header-actions">
          <button type="button" className="btn btn-primary" onClick={openCreateModal}>
            회원 등록
          </button>
        </div>
      </div>
      <div className="page-card">
        {list.length === 0 && loading ? (
          <div className="page-loading">
            <div className="loading-spinner" />
            <p>회원 목록을 불러오는 중입니다.</p>
          </div>
        ) : (
          <>
            <div className="page-summary">
              <span>총 <strong>{total ?? list.length}</strong>명</span>
            </div>
            {list.length === 0 ? (
              <div className="page-empty">등록된 회원이 없습니다.</div>
            ) : (
              <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr><th>이름</th><th>연락처</th><th>담당 강사</th><th>메모</th><th></th></tr>
                </thead>
                <tbody>
                  {list.map((m) => (
                    <tr key={m.id}>
                      <td>{m.name}</td>
                      <td>{m.phone || '-'}</td>
                      <td>{m.instructor_name || '-'}</td>
                      <td>{m.memo || '-'}</td>
                      <td>
                        <div className="action-buttons">
                          <button type="button" className="btn btn-secondary" onClick={() => openEditModal(m)}>수정</button>
                          <button type="button" className="btn btn-danger" onClick={() => handleDelete(m.id)}>삭제</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
            {hasMore && <div ref={sentinelRef} className="infinite-sentinel" />}
            {loading && list.length > 0 && <div className="page-loading infinite-loading"><div className="loading-spinner" /><p>더 불러오는 중...</p></div>}
          </>
        )}
      </div>
      {showModal && (
        <div
          className="schedule-modal-backdrop"
        >
          <div
            className="schedule-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>{editing ? '회원 수정' : '회원 등록'}</h3>
            <form onSubmit={handleSubmit} className="slot-form">
              <input
                placeholder="회원명"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
              <input
                placeholder="연락처"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
              <select
                value={form.instructor_id}
                onChange={(e) => setForm({ ...form, instructor_id: e.target.value })}
              >
                <option value="">담당 강사 없음</option>
                {instructors.map((i) => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
              <input
                placeholder="메모"
                value={form.memo}
                onChange={(e) => setForm({ ...form, memo: e.target.value })}
              />
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
