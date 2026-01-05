import { useEffect, useState } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { io, Socket } from 'socket.io-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { Trophy, CheckCircle, XCircle, LogOut } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

interface Question {
  id: number
  text: string
  options: Array<{
    id: number
    text: string
    color: string
  }>
  timeLimit: number
  image?: string | null
}

export default function PlayerView() {
  const { roomId } = useParams<{ roomId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const playerName = location.state?.playerName || 'Player'
  const { user } = useAuth()
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [totalQuestions, setTotalQuestions] = useState(0)
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [timeLeft, setTimeLeft] = useState(30)
  const [answerResult, setAnswerResult] = useState<{
    isCorrect: boolean
    correctOptionId: number
  } | null>(null)
  const [score, setScore] = useState(0)
  const [quizStarted, setQuizStarted] = useState(false)
  const [quizEnded, setQuizEnded] = useState(false)
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [joinPending, setJoinPending] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (!roomId) {
      navigate('/')
      return
    }

    const newSocket = io('http://localhost:5000')
    setSocket(newSocket)

    newSocket.on('connect', () => {
      newSocket.emit('player:join', { roomId, playerName })
    })

    newSocket.on('players:list', () => {
      setConnected(true)
      setJoinPending(false)
      toast({
        title: 'Connected',
        description: 'Successfully joined the quiz room',
      })
    })

    newSocket.on('player:join:pending', (data: { message: string }) => {
      setJoinPending(true)
      setConnected(false)
      toast({
        title: 'Waiting for Approval',
        description: data.message,
        duration: 5000,
      })
    })

    newSocket.on('player:join:approved', (data: { message: string }) => {
      setJoinPending(false)
      toast({
        title: 'Join Approved!',
        description: data.message,
      })
    })

    newSocket.on('player:join:denied', (data: { message: string }) => {
      setJoinPending(false)
      toast({
        title: 'Join Denied',
        description: data.message,
        variant: 'destructive',
      })
      setTimeout(() => {
        navigate('/')
      }, 2000)
    })

    newSocket.on('error', (data: { message: string }) => {
      toast({
        title: 'Join Failed',
        description: data.message || 'Failed to join the quiz room',
        variant: 'destructive',
      })
      // navigate back to home after showing error
      setTimeout(() => {
        navigate('/')
      }, 2000)
    })

    newSocket.on('quiz:started', (data: { totalQuestions: number; lateJoiner?: boolean }) => {
      setQuizStarted(true)
      setTotalQuestions(data.totalQuestions)
      if (data.lateJoiner) {
        toast({
          title: 'Joined Quiz in Progress',
          description: 'You joined the quiz mid-session. You can still answer remaining questions!',
        })
      }
    })

    // listen for server timer updates to keep all players synchronized
    newSocket.on('timer:update', (data: { remaining: number; elapsed: number }) => {
      setTimeLeft(data.remaining)
    })

    newSocket.on('question:show', (data: {
      question: Question
      questionIndex: number
      totalQuestions: number
      lateJoiner?: boolean
      startTime?: number
    }) => {
      setCurrentQuestion(data.question)
      setQuestionIndex(data.questionIndex)
      setTotalQuestions(data.totalQuestions)
      setSelectedOption(null)
      setAnswerResult(null)
      
      // use server startTime if provided for initial sync, otherwise use full time limit
      // the server will send timer:update events to keep us synchronized
      if (data.startTime) {
        // calculate initial remaining time based on server timestamp
        const elapsed = Math.floor((Date.now() - data.startTime) / 1000)
        const remaining = Math.max(0, data.question.timeLimit - elapsed)
        setTimeLeft(remaining)
      } else {
        // fallback to full time limit (shouldn't happen with new code)
        setTimeLeft(data.question.timeLimit)
      }
    })

    newSocket.on('answer:result', (data: { isCorrect: boolean; correctOptionId: number }) => {
      setAnswerResult(data)
      if (data.isCorrect) {
        toast({
          title: 'Correct!',
          description: 'Great job!',
        })
      } else {
        toast({
          title: 'Incorrect',
          description: 'Better luck next time',
          variant: 'destructive',
        })
      }
    })

    newSocket.on('leaderboard:update', (data: any[]) => {
      const myScore = data.find((p) => p.player_name === playerName)
      if (myScore) {
        setScore(myScore.score)
      }
    })

    newSocket.on('quiz:ended', (data: { leaderboard: any[] }) => {
      setQuizEnded(true)
      setLeaderboard(data.leaderboard)
      setCurrentQuestion(null)
    })

    return () => {
      newSocket.close()
    }
  }, [roomId, playerName, navigate, toast])

  const handleAnswer = (optionId: number) => {
    if (selectedOption !== null || !currentQuestion || !socket || !roomId) return

    setSelectedOption(optionId)
    const timeTaken = currentQuestion.timeLimit - timeLeft

    socket.emit('answer:submit', {
      roomId,
      questionId: currentQuestion.id,
      optionId,
      timeTaken,
    })
  }

  const handleQuit = () => {
    if (socket) {
      socket.emit('player:leave', { roomId })
      socket.close()
    }
    navigate('/')
    toast({
      title: 'Left Quiz',
      description: 'You have left the quiz',
    })
  }

  const getOptionColorClasses = (color: string, index: number, isSelected: boolean, isCorrect: boolean, isWrong: boolean, showCorrect: boolean) => {
    const colorMap: { [key: string]: string } = {
      red: 'bg-red-500 hover:bg-red-600 border-red-600',
      blue: 'bg-blue-500 hover:bg-blue-600 border-blue-600',
      yellow: 'bg-yellow-500 hover:bg-yellow-600 border-yellow-600',
      green: 'bg-green-500 hover:bg-green-600 border-green-600',
    }
    
    // Fallback to index-based colors if color not provided
    const fallbackColors = [
      'bg-red-500 hover:bg-red-600 border-red-600',
      'bg-blue-500 hover:bg-blue-600 border-blue-600',
      'bg-yellow-500 hover:bg-yellow-600 border-yellow-600',
      'bg-green-500 hover:bg-green-600 border-green-600',
    ]
    
    let baseClasses = colorMap[color] || fallbackColors[index] || 'bg-gray-500 hover:bg-gray-600 border-gray-600'
    
    if (isSelected) {
      baseClasses += ' ring-4 ring-offset-2'
    }
    
    if (showCorrect && !isSelected && !isWrong) {
      baseClasses += ' ring-4 ring-green-500 ring-offset-2'
    }
    
    return baseClasses
  }

  if (joinPending) {
    return (
      <div className="flex-1 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center p-8">
        <Card className="bg-white/95 backdrop-blur">
          <CardContent className="p-8 space-y-4 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-xl font-semibold">Waiting for Host Approval</p>
            <p className="text-gray-600">The host needs to approve your request to join this active quiz session.</p>
            <Button variant="outline" onClick={() => navigate('/')}>
              ← Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!connected) {
    return (
      <div className="flex-1 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center p-8">
        <Card className="bg-white/95 backdrop-blur">
          <CardContent className="p-8 space-y-4">
            <p className="text-xl">Connecting to room {roomId}...</p>
            <Button variant="outline" onClick={() => navigate('/')}>
              ← Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!quizStarted && !quizEnded) {
    return (
      <div className="flex-1 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center p-8">
        <Card className="bg-white/95 backdrop-blur max-w-2xl w-full">
          <CardHeader>
            <CardTitle className="text-3xl">Waiting for Players to Join</CardTitle>
            {user && (
              <CardDescription className="text-lg font-semibold">Room Code: {roomId}</CardDescription>
            )}
            {!user && (
              <CardDescription>Please wait while the host begins the quiz session</CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-lg font-medium text-blue-900">
                Hello, <span className="font-bold">{playerName}</span>! 
              </p>
              <p className="text-sm text-blue-700 mt-2">
                You've successfully joined the room. The host will begin the quiz session shortly.
              </p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Your Score: <span className="font-bold">{score} points</span></p>
            </div>
            <Button variant="outline" onClick={handleQuit} className="w-full">
              <LogOut className="h-4 w-4 mr-2" />
              Quit Quiz
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (quizEnded) {
    const myRank = leaderboard.findIndex((p) => p.player_name === playerName) + 1

    return (
      <div className="flex-1 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-4">
            <Button variant="outline" onClick={() => navigate('/')}>
              ← Back to Home
            </Button>
          </div>
          <Card className="bg-white/95 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-3xl flex items-center gap-2">
                <Trophy className="h-8 w-8 text-yellow-500" />
                Quiz Finished!
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center p-6 bg-primary/10 rounded-lg">
                <p className="text-2xl font-semibold mb-2">Your Final Score</p>
                <p className="text-5xl font-bold text-primary">{score} points</p>
                <p className="text-xl mt-4">You ranked #{myRank} out of {leaderboard.length}</p>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-4">Final Leaderboard</h3>
                <div className="space-y-2">
                  {leaderboard.map((player, index) => (
                    <div
                      key={player.id}
                      className={`flex justify-between items-center p-4 rounded-lg ${
                        player.player_name === playerName
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl font-bold">#{index + 1}</span>
                        <span className="text-lg font-semibold">{player.player_name}</span>
                        {player.player_name === playerName && <span>(You)</span>}
                      </div>
                      <span className="text-xl font-bold">{player.score} pts</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-4">
          <Button variant="outline" onClick={handleQuit}>
            <LogOut className="h-4 w-4 mr-2" />
            Quit Quiz
          </Button>
        </div>
        <Card className="bg-white/95 backdrop-blur mb-6">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-2xl">
                  Question {questionIndex + 1} of {totalQuestions}
                </CardTitle>
                <CardDescription className="text-lg mt-2">
                  {currentQuestion?.text}
                </CardDescription>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-primary">{timeLeft}s</div>
                <div className="text-sm text-muted-foreground">Time Left</div>
              </div>
            </div>
          </CardHeader>
          {currentQuestion?.image && (
            <CardContent>
              <img
                src={currentQuestion.image}
                alt="Question"
                className="w-full h-64 object-contain rounded-lg mb-4"
              />
            </CardContent>
          )}
          <CardContent className="space-y-4">
            {currentQuestion?.options.map((option, index) => {
              const isSelected = selectedOption === option.id
              const isCorrect = !!(answerResult?.isCorrect && isSelected)
              const isWrong = !!(answerResult && !answerResult.isCorrect && isSelected)
              const showCorrect = !!(answerResult && option.id === answerResult.correctOptionId)
              const colorClasses = getOptionColorClasses(
                option.color || '',
                index,
                isSelected,
                isCorrect,
                isWrong,
                showCorrect
              )

              return (
                <button
                  key={option.id}
                  onClick={() => handleAnswer(option.id)}
                  disabled={selectedOption !== null || timeLeft === 0}
                  className={`w-full p-6 rounded-lg border-2 text-left text-white font-semibold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${colorClasses}`}
                >
                  <div className="flex items-center justify-between">
                    <span>{option.text}</span>
                    {isCorrect && <CheckCircle className="h-6 w-6" />}
                    {isWrong && <XCircle className="h-6 w-6" />}
                    {showCorrect && !isSelected && !isWrong && (
                      <span className="text-sm">Correct Answer</span>
                    )}
                  </div>
                </button>
              )
            })}
          </CardContent>
        </Card>

        <Card className="bg-white/95 backdrop-blur">
          <CardContent className="p-4">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold">{playerName}</span>
              <span className="text-xl font-bold text-primary">Score: {score} pts</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

