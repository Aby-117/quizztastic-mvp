import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import axios from 'axios'
import { useToast } from '@/components/ui/use-toast'
import { Trash2 } from 'lucide-react'

export default function Home() {
  const [roomCode, setRoomCode] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [quizzes, setQuizzes] = useState<any[]>([])
  const navigate = useNavigate()
  const { toast } = useToast()

  useEffect(() => {
    fetchQuizzes()
  }, [])

  const fetchQuizzes = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/quiz')
      setQuizzes(response.data)
    } catch (error) {
      console.error('Failed to fetch quizzes:', error)
    }
  }

  const handleCreateQuiz = () => {
    navigate('/create')
  }

  const handleJoinRoom = () => {
    if (!roomCode || !playerName) {
      toast({
        title: 'Error',
        description: 'Please enter both room code and player name',
        variant: 'destructive',
      })
      return
    }
    navigate(`/play/${roomCode}`, { state: { playerName } })
  }

  const handleStartQuiz = async (quizId: number) => {
    try {
      const response = await axios.post('http://localhost:5000/api/room', {
        quizId,
        hostId: 'host-' + Date.now(),
      })
      navigate(`/room/${response.data.id}`)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create room',
        variant: 'destructive',
      })
    }
  }

  const handleDeleteQuiz = async (quizId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Are you sure you want to delete this quiz? This action cannot be undone.')) {
      return
    }

    try {
      await axios.delete(`http://localhost:5000/api/quiz/${quizId}`)
      toast({
        title: 'Success',
        description: 'Quiz deleted successfully',
      })
      fetchQuizzes() // Refresh the list
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to delete quiz',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="flex-1 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-6xl font-bold text-white mb-4 drop-shadow-lg">
            Quiz App
          </h1>
          <p className="text-2xl text-white/90 drop-shadow-md">
            Create and play interactive quizzes like Kahoot!
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-8">
          {/* Join Room Card */}
          <Card className="bg-white/95 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-3xl">Join a Quiz</CardTitle>
              <CardDescription>Enter a room code to join an ongoing quiz</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="roomCode">Room Code</Label>
                <Input
                  id="roomCode"
                  placeholder="Enter room code"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  className="text-2xl text-center font-bold"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="playerName">Your Name</Label>
                <Input
                  id="playerName"
                  placeholder="Enter your name"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                />
              </div>
              <Button onClick={handleJoinRoom} className="w-full text-lg h-12">
                Join Quiz
              </Button>
            </CardContent>
          </Card>

          {/* Create Quiz Card */}
          <Card className="bg-white/95 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-3xl">Create a Quiz</CardTitle>
              <CardDescription>Build your own interactive quiz</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleCreateQuiz} className="w-full text-lg h-12">
                Create New Quiz
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Existing Quizzes */}
        <Card className="bg-white/95 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-3xl">Available Quizzes</CardTitle>
            <CardDescription>Start a quiz session with an existing quiz</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              {quizzes.map((quiz) => (
                <Card key={quiz.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle>{quiz.title}</CardTitle>
                        <CardDescription>{quiz.description || 'No description'}</CardDescription>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => handleDeleteQuiz(quiz.id, e)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Button
                      onClick={() => handleStartQuiz(quiz.id)}
                      className="w-full"
                    >
                      Start Quiz
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
            {quizzes.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No quizzes available. Create one to get started!
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

