import { Routes, Route } from 'react-router-dom'
import PeopleIndex from './pages/PeopleIndex'
import PersonPage from './pages/PersonPage'
import EventsIndex from './pages/EventsIndex'
import EventPage from './pages/EventPage'
import './App.css'

function App() {
  return (
    <Routes>
      <Route path="/" element={<PeopleIndex />} />
      <Route path="/events" element={<EventsIndex />} />
      <Route path="/events/:slug" element={<EventPage />} />
      {/* Keep the catch-all person slug last for readability. */}
      <Route path="/:slug" element={<PersonPage />} />
    </Routes>
  )
}

export default App
