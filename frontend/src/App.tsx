import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import CreateQuiz from './pages/CreateQuiz'
import EditQuiz from './pages/EditQuiz'
import QuizRoom from './pages/QuizRoom'
import PlayerView from './pages/PlayerView'
import Auth from './pages/Auth'
import MyQuizzes from './pages/MyQuizzes'
import Analytics from './pages/Analytics'
import { Toaster } from './components/ui/toaster'
import Footer from './components/Footer'
import NavBar from './components/NavBar'
import { AuthProvider } from './contexts/AuthContext'

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen flex flex-col">
          <NavBar />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/create" element={<CreateQuiz />} />
            <Route path="/edit/:id" element={<EditQuiz />} />
            <Route path="/my-quizzes" element={<MyQuizzes />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/room/:roomId" element={<QuizRoom />} />
            <Route path="/play/:roomId" element={<PlayerView />} />
          </Routes>
          <Footer />
          <Toaster />
        </div>
      </Router>
    </AuthProvider>
  )
}

export default App

