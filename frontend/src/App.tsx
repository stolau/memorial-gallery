import { Routes, Route } from 'react-router-dom'
import PeopleIndex from './pages/PeopleIndex'
import PersonPage from './pages/PersonPage'
import EventsIndex from './pages/EventsIndex'
import EventPage from './pages/EventPage'
import Login from './pages/Login'
import ProtectedRoute from './auth/ProtectedRoute'
import { useAuth } from './auth/AuthContext'
import './App.css'

function AdminPlaceholder() {
  const { authed } = useAuth()
  return <div>Admin (coming soon) — authed: {String(authed)}</div>
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<PeopleIndex />} />
      <Route path="/events" element={<EventsIndex />} />
      <Route path="/events/:slug" element={<EventPage />} />
      <Route path="/login" element={<Login />} />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminPlaceholder />
          </ProtectedRoute>
        }
      />
      {/* Keep the catch-all person slug last for readability. */}
      <Route path="/:slug" element={<PersonPage />} />
    </Routes>
  )
}

export default App
