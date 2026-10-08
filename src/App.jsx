import { useEffect, useState } from 'react'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
const TODAY = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
}).format(new Date())

async function requestTodos(path = '', options = {}) {
  let response
  try {
    response = await fetch(`${API_BASE_URL}/todos${path}`, {
      ...options,
      headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    })
  } catch {
    throw new Error('서버에 연결할 수 없어요. 백엔드가 실행 중인지 확인해 주세요.')
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.error || '요청을 처리하지 못했어요. 다시 시도해 주세요.')
  }
  return response.status === 204 ? null : response.json()
}

function App() {
  const [todos, setTodos] = useState([])
  const [newTitle, setNewTitle] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')

  async function loadTodos() {
    setLoading(true)
    setError('')
    try {
      setTodos(await requestTodos())
    } catch (cause) {
      setError(cause.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    requestTodos()
      .then((items) => { if (active) setTodos(items) })
      .catch((cause) => { if (active) setError(cause.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  async function addTodo(event) {
    event.preventDefault()
    const title = newTitle.trim()
    if (!title || creating) return
    setCreating(true)
    setError('')
    try {
      const created = await requestTodos('', { method: 'POST', body: JSON.stringify({ title }) })
      setTodos((current) => [created, ...current])
      setNewTitle('')
      setFilter('all')
    } catch (cause) {
      setError(cause.message)
    } finally {
      setCreating(false)
    }
  }

  async function updateTodo(id, changes) {
    if (busyId) return false
    setBusyId(id)
    setError('')
    try {
      const updated = await requestTodos(`/${id}`, { method: 'PATCH', body: JSON.stringify(changes) })
      setTodos((current) => current.map((todo) => todo._id === id ? updated : todo))
      return true
    } catch (cause) {
      setError(cause.message)
      return false
    } finally {
      setBusyId(null)
    }
  }

  async function saveEdit(event, id) {
    event.preventDefault()
    const title = editTitle.trim()
    if (!title) {
      setError('할 일을 입력해 주세요.')
      return
    }
    if (await updateTodo(id, { title })) {
      setEditingId(null)
      setEditTitle('')
    }
  }

  async function deleteTodo(id) {
    if (busyId) return
    setBusyId(id)
    setError('')
    try {
      await requestTodos(`/${id}`, { method: 'DELETE' })
      setTodos((current) => current.filter((todo) => todo._id !== id))
      if (editingId === id) setEditingId(null)
    } catch (cause) {
      setError(cause.message)
    } finally {
      setBusyId(null)
    }
  }

  const completedCount = todos.filter((todo) => todo.completed).length
  const activeCount = todos.length - completedCount
  const visibleTodos = todos.filter((todo) => filter === 'active' ? !todo.completed : filter === 'completed' ? todo.completed : true)
  return (
    <main className="app-shell">
      <header className="page-header">
        <div className="brand"><span className="brand-mark">✓</span> My Todo</div>
        <p className="today">{TODAY}</p>
        <h1>할 일을 차근차근<br />끝내볼까요?</h1>
        <p className="intro">해야 할 일을 적고, 하나씩 완료해 보세요.</p>
      </header>

      <section className="composer card" aria-labelledby="add-heading">
        <h2 id="add-heading">새로운 할 일</h2>
        <form onSubmit={addTodo} className="add-form">
          <label className="sr-only" htmlFor="new-todo">할 일 입력</label>
          <input id="new-todo" type="text" value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="무엇을 해야 하나요?" maxLength={500} disabled={creating} />
          <button className="primary-button" type="submit" disabled={!newTitle.trim() || creating}>{creating ? '추가 중...' : '추가하기'}</button>
        </form>
      </section>

      <section className="list-section" aria-labelledby="list-heading">
        <div className="list-heading-row">
          <div>
            <h2 id="list-heading">내 할 일</h2>
            <p className="list-summary">남은 할 일 <strong>{activeCount}</strong>개 · 완료 <strong>{completedCount}</strong>개</p>
          </div>
          <span className="total-badge">전체 {todos.length}</span>
        </div>
        <div className="filters" role="group" aria-label="할 일 필터">
          {[['all', '전체'], ['active', '진행 중'], ['completed', '완료']].map(([value, label]) => (
            <button key={value} type="button" className={`filter-button ${filter === value ? 'selected' : ''}`} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>
          ))}
        </div>

        {error && <div className="error-message" role="alert"><span>{error}</span>{!loading && todos.length === 0 && <button type="button" onClick={loadTodos}>다시 시도</button>}</div>}
        {loading ? (
          <div className="empty-state card" role="status">할 일을 불러오는 중이에요...</div>
        ) : error && todos.length === 0 ? null : visibleTodos.length === 0 ? (
          <div className="empty-state card">
            <div className="empty-icon" aria-hidden="true">✓</div>
            <strong>{filter === 'active' ? '남은 할 일이 없어요' : filter === 'completed' ? '완료한 할 일이 없어요' : '아직 할 일이 없어요'}</strong>
            <p>{filter === 'all' ? '위에서 첫 번째 할 일을 추가해 보세요.' : '다른 목록을 확인하거나 새 할 일을 추가해 보세요.'}</p>
          </div>
        ) : (
          <ul className="todo-list">
            {visibleTodos.map((todo) => (
              <li key={todo._id} className={`todo-item card ${todo.completed ? 'is-completed' : ''}`}>
                <button type="button" className="check-button" aria-label={`${todo.title} ${todo.completed ? '완료 취소' : '완료'}`} aria-pressed={todo.completed} onClick={() => updateTodo(todo._id, { completed: !todo.completed })} disabled={busyId !== null}>{todo.completed && <span aria-hidden="true">✓</span>}</button>
                {editingId === todo._id ? (
                  <form className="edit-form" onSubmit={(event) => saveEdit(event, todo._id)}>
                    <label className="sr-only" htmlFor={`edit-${todo._id}`}>할 일 수정</label>
                    <input id={`edit-${todo._id}`} autoFocus value={editTitle} onChange={(event) => setEditTitle(event.target.value)} maxLength={500} disabled={busyId === todo._id} />
                    <button className="text-button save-button" type="submit" disabled={!editTitle.trim() || busyId === todo._id}>저장</button>
                    <button className="text-button" type="button" onClick={() => setEditingId(null)} disabled={busyId === todo._id}>취소</button>
                  </form>
                ) : (
                  <>
                    <span className="todo-title">{todo.title}</span>
                    <div className="todo-actions">
                      <button className="text-button" type="button" onClick={() => { setEditingId(todo._id); setEditTitle(todo.title); setError('') }} disabled={busyId !== null} aria-label={`${todo.title} 수정`}>수정</button>
                      <button className="text-button delete-button" type="button" onClick={() => deleteTodo(todo._id)} disabled={busyId !== null} aria-label={`${todo.title} 삭제`}>삭제</button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}

export default App
