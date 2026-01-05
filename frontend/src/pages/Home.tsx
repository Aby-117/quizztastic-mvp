import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import axios from 'axios'
import { useToast } from '@/components/ui/use-toast'
import { Trash2, Copy, Check, Globe, Lock, Edit } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

export default function Home() {
  const [roomCode, setRoomCode] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [quizzes, setQuizzes] = useState<any[]>([])
  const [copiedRoomCode, setCopiedRoomCode] = useState<string | null>(null)
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user } = useAuth()

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
    if (!user) {
      toast({
        title: 'Authentication Required',
        description: 'Please sign in to create a quiz',
        variant: 'destructive',
      })
      navigate('/auth')
      return
    }
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

  const handleStartQuiz = async (quizId: number, activeRoomCode?: string | null) => {
    if (!user) {
      toast({
        title: 'Authentication Required',
        description: 'Please sign in to create a quiz room',
        variant: 'destructive',
      })
      navigate('/auth')
      return
    }
    
    // If there's an active room, navigate to it directly
    if (activeRoomCode) {
      navigate(`/room/${activeRoomCode}`)
      return
    }
    
    // Otherwise, create a new room
    try {
      const response = await axios.post('http://localhost:5000/api/room', {
        quizId,
      })
      navigate(`/room/${response.data.id}`)
    } catch (error: any) {
      if (error.response?.status === 401) {
        toast({
          title: 'Authentication Required',
          description: 'Please sign in to create a quiz room',
          variant: 'destructive',
        })
        navigate('/auth')
      } else {
        toast({
          title: 'Error',
          description: error.response?.data?.error || 'Failed to create room',
          variant: 'destructive',
        })
      }
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

  const handleCopyRoomCode = (roomCode: string) => {
    navigator.clipboard.writeText(roomCode)
    setCopiedRoomCode(roomCode)
    toast({
      title: 'Copied!',
      description: 'Room code copied to clipboard',
    })
    setTimeout(() => setCopiedRoomCode(null), 2000)
  }

  return (
    <div className="flex-1 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 p-8 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-float"></div>
        <div className="absolute top-40 right-10 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-float" style={{ animationDelay: '1s' }}></div>
        <div className="absolute bottom-20 left-1/2 w-72 h-72 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-float" style={{ animationDelay: '2s' }}></div>
      </div>
      
      <div className="max-w-6xl mx-auto relative z-10">
        <div className="text-center mb-12 animate-fade-in">
          <h1 className="text-6xl md:text-7xl font-bold text-white mb-4 drop-shadow-lg animate-scale-in">
            Quiztastic
            <span className="text-2xl md:text-3xl ml-3 text-white/80">(v 0.0.2)</span>
          </h1>
          <p className="text-2xl md:text-3xl text-white/90 drop-shadow-md animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            Welcome {user ? user.name : 'Guest'} to Quiztastic
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-8">
          {/* Join Room Card */}
          <Card className="bg-white/95 backdrop-blur shadow-xl hover:shadow-2xl transition-all duration-300 animate-slide-in-right hover:scale-105">
            <CardHeader>
              <CardTitle className="text-3xl bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Join a Quiz
              </CardTitle>
              <CardDescription>Enter a room code to join an ongoing quiz</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="roomCode">Room Code</Label>
                <Input
                  id="roomCode"
                  placeholder="Enter room code"
                  value={roomCode}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRoomCode(e.target.value.toUpperCase())}
                  className="text-2xl text-center font-bold transition-all duration-200 focus:scale-105 focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="playerName">Your Name</Label>
                <Input
                  id="playerName"
                  placeholder="Enter your name"
                  value={playerName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPlayerName(e.target.value)}
                  className="transition-all duration-200 focus:scale-105 focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <Button 
                onClick={handleJoinRoom} 
                className="w-full text-lg h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
              >
                Join Quiz
              </Button>
            </CardContent>
          </Card>

          {/* Create Quiz Card */}
          <Card className="bg-white/95 backdrop-blur shadow-xl hover:shadow-2xl transition-all duration-300 animate-slide-in-left hover:scale-105">
            <CardHeader>
              <CardTitle className="text-3xl bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                Create a Quiz
              </CardTitle>
              <CardDescription>Build your own interactive quiz</CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={handleCreateQuiz} 
                className="w-full text-lg h-12 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
              >
                Create New Quiz
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Existing Quizzes */}
        <Card className="bg-white/95 backdrop-blur shadow-xl animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
          <CardHeader>
            <CardTitle className="text-3xl bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Available Quizzes
            </CardTitle>
            <CardDescription>Start a quiz session with an existing quiz</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              {quizzes.map((quiz, index) => (
                <Card 
                  key={quiz.id} 
                  className="hover:shadow-xl transition-all duration-300 hover:scale-105 hover:-translate-y-2 border-2 hover:border-purple-300 animate-scale-in overflow-hidden"
                  style={{ animationDelay: `${0.5 + index * 0.1}s` }}
                >
                  {quiz.image_url && (
                    <div className="w-full h-48 overflow-hidden bg-gradient-to-br from-blue-100 to-purple-100">
                      <img
                        src={quiz.image_url}
                        alt={quiz.title}
                        className="w-full h-full object-cover transition-transform duration-300 hover:scale-110"
                      />
                    </div>
                  )}
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <CardTitle className="group-hover:text-purple-600 transition-colors">{quiz.title}</CardTitle>
                          {quiz.is_public ? (
                            <div title="Public Quiz">
                              <Globe className="h-4 w-4 text-green-600" />
                            </div>
                          ) : (
                            <div title="Private Quiz">
                              <Lock className="h-4 w-4 text-red-600" />
                            </div>
                          )}
                        </div>
                        <CardDescription className="line-clamp-2">{quiz.description || 'No description'}</CardDescription>
                      </div>
                      {user && quiz.created_by === user.id && (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/edit/${quiz.id}`)}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-all duration-200 hover:scale-110"
                            title="Edit Quiz"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => handleDeleteQuiz(quiz.id, e)}
                            className="text-destructive hover:text-destructive hover:bg-red-50 transition-all duration-200 hover:scale-110"
                            title="Delete Quiz"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                    {quiz.is_public && quiz.activeRoomCode && (
                      <div className="mt-3 p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border-2 border-green-300 shadow-sm">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="text-xs font-semibold text-green-800 mb-1 flex items-center gap-1">
                              <Globe className="h-3 w-3" />
                              Public Quiz - Active Room Code
                            </p>
                            <div className="flex items-center gap-2">
                              <span className="text-xl font-bold text-green-700 font-mono tracking-wider">{quiz.activeRoomCode}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 hover:bg-green-100"
                                onClick={() => handleCopyRoomCode(quiz.activeRoomCode)}
                              >
                                {copiedRoomCode === quiz.activeRoomCode ? (
                                  <Check className="h-4 w-4 text-green-600" />
                                ) : (
                                  <Copy className="h-4 w-4 text-green-600" />
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    {quiz.is_public && !quiz.activeRoomCode && (
                      <div className="mt-3 p-2 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-xs text-blue-700 flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          Public Quiz - No active room. Click "Start Quiz" to create one.
                        </p>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    {quiz.activeRoomCode ? (
                      <Button
                        onClick={() => {
                          if (!user) {
                            toast({
                              title: 'Authentication Required',
                              description: 'Please sign in to join quiz rooms',
                              variant: 'destructive',
                            })
                            navigate('/auth')
                            return
                          }
                          handleStartQuiz(quiz.id, quiz.activeRoomCode)
                        }}
                        disabled={!user}
                        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                      >
                        Join Active Room
                      </Button>
                    ) : (
                      <Button
                        onClick={() => handleStartQuiz(quiz.id, quiz.activeRoomCode)}
                        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105"
                      >
                        Start Quiz
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
            {quizzes.length === 0 && (
              <p className="text-center text-muted-foreground py-8 animate-pulse-slow">
                No quizzes available. Create one to get started!
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

