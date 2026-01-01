import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import CreateQuiz from './pages/CreateQuiz'
import QuizRoom from './pages/QuizRoom'
import PlayerView from './pages/PlayerView'
import { Toaster } from './components/ui/toaster'
import Footer from './components/Footer'

function App() {
  return (
    <Router>
      <div className="min-h-screen flex flex-col">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/create" element={<CreateQuiz />} />
          <Route path="/room/:roomId" element={<QuizRoom />} />
          <Route path="/play/:roomId" element={<PlayerView />} />
        </Routes>
        <Footer />
        <Toaster />
      </div>
    </Router>
  )
}

export default App

