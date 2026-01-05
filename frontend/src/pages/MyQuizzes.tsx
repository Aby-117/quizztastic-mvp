import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import axios from 'axios'
import { useToast } from '@/components/ui/use-toast'
import { Trash2, Copy, Check, Edit, Lock, Globe, Pencil } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

export default function MyQuizzes() {
  const [quizzes, setQuizzes] = useState<any[]>([])
  const [copiedRoomCode, setCopiedRoomCode] = useState<string | null>(null)
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user, isLoading: authLoading } = useAuth()

  useEffect(() => {
    if (!authLoading && !user) {
      toast({
        title: 'Authentication Required',
        description: 'Please sign in to view your quizzes',
        variant: 'destructive',
      })
      navigate('/auth')
      return
    }
    if (user) {
      fetchMyQuizzes()
    }
  }, [user, authLoading, navigate, toast])

  const fetchMyQuizzes = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/quiz/my')
      setQuizzes(response.data)
    } catch (error) {
      console.error('Failed to fetch quizzes:', error)
      toast({
        title: 'Error',
        description: 'Failed to load your quizzes',
        variant: 'destructive',
      })
    }
  }

  const handleStartQuiz = async (quizId: number, activeRoomCode?: string | null) => {
    if (!user) return
    
    if (activeRoomCode) {
      navigate(`/room/${activeRoomCode}`)
      return
    }
    
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
      fetchMyQuizzes()
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

  if (authLoading || !user) {
    return (
      <div className="flex-1 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 p-8 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
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
        <div className="mb-6 animate-fade-in">
          <Button 
            variant="outline" 
            onClick={() => navigate('/')}
            className="bg-white/90 hover:bg-white hover:scale-105 transition-all duration-200 shadow-md hover:shadow-lg"
          >
            ← Back to Home
          </Button>
        </div>

        <div className="text-center mb-12 animate-fade-in">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-4 drop-shadow-lg animate-scale-in">
            My Quizzes
          </h1>
          <p className="text-xl md:text-2xl text-white/90 drop-shadow-md animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            Manage your quiz collection
          </p>
        </div>

        <Card className="bg-white/95 backdrop-blur shadow-xl animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
          <CardHeader>
            <CardTitle className="text-3xl bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Your Quizzes
            </CardTitle>
            <CardDescription>Create, manage, and start quiz sessions</CardDescription>
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
                            <Globe className="h-4 w-4 text-green-600" title="Public" />
                          ) : (
                            <Lock className="h-4 w-4 text-red-600" title="Private" />
                          )}
                        </div>
                        <CardDescription className="line-clamp-2">{quiz.description || 'No description'}</CardDescription>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/edit/${quiz.id}`)}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-all duration-200 hover:scale-110"
                          title="Edit Quiz"
                        >
                          <Pencil className="h-4 w-4" />
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
                    </div>
                    {quiz.activeRoomCode && (
                      <div className="mt-3 p-2 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="text-xs text-gray-600 mb-1">Active Room Code</p>
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-bold text-green-700 font-mono">{quiz.activeRoomCode}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 hover:bg-green-100"
                                onClick={() => handleCopyRoomCode(quiz.activeRoomCode)}
                              >
                                {copiedRoomCode === quiz.activeRoomCode ? (
                                  <Check className="h-3 w-3 text-green-600" />
                                ) : (
                                  <Copy className="h-3 w-3 text-green-600" />
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    <Button
                      onClick={() => handleStartQuiz(quiz.id, quiz.activeRoomCode)}
                      className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105"
                    >
                      {quiz.activeRoomCode ? 'Join Active Room' : 'Start Quiz'}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
            {quizzes.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">You haven't created any quizzes yet.</p>
                <Button
                  onClick={() => navigate('/create')}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                >
                  Create Your First Quiz
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

