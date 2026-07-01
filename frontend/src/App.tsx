import { Routes, Route } from 'react-router-dom'
import PeopleIndex from './pages/PeopleIndex'
import PersonPage from './pages/PersonPage'
import EventsIndex from './pages/EventsIndex'
import EventPage from './pages/EventPage'
import Login from './pages/Login'
import AdminDashboard from './pages/admin/AdminDashboard'
import PersonForm from './pages/admin/PersonForm'
import EventForm from './pages/admin/EventForm'
import ProtectedRoute from './auth/ProtectedRoute'
import './App.css'

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
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/people/new"
        element={
          <ProtectedRoute>
            <PersonForm />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/people/:slug/edit"
        element={
          <ProtectedRoute>
            <PersonForm />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/events/new"
        element={
          <ProtectedRoute>
            <EventForm />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/events/:slug/edit"
        element={
          <ProtectedRoute>
            <EventForm />
          </ProtectedRoute>
        }
      />
      {/* Keep the catch-all person slug last for readability. */}
      <Route path="/:slug" element={<PersonPage />} />
    </Routes>
  )
}

export default App
