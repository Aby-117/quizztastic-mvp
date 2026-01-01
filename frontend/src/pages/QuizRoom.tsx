import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { io, Socket } from 'socket.io-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import axios from 'axios'
import { useToast } from '@/components/ui/use-toast'
import { Trophy, Users, Play } from 'lucide-react'

interface Player {
  id: number
  player_name: string
  score: number
}

interface Question {
  id: number
  text: string
  options: any[]
  timeLimit: number
  image?: string | null
}

export default function QuizRoom() {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const [socket, setSocket] = useState<Socket | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [totalQuestions, setTotalQuestions] = useState(0)
  const [quizStarted, setQuizStarted] = useState(false)
  const [showAnswer, setShowAnswer] = useState(false)
  const [correctOptionId, setCorrectOptionId] = useState<number | null>(null)
  const [statistics, setStatistics] = useState<any[]>([])
  const [leaderboard, setLeaderboard] = useState<Player[]>([])
  const [quizEnded, setQuizEnded] = useState(false)
  const [quizImage, setQuizImage] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    if (!roomId) return

    // Fetch quiz image
    const fetchQuizImage = async () => {
      try {
        const roomResponse = await axios.get(`http://localhost:5000/api/room/${roomId}`)
        if (roomResponse.data.quiz?.image_url) {
          setQuizImage(roomResponse.data.quiz.image_url)
        } else if (roomResponse.data.quiz_id) {
          const quizResponse = await axios.get(`http://localhost:5000/api/quiz/${roomResponse.data.quiz_id}`)
          if (quizResponse.data.image_url) {
            setQuizImage(quizResponse.data.image_url)
          }
        }
      } catch (error) {
        console.error('Failed to fetch quiz image:', error)
      }
    }
    fetchQuizImage()

    const newSocket = io('http://localhost:5000')
    setSocket(newSocket)

    newSocket.emit('host:join', { roomId })

    newSocket.on('host:joined', () => {
      console.log('Host joined room')
    })

    newSocket.on('player:joined', (data: { player: Player }) => {
      toast({
        title: 'Player Joined',
        description: `${data.player.player_name} joined the quiz`,
      })
      // The players:list event will update the full list
    })

    newSocket.on('players:list', (playersList: Player[]) => {
      console.log('Received players list:', playersList)
      setPlayers(playersList)
    })

    newSocket.on('leaderboard:update', (updatedLeaderboard: Player[]) => {
      setLeaderboard(updatedLeaderboard)
      setPlayers(updatedLeaderboard)
    })

    newSocket.on('question:show', (data: { question: Question; questionIndex: number; totalQuestions: number }) => {
      setCurrentQuestion(data.question)
      setQuestionIndex(data.questionIndex)
      setTotalQuestions(data.totalQuestions)
      setShowAnswer(false)
      setCorrectOptionId(null)
      setStatistics([])
    })

    newSocket.on('answer:show', (data: { correctOptionId: number; statistics: any[] }) => {
      setShowAnswer(true)
      setCorrectOptionId(data.correctOptionId)
      setStatistics(data.statistics)
    })

    newSocket.on('quiz:ended', (data: { leaderboard: Player[] }) => {
      setQuizEnded(true)
      setLeaderboard(data.leaderboard)
      setCurrentQuestion(null)
    })

    return () => {
      console.log('Cleaning up socket connection')
      newSocket.off('host:joined')
      newSocket.off('player:joined')
      newSocket.off('players:list')
      newSocket.off('leaderboard:update')
      newSocket.off('question:show')
      newSocket.off('answer:show')
      newSocket.off('quiz:ended')
      newSocket.close()
    }
  }, [roomId, toast])

  const handleStartQuiz = () => {
    if (socket && roomId) {
      socket.emit('quiz:start', { roomId })
      setQuizStarted(true)
    }
  }

  const getOptionColorClasses = (index: number, showAnswer: boolean, isCorrect: boolean) => {
    const colorClasses = [
      'bg-red-500 text-white border-red-600',
      'bg-blue-500 text-white border-blue-600',
      'bg-yellow-500 text-white border-yellow-600',
      'bg-green-500 text-white border-green-600',
    ]
    
    if (showAnswer) {
      if (isCorrect) {
        return 'bg-green-500 text-white border-green-600'
      }
      return 'bg-gray-100 border-gray-300 text-gray-800'
    }
    
    return colorClasses[index] || 'bg-gray-500 text-white border-gray-600'
  }

  const getOptionStats = (optionId: number) => {
    const stat = statistics.find((s) => s.optionId === optionId)
    return stat ? stat.count : 0
  }

  const totalAnswers = statistics.reduce((sum, s) => sum + s.count, 0)

  const handleBackToHome = () => {
    if (socket && roomId) {
      // Emit host leave event to end quiz
      socket.emit('host:leave', { roomId })
      socket.close()
    }
    navigate('/')
  }

  return (
    <div className="flex-1 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-4">
          <Button variant="outline" onClick={handleBackToHome}>
            ← Back to Home
          </Button>
        </div>
        <Card className="bg-white/95 backdrop-blur mb-6">
          <CardHeader>
            <CardTitle className="text-3xl">Quiz Room</CardTitle>
            <CardDescription>
              <div className="mt-2">
                <span className="text-2xl font-bold text-primary">Room Code: {roomId}</span>
                <p className="text-sm text-muted-foreground mt-1">Share this code with players to join</p>
              </div>
            </CardDescription>
          </CardHeader>
          {quizImage && (
            <CardContent>
              <img
                src={quizImage}
                alt="Quiz"
                className="w-full h-64 object-contain rounded-lg"
              />
            </CardContent>
          )}
        </Card>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="md:col-span-2">
            {!quizStarted && !quizEnded && (
              <Card className="bg-white/95 backdrop-blur">
                <CardHeader>
                  <CardTitle>Waiting to Start</CardTitle>
                  <CardDescription>
                    <div className="mt-2">
                      <span className="text-xl font-bold">Room Code: {roomId}</span>
                      <p className="text-sm mt-1">Players can join using this code</p>
                    </div>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={handleStartQuiz} className="w-full text-lg h-12" size="lg">
                    <Play className="h-5 w-5 mr-2" />
                    Start Quiz
                  </Button>
                </CardContent>
              </Card>
            )}

            {currentQuestion && !quizEnded && (
              <Card className="bg-white/95 backdrop-blur">
                <CardHeader>
                  <CardTitle className="text-2xl">
                    Question {questionIndex + 1} of {totalQuestions}
                  </CardTitle>
                  <CardDescription className="text-lg">
                    {currentQuestion.text}
                  </CardDescription>
                </CardHeader>
                {currentQuestion.image && (
                  <CardContent>
                    <img
                      src={currentQuestion.image}
                      alt="Question"
                      className="w-full h-64 object-contain rounded-lg mb-4"
                    />
                  </CardContent>
                )}
                <CardContent className="space-y-4">
                  {currentQuestion.options.map((option, index) => {
                    const stats = getOptionStats(option.id)
                    const percentage = totalAnswers > 0 ? (stats / totalAnswers) * 100 : 0
                    const isCorrect = showAnswer && option.id === correctOptionId
                    const colorClasses = getOptionColorClasses(index, showAnswer, isCorrect)

                    return (
                      <div
                        key={option.id}
                        className={`p-4 rounded-lg border-2 transition-all ${colorClasses}`}
                      >
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-semibold text-lg">{option.text}</span>
                          {showAnswer && (
                            <span className="text-sm">
                              {stats} {stats === 1 ? 'answer' : 'answers'} ({percentage.toFixed(0)}%)
                            </span>
                          )}
                        </div>
                        {showAnswer && (
                          <div className="w-full bg-white/20 rounded-full h-2">
                            <div
                              className="bg-white h-2 rounded-full transition-all"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            )}

            {quizEnded && (
              <Card className="bg-white/95 backdrop-blur">
                <CardHeader>
                  <CardTitle className="text-3xl flex items-center gap-2">
                    <Trophy className="h-8 w-8 text-yellow-500" />
                    Quiz Ended!
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold">Final Leaderboard</h3>
                    {leaderboard.map((player, index) => (
                      <div
                        key={player.id}
                        className="flex justify-between items-center p-4 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl font-bold">#{index + 1}</span>
                          <span className="text-lg font-semibold">{player.player_name}</span>
                        </div>
                        <span className="text-xl font-bold text-primary">{player.score} pts</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card className="bg-white/95 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Players ({players.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {players.map((player) => (
                    <div
                      key={player.id}
                      className="flex justify-between items-center p-2 bg-gray-50 rounded"
                    >
                      <span>{player.player_name}</span>
                      <span className="font-semibold">{player.score} pts</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

