import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import axios from 'axios'
import { useToast } from '@/components/ui/use-toast'
import { BarChart3, Trophy, Users, Calendar, ArrowLeft, AlertCircle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

interface Session {
  id: number
  room_id: string
  quiz_id: number
  quiz_title: string
  quiz_image: string | null
  total_players: number
  started_at: string
  ended_at: string
  leaderboard: Array<{
    player_name: string
    score: number
    rank: number
  }>
  winner: {
    name: string
    score: number
  } | null
  questionStats: Array<{
    question_id: number
    question_text: string
    order_index: number
    total_answers: number
    correct_answers: number
    incorrect_answers: number
    accuracy: string
    incorrectRate: string
  }>
  mostIncorrectQuestion: {
    question_text: string
    order_index: number
    incorrect_answers: number
    total_answers: number
    incorrectRate: string
  } | null
}

export default function Analytics() {
  // state to store all the quiz sessions
  const [sessions, setSessions] = useState<Session[]>([])
  // state to track which session the user clicked on to see details
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  // loading state while we fetch data from api
  const [isLoading, setIsLoading] = useState(true)
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user, isLoading: authLoading } = useAuth()

  // when component loads, check if user is logged in and fetch analytics
  useEffect(() => {
    // if auth finished loading and no user, redirect to login
    if (!authLoading && !user) {
      toast({
        title: 'Authentication Required',
        description: 'Please sign in to view analytics',
        variant: 'destructive',
      })
      navigate('/auth')
      return
    }
    // if user exists, fetch their analytics data
    if (user) {
      fetchAnalytics()
    }
  }, [user, authLoading, navigate, toast])

  // function to get analytics data from backend api
  const fetchAnalytics = async () => {
    try {
      // get the jwt token from local storage
      const token = localStorage.getItem('token')
      if (!token) {
        toast({
          title: 'Authentication Required',
          description: 'Please sign in to view analytics',
          variant: 'destructive',
        })
        navigate('/auth')
        return
      }
      // make api call to get analytics - sends token in header for auth
      const response = await axios.get('http://localhost:5000/api/analytics', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      console.log('Analytics data received:', response.data)
      // save the sessions data to state
      setSessions(response.data)
      setIsLoading(false)
    } catch (error: any) {
      console.error('Failed to fetch analytics:', error)
      console.error('Error details:', error.response?.data)
      // show error message to user
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to fetch analytics',
        variant: 'destructive',
      })
      setIsLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (authLoading || isLoading) {
    return (
      <div className="flex-1 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 p-8 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="flex-1 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 p-8 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-float"></div>
        <div className="absolute top-40 right-10 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-float" style={{ animationDelay: '1s' }}></div>
        <div className="absolute bottom-20 left-1/2 w-72 h-72 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-float" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="mb-6 animate-fade-in">
          <Button
            variant="outline"
            onClick={() => navigate('/')}
            className="bg-white/90 hover:bg-white hover:scale-105 transition-all duration-200 shadow-md hover:shadow-lg"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </div>

        <div className="text-center mb-12 animate-fade-in">
          <h1 className="text-6xl md:text-7xl font-bold text-white mb-4 drop-shadow-lg animate-scale-in flex items-center justify-center gap-4">
            <BarChart3 className="h-16 w-16" />
            Quiz Analytics
          </h1>
          <p className="text-2xl md:text-3xl text-white/90 drop-shadow-md animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            Analyze your hosted quiz sessions
          </p>
        </div>

        {sessions.length === 0 ? (
          <Card className="bg-white/95 backdrop-blur shadow-xl animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
            <CardContent className="p-12 text-center">
              <BarChart3 className="h-16 w-16 mx-auto text-gray-400 mb-4" />
              <p className="text-xl text-gray-600">No quiz sessions found</p>
              <p className="text-sm text-gray-500 mt-2">Host some quiz sessions to see analytics here</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Sessions List */}
            <div className="space-y-4">
              <Card className="bg-white/95 backdrop-blur shadow-xl animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
                <CardHeader>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    <Calendar className="h-6 w-6" />
                    Your Hosted Sessions
                  </CardTitle>
                  <CardDescription>Select a session to view detailed analytics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-[600px] overflow-y-auto">
                    {sessions.map((session, index) => (
                      <Card
                        key={session.id}
                        className={`cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-lg ${
                          selectedSession?.id === session.id
                            ? 'border-2 border-purple-500 bg-purple-50'
                            : 'hover:border-purple-300'
                        }`}
                        onClick={() => setSelectedSession(session)}
                        style={{ animationDelay: `${0.5 + index * 0.1}s` }}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-4">
                            {session.quiz_image && (
                              <img
                                src={session.quiz_image}
                                alt={session.quiz_title}
                                className="w-16 h-16 object-cover rounded-lg"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-lg truncate">{session.quiz_title}</h3>
                              <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                                <div className="flex items-center gap-1">
                                  <Users className="h-4 w-4" />
                                  <span>{session.total_players} players</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-4 w-4" />
                                  <span>{formatDate(session.ended_at)}</span>
                                </div>
                              </div>
                              {session.winner && (
                                <div className="mt-2 flex items-center gap-2 text-sm bg-yellow-50 px-2 py-1 rounded">
                                  <Trophy className="h-4 w-4 text-yellow-600" />
                                  <span className="font-semibold text-yellow-800">
                                    Winner: {session.winner.name} ({session.winner.score} pts)
                                  </span>
                                </div>
                              )}
                              {session.mostIncorrectQuestion && (
                                <div className="mt-2 flex items-center gap-2 text-xs text-red-600">
                                  <AlertCircle className="h-3 w-3" />
                                  <span>
                                    Hardest: {session.mostIncorrectQuestion.incorrectRate}% incorrect
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* right side - detailed view of selected session */}
            <div className="space-y-4">
              {selectedSession ? (
                <>
                  {/* show winner card if there is a winner */}
                  {selectedSession.winner && (
                    <Card className="bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-300 shadow-xl animate-fade-in-up">
                      <CardHeader>
                        <CardTitle className="text-2xl flex items-center gap-2">
                          <Trophy className="h-6 w-6 text-yellow-600" />
                          Session Winner
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {/* display winner name and score prominently */}
                        <div className="flex items-center justify-between p-4 bg-white rounded-lg shadow-md">
                          <div className="flex items-center gap-3">
                            <div className="text-4xl">🥇</div>
                            <div>
                              <p className="text-2xl font-bold text-gray-900">{selectedSession.winner.name}</p>
                              <p className="text-sm text-gray-600">Champion of this session</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-3xl font-bold text-purple-600">{selectedSession.winner.score}</p>
                            <p className="text-sm text-gray-600">points</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Leaderboard */}
                  <Card className="bg-white/95 backdrop-blur shadow-xl animate-fade-in-up">
                    <CardHeader>
                      <CardTitle className="text-2xl flex items-center gap-2">
                        <Trophy className="h-6 w-6 text-yellow-500" />
                        Full Leaderboard
                      </CardTitle>
                      <CardDescription>Final scores from this session</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {selectedSession.leaderboard.map((player, index) => (
                          <div
                            key={index}
                            className={`flex items-center justify-between p-3 rounded-lg ${
                              index === 0
                                ? 'bg-gradient-to-r from-yellow-100 to-yellow-50 border-2 border-yellow-300'
                                : index === 1
                                ? 'bg-gradient-to-r from-gray-100 to-gray-50 border-2 border-gray-300'
                                : index === 2
                                ? 'bg-gradient-to-r from-orange-100 to-orange-50 border-2 border-orange-300'
                                : 'bg-gray-50 border border-gray-200'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-2xl font-bold w-8 text-center">
                                {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                              </span>
                              <span className="font-semibold text-lg">{player.player_name}</span>
                            </div>
                            <span className="text-xl font-bold text-purple-600">{player.score} pts</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Most Incorrectly Answered Question */}
                  {selectedSession.mostIncorrectQuestion && (
                    <Card className="bg-red-50 border-2 border-red-300 shadow-xl animate-fade-in-up">
                      <CardHeader>
                        <CardTitle className="text-2xl flex items-center gap-2 text-red-700">
                          <AlertCircle className="h-6 w-6" />
                          Most Challenging Question
                        </CardTitle>
                        <CardDescription className="text-red-600">
                          Question that players struggled with the most
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="p-4 bg-white rounded-lg">
                          <p className="text-sm font-semibold text-gray-600 mb-2">
                            Question {selectedSession.mostIncorrectQuestion.order_index}
                          </p>
                          <p className="text-lg font-medium mb-4">{selectedSession.mostIncorrectQuestion.question_text}</p>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-gray-600">Incorrect Answers</p>
                              <p className="text-2xl font-bold text-red-600">
                                {selectedSession.mostIncorrectQuestion.incorrect_answers} / {selectedSession.mostIncorrectQuestion.total_answers}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-gray-600">Incorrect Rate</p>
                              <p className="text-2xl font-bold text-red-600">
                                {selectedSession.mostIncorrectQuestion.incorrectRate}%
                              </p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* show statistics for each question */}
                  <Card className="bg-white/95 backdrop-blur shadow-xl animate-fade-in-up">
                    <CardHeader>
                      <CardTitle className="text-2xl flex items-center gap-2">
                        <BarChart3 className="h-6 w-6" />
                        Question Performance
                      </CardTitle>
                      <CardDescription>See which questions were most challenging</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* sort questions by incorrect rate (hardest first) and display them */}
                        {selectedSession.questionStats
                          .sort((a, b) => parseFloat(b.incorrectRate) - parseFloat(a.incorrectRate))
                          .map((stat) => (
                            <div key={stat.question_id} className="border rounded-lg p-4 bg-gray-50">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                  <p className="font-semibold text-sm text-gray-600 mb-1">
                                    Question {stat.order_index}
                                  </p>
                                  <p className="text-base">{stat.question_text}</p>
                                </div>
                                <div className="text-right ml-4">
                                  {/* color code based on difficulty - red = hard, yellow = medium, green = easy */}
                                  <div
                                    className={`text-2xl font-bold ${
                                      parseFloat(stat.incorrectRate) > 50
                                        ? 'text-red-600'
                                        : parseFloat(stat.incorrectRate) > 30
                                        ? 'text-yellow-600'
                                        : 'text-green-600'
                                    }`}
                                  >
                                    {stat.incorrectRate}%
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {stat.incorrect_answers}/{stat.total_answers} incorrect
                                  </div>
                                </div>
                              </div>
                              {/* progress bar showing incorrect rate visually */}
                              <div className="mt-3">
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div
                                    className={`h-2 rounded-full transition-all ${
                                      parseFloat(stat.incorrectRate) > 50
                                        ? 'bg-red-500'
                                        : parseFloat(stat.incorrectRate) > 30
                                        ? 'bg-yellow-500'
                                        : 'bg-green-500'
                                    }`}
                                    style={{ width: `${stat.incorrectRate}%` }}
                                  />
                                </div>
                                {/* show both accuracy and incorrect rate */}
                                <div className="flex justify-between text-xs text-gray-600 mt-1">
                                  <span>Accuracy: {stat.accuracy}%</span>
                                  <span>Incorrect Rate: {stat.incorrectRate}%</span>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card className="bg-white/95 backdrop-blur shadow-xl animate-fade-in-up">
                  <CardContent className="p-12 text-center">
                    <BarChart3 className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                    <p className="text-xl text-gray-600">Select a session</p>
                    <p className="text-sm text-gray-500 mt-2">Click on a session from the list to view detailed analytics</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
