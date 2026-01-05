import { Server, Socket } from 'socket.io'
import { query } from './db'

interface Player {
  id: number
  roomId: string
  playerName: string
  socketId: string
  score: number
}

const rooms = new Map<string, Set<Socket>>()
const players = new Map<string, Player>()
const roomQuestions = new Map<string, any[]>()
const roomAnswers = new Map<string, Map<number, number>>() // roomId -> questionIndex -> count
const roomHosts = new Map<string, string>() // roomId -> socketId of host
const questionStartTimes = new Map<string, number>() // roomId -> timestamp when current question started
const questionTimers = new Map<string, NodeJS.Timeout>() // roomId -> interval timer for time updates
const pendingJoinRequests = new Map<string, { roomId: string; playerName: string; socketId: string }>() // requestId -> join request

// show question function - displays questions one by one
const showQuestion = async (io: Server, roomId: string, questionIndex: number) => {
  const questions = roomQuestions.get(roomId) || []
  // check if we've gone through all questions, if so quiz is done
  if (questionIndex >= questions.length) {
    // mark the room as not active anymore since quiz finished
    await query('UPDATE rooms SET is_active = FALSE WHERE id = $1', [roomId])
    
    // get all players sorted by their final score (highest first)
    const playersResult = await query(
      'SELECT id, player_name, score FROM players WHERE room_id = $1 ORDER BY score DESC',
      [roomId]
    )

    // save the session results to database so we can show analytics later
    // check if session already exists to prevent duplicate saves
    try {
      // check if a session already exists for this room (to avoid duplicates)
      const existingSession = await query(
        'SELECT id FROM quiz_sessions WHERE room_id = $1 ORDER BY created_at DESC LIMIT 1',
        [roomId]
      )

      // only save if no session exists yet (prevents duplicate saves)
      if (existingSession.rows.length === 0) {
        // get the room info to find out which quiz this was and who hosted it
        const roomResult = await query('SELECT quiz_id, host_id, started_at FROM rooms WHERE id = $1', [roomId])
        if (roomResult.rows.length > 0) {
          const quizId = roomResult.rows[0].quiz_id
          // host_id is stored as VARCHAR, try to parse it as integer
          // had to do this because room table stores it as string but we need number
          let hostId: number | null = null
          if (roomResult.rows[0].host_id) {
            const parsed = parseInt(roomResult.rows[0].host_id)
            hostId = isNaN(parsed) ? null : parsed
          }

          // insert a new record in quiz_sessions table with all the session info
          const sessionResult = await query(
            'INSERT INTO quiz_sessions (room_id, quiz_id, host_id, total_players, started_at, ended_at) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP) RETURNING id',
            [roomId, quizId, hostId, playersResult.rows.length, roomResult.rows[0].started_at || new Date().toISOString()]
          )
          const sessionId = sessionResult.rows[0].id

          // loop through all players and save their final scores to leaderboard table
          // rank 1 is the winner, rank 2 is second place, etc
          for (let i = 0; i < playersResult.rows.length; i++) {
            const player = playersResult.rows[i]
            await query(
              'INSERT INTO session_leaderboards (session_id, player_name, score, rank) VALUES ($1, $2, $3, $4)',
              [sessionId, player.player_name, player.score, i + 1]
            )
          }
          console.log(`Session auto-saved: ${sessionId} for room ${roomId} with ${playersResult.rows.length} players`)
        }
      } else {
        console.log(`Session already exists for room ${roomId}, skipping duplicate save`)
      }
    } catch (error) {
      console.error('Error saving session results:', error)
      // don't fail the quiz end if saving fails - just log the error
    }

    io.to(roomId).emit('quiz:ended', {
      leaderboard: playersResult.rows,
    })
    
    // clean up timers
    const timerToClear = questionTimers.get(roomId)
    if (timerToClear) {
      clearInterval(timerToClear)
      questionTimers.delete(roomId)
    }
    questionStartTimes.delete(roomId)
    return
  }

  const question = questions[questionIndex]
  const timeLimit = question.time_limit || 30

  await query('UPDATE rooms SET current_question = $1 WHERE id = $2', [questionIndex, roomId])
  roomAnswers.set(roomId, new Map())
  
  // store when this question started (for synchronized timer)
  const startTime = Date.now()
  questionStartTimes.set(roomId, startTime)

  // clear any existing timer for this room
  const existingTimer = questionTimers.get(roomId)
  if (existingTimer) {
    clearInterval(existingTimer)
  }

  // send initial question with full time limit
  io.to(roomId).emit('question:show', {
    question: {
      id: question.id,
      text: question.question_text,
      options: question.options,
      timeLimit,
      image: question.image_url,
    },
    questionIndex,
    totalQuestions: questions.length,
    startTime, // send server timestamp so clients can sync
  })

  // broadcast time updates every second to keep all clients synchronized
  const timer = setInterval(() => {
    const currentStartTime = questionStartTimes.get(roomId)
    if (!currentStartTime) {
      clearInterval(timer)
      questionTimers.delete(roomId)
      return
    }

    const elapsed = Math.floor((Date.now() - currentStartTime) / 1000)
    const remaining = Math.max(0, timeLimit - elapsed)

    // broadcast remaining time to all players in room
    io.to(roomId).emit('timer:update', {
      remaining,
      elapsed,
    })

    // if time is up, clear timer (the setTimeout will handle showing answer)
    if (remaining <= 0) {
      clearInterval(timer)
      questionTimers.delete(roomId)
    }
  }, 1000) // update every second

  questionTimers.set(roomId, timer)

  // Auto-advance after time limit
  setTimeout(() => {
    // clear the interval timer
    const timerToClear = questionTimers.get(roomId)
    if (timerToClear) {
      clearInterval(timerToClear)
      questionTimers.delete(roomId)
    }
    questionStartTimes.delete(roomId)
    showAnswer(io, roomId, questionIndex)
  }, timeLimit * 1000)
}

// Show answer
const showAnswer = async (io: Server, roomId: string, questionIndex: number) => {
  const questions = roomQuestions.get(roomId) || []
  const question = questions[questionIndex]
  const correctOption = question.options.find((opt: any) => opt.isCorrect)

  io.to(roomId).emit('answer:show', {
    correctOptionId: correctOption?.id,
    statistics: Array.from(roomAnswers.get(roomId)?.entries() || []).map(([optionId, count]) => ({
      optionId,
      count,
    })),
  })

  // Move to next question after 3 seconds
  setTimeout(() => {
    showQuestion(io, roomId, questionIndex + 1)
  }, 3000)
}

export const setupSocketIO = (io: Server) => {
  io.on('connection', (socket: Socket) => {
    console.log('User connected:', socket.id)

    // Join room (host)
    socket.on('host:join', async ({ roomId }) => {
      socket.join(roomId)
      if (!rooms.has(roomId)) {
        rooms.set(roomId, new Set())
      }
      rooms.get(roomId)!.add(socket)
      roomHosts.set(roomId, socket.id) // Track host socket

      // Get quiz questions for this room
      const roomResult = await query('SELECT quiz_id FROM rooms WHERE id = $1', [roomId])
      if (roomResult.rows.length > 0) {
        const quizId = roomResult.rows[0].quiz_id
        
        // Get questions
        const questionsResult = await query(
          'SELECT * FROM questions WHERE quiz_id = $1 ORDER BY order_index',
          [quizId]
        )
        
        // Get options for each question
        const questionsWithOptions = await Promise.all(
          questionsResult.rows.map(async (question) => {
            const optionsResult = await query(
              'SELECT id, option_text as text, is_correct as "isCorrect", color, order_index as "orderIndex" FROM options WHERE question_id = $1 ORDER BY order_index',
              [question.id]
            )
            return {
              ...question,
              options: optionsResult.rows,
            }
          })
        )
        
        roomQuestions.set(roomId, questionsWithOptions)
        roomAnswers.set(roomId, new Map())
      }

      // Send current players list to host
      const playersResult = await query(
        'SELECT id, player_name, score FROM players WHERE room_id = $1',
        [roomId]
      )
      socket.emit('players:list', playersResult.rows)

      socket.emit('host:joined', { roomId })
    })

    // Player join
    socket.on('player:join', async ({ roomId, playerName }) => {
      socket.join(roomId)

      try {
        // Check if quiz is active (started)
        const roomState = await query(
          'SELECT is_active, started_at FROM rooms WHERE id = $1',
          [roomId]
        )

        const isQuizActive = roomState.rows.length > 0 && roomState.rows[0].is_active && roomState.rows[0].started_at

        // If quiz is active, request host approval instead of joining immediately
        if (isQuizActive) {
          // Check for duplicate name first
          const duplicateName = await query(
            'SELECT * FROM players WHERE room_id = $1 AND player_name = $2 AND socket_id IS NOT NULL',
            [roomId, playerName]
          )
          
          if (duplicateName.rows.length > 0) {
            socket.emit('error', { 
              message: `A player with the name "${playerName}" is already in this room. Please choose a different name.` 
            })
            socket.leave(roomId)
            return
          }

          // Create pending join request
          const requestId = `${roomId}-${socket.id}`
          pendingJoinRequests.set(requestId, { roomId, playerName, socketId: socket.id })

          // Notify host about pending join request
          const hostSocketId = roomHosts.get(roomId)
          if (hostSocketId) {
            io.to(hostSocketId).emit('player:join:request', {
              requestId,
              playerName,
              roomId,
            })
          }

          // Notify player that they're waiting for approval
          socket.emit('player:join:pending', {
            message: `Waiting for host to approve your join request...`,
          })
          return
        }

        // Quiz not active - proceed with normal join logic
        // Check if player already exists with this socket_id (reconnection scenario)
        const existingPlayer = await query(
          'SELECT * FROM players WHERE socket_id = $1',
          [socket.id]
        )

        let player
        if (existingPlayer.rows.length > 0) {
          // Player reconnecting with same socket - check if name conflicts in new room
          if (existingPlayer.rows[0].room_id !== roomId) {
            // Player is joining a different room - check for duplicate name
            const duplicateName = await query(
              'SELECT * FROM players WHERE room_id = $1 AND player_name = $2 AND socket_id IS NOT NULL',
              [roomId, playerName]
            )
            
            if (duplicateName.rows.length > 0) {
              // Duplicate name found in this room - reject join
              socket.emit('error', { 
                message: `A player with the name "${playerName}" is already in this room. Please choose a different name.` 
              })
              socket.leave(roomId)
              return
            }
          }
          
          // Update existing player (same socket, same or different room)
          const updateResult = await query(
            'UPDATE players SET room_id = $1, player_name = $2 WHERE socket_id = $3 RETURNING *',
            [roomId, playerName, socket.id]
          )
          player = updateResult.rows[0]
        } else {
          // New player joining - check if name already exists in this room (active players only)
          const sameNamePlayer = await query(
            'SELECT * FROM players WHERE room_id = $1 AND player_name = $2 AND socket_id IS NOT NULL',
            [roomId, playerName]
          )
          
          if (sameNamePlayer.rows.length > 0) {
            // Duplicate name found - reject join
            socket.emit('error', { 
              message: `A player with the name "${playerName}" is already in this room. Please choose a different name.` 
            })
            socket.leave(roomId)
            return
          }
          
          // Check if there's an inactive player with this name (disconnected player reconnecting)
          const inactivePlayer = await query(
            'SELECT * FROM players WHERE room_id = $1 AND player_name = $2 AND socket_id IS NULL',
            [roomId, playerName]
          )
          
          if (inactivePlayer.rows.length > 0) {
            // Inactive player reconnecting - allow them to reconnect
            const updateResult = await query(
              'UPDATE players SET socket_id = $1 WHERE id = $2 RETURNING *',
              [socket.id, inactivePlayer.rows[0].id]
            )
            player = updateResult.rows[0]
          } else {
            // Create new player with unique name
            const playerResult = await query(
              'INSERT INTO players (room_id, player_name, socket_id) VALUES ($1, $2, $3) RETURNING *',
              [roomId, playerName, socket.id]
            )
            player = playerResult.rows[0]
          }
        }

        const playerData: Player = {
          id: player.id,
          roomId,
          playerName,
          socketId: socket.id,
          score: player.score || 0,
        }
        players.set(socket.id, playerData)

        // Get current players list
        const playersResult = await query(
          'SELECT id, player_name, score FROM players WHERE room_id = $1',
          [roomId]
        )

        // Notify all in room including the new player
        io.to(roomId).emit('player:joined', {
          player: {
            id: player.id,
            player_name: playerName,
            score: player.score || 0,
          },
        })

        // Send updated players list to ALL in room (including host)
        io.to(roomId).emit('players:list', playersResult.rows)
      } catch (error) {
        console.error('Error in player:join:', error)
        socket.emit('error', { message: 'Failed to join room' })
      }
    })

    // Host approves or denies join request
    socket.on('player:join:response', async ({ requestId, approved }) => {
      try {
        const request = pendingJoinRequests.get(requestId)
        if (!request) {
          return // Request doesn't exist or already handled
        }

        const { roomId, playerName, socketId } = request
        pendingJoinRequests.delete(requestId)

        if (!approved) {
          // Host denied - notify player
          io.to(socketId).emit('player:join:denied', {
            message: 'Host denied your join request',
          })
          return
        }

        // Host approved - proceed with join
        const playerSocket = io.sockets.sockets.get(socketId)
        if (!playerSocket) {
          return // Player disconnected
        }

        // Check for duplicate name one more time
        const duplicateName = await query(
          'SELECT * FROM players WHERE room_id = $1 AND player_name = $2 AND socket_id IS NOT NULL',
          [roomId, playerName]
        )
        
        if (duplicateName.rows.length > 0) {
          io.to(socketId).emit('error', { 
            message: `A player with the name "${playerName}" is already in this room.` 
          })
          return
        }

        // Create player
        const playerResult = await query(
          'INSERT INTO players (room_id, player_name, socket_id) VALUES ($1, $2, $3) RETURNING *',
          [roomId, playerName, socketId]
        )
        const player = playerResult.rows[0]

        const playerData: Player = {
          id: player.id,
          roomId,
          playerName,
          socketId: socketId,
          score: player.score || 0,
        }
        players.set(socketId, playerData)

        // Get current players list
        const playersResult = await query(
          'SELECT id, player_name, score FROM players WHERE room_id = $1',
          [roomId]
        )

        // Notify player they've been approved and joined
        io.to(socketId).emit('player:join:approved', {
          message: 'Host approved your join request!',
        })

        // Send quiz state to newly joined player
        const questions = roomQuestions.get(roomId) || []
        const roomState = await query(
          'SELECT current_question FROM rooms WHERE id = $1',
          [roomId]
        )

        if (roomState.rows.length > 0 && roomState.rows[0].current_question !== null) {
          const currentQuestionIndex = roomState.rows[0].current_question
          if (currentQuestionIndex < questions.length) {
            // Quiz is in progress - send current question with server start time
            const currentQuestion = questions[currentQuestionIndex]
            const startTime = questionStartTimes.get(roomId) || Date.now()
            
            io.to(socketId).emit('quiz:started', {
              totalQuestions: questions.length,
              lateJoiner: true,
            })
            io.to(socketId).emit('question:show', {
              question: {
                id: currentQuestion.id,
                text: currentQuestion.question_text,
                options: currentQuestion.options,
                timeLimit: currentQuestion.time_limit || 30,
                image: currentQuestion.image_url,
              },
              questionIndex: currentQuestionIndex,
              totalQuestions: questions.length,
              lateJoiner: true,
              startTime, // send server timestamp for synchronization
            })
          }
        }

        // Send leaderboard
        io.to(socketId).emit('leaderboard:update', playersResult.rows)

        // Notify all in room
        io.to(roomId).emit('player:joined', {
          player: {
            id: player.id,
            player_name: playerName,
            score: player.score || 0,
          },
        })

        // Send updated players list to ALL in room
        io.to(roomId).emit('players:list', playersResult.rows)
      } catch (error) {
        console.error('Error in player:join:response:', error)
      }
    })

    // Open room for players to join (waiting state)
    socket.on('room:open', async ({ roomId }) => {
      // Room is already active, just notify that it's open for joining
      io.to(roomId).emit('room:opened', { roomId })
    })

    // Start quiz (actually begin the quiz session)
    socket.on('quiz:start', async ({ roomId }) => {
      const questions = roomQuestions.get(roomId) || []
      if (questions.length > 0) {
        await query('UPDATE rooms SET is_active = TRUE, started_at = CURRENT_TIMESTAMP, current_question = 0 WHERE id = $1', [roomId])
        io.to(roomId).emit('quiz:started', {
          totalQuestions: questions.length,
        })
        // Start first question
        setTimeout(() => {
          showQuestion(io, roomId, 0)
        }, 2000)
      }
    })

    // Player answer
    socket.on('answer:submit', async ({ roomId, questionId, optionId, timeTaken }) => {
      const player = players.get(socket.id)
      if (!player) return

      try {
        const questions = roomQuestions.get(roomId) || []
        const question = questions.find((q: any) => q.id === questionId)
        const selectedOption = question?.options.find((opt: any) => opt.id === optionId)

        if (selectedOption) {
          const isCorrect = selectedOption.isCorrect
          
          // Update answer count
          const answerMap = roomAnswers.get(roomId) || new Map()
          answerMap.set(optionId, (answerMap.get(optionId) || 0) + 1)
          roomAnswers.set(roomId, answerMap)

          // Save answer to database
          await query(
            'INSERT INTO answers (room_id, question_id, player_id, option_id, is_correct, time_taken) VALUES ($1, $2, $3, $4, $5, $6)',
            [roomId, questionId, player.id, optionId, isCorrect, timeTaken]
          )

          // Update score if correct
          if (isCorrect) {
            const points = Math.max(1000 - timeTaken * 10, 100)
            await query('UPDATE players SET score = score + $1 WHERE id = $2', [points, player.id])
            player.score += points

            // Update leaderboard
            const playersResult = await query(
              'SELECT id, player_name, score FROM players WHERE room_id = $1 ORDER BY score DESC',
              [roomId]
            )
            io.to(roomId).emit('leaderboard:update', playersResult.rows)
          }

          socket.emit('answer:result', {
            isCorrect,
            correctOptionId: question.options.find((opt: any) => opt.isCorrect)?.id,
          })
        }
      } catch (error) {
        console.error(error)
      }
    })

    // Host leave
    socket.on('host:leave', async ({ roomId }) => {
      try {
        // Mark room as inactive
        await query('UPDATE rooms SET is_active = FALSE WHERE id = $1', [roomId])
        
        // Get current leaderboard with all players' points
        const playersResult = await query(
          'SELECT id, player_name, score FROM players WHERE room_id = $1 ORDER BY score DESC',
          [roomId]
        )

        // Save session results if quiz was started and session doesn't already exist
        // this is a backup save in case the natural end save didn't happen
        try {
          // check if session already exists (to avoid duplicates)
          const existingSession = await query(
            'SELECT id FROM quiz_sessions WHERE room_id = $1 ORDER BY created_at DESC LIMIT 1',
            [roomId]
          )

          // only save if no session exists yet
          if (existingSession.rows.length === 0) {
            const roomResult = await query('SELECT quiz_id, host_id, started_at FROM rooms WHERE id = $1', [roomId])
            if (roomResult.rows.length > 0 && playersResult.rows.length > 0) {
              const quizId = roomResult.rows[0].quiz_id
              let hostId: number | null = null
              if (roomResult.rows[0].host_id) {
                const parsed = parseInt(roomResult.rows[0].host_id)
                hostId = isNaN(parsed) ? null : parsed
              }

              const sessionResult = await query(
                'INSERT INTO quiz_sessions (room_id, quiz_id, host_id, total_players, started_at, ended_at) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP) RETURNING id',
                [roomId, quizId, hostId, playersResult.rows.length, roomResult.rows[0].started_at || new Date().toISOString()]
              )
              const sessionId = sessionResult.rows[0].id

              // Save leaderboard
              for (let i = 0; i < playersResult.rows.length; i++) {
                const player = playersResult.rows[i]
                await query(
                  'INSERT INTO session_leaderboards (session_id, player_name, score, rank) VALUES ($1, $2, $3, $4)',
                  [sessionId, player.player_name, player.score, i + 1]
                )
              }
              console.log(`Session saved on host leave (backup save): ${sessionId} for room ${roomId}`)
            }
          } else {
            console.log(`Session already exists for room ${roomId}, skipping duplicate save on host leave`)
          }
        } catch (error) {
          console.error('Error saving session results on host leave:', error)
        }

        // End quiz for all players
        io.to(roomId).emit('quiz:ended', {
          leaderboard: playersResult.rows,
        })

        // Clean up room data
        rooms.delete(roomId)
        roomQuestions.delete(roomId)
        roomAnswers.delete(roomId)
        roomHosts.delete(roomId)
        
        // clean up timers
        const timerToClear = questionTimers.get(roomId)
        if (timerToClear) {
          clearInterval(timerToClear)
          questionTimers.delete(roomId)
        }
        questionStartTimes.delete(roomId)
      } catch (error) {
        console.error('Error in host:leave:', error)
      }
    })

    // Player leave
    socket.on('player:leave', async ({ roomId }) => {
      try {
        const player = players.get(socket.id)
        if (player) {
          // don't delete player from database - we need to keep them for analytics
          // just clear the socket_id so they can't reconnect with the same player record
          // but keep their answers and score for analytics
          await query('UPDATE players SET socket_id = NULL WHERE socket_id = $1', [socket.id])
          players.delete(socket.id)
          
          // Get updated players list (only active players with socket_id)
          const playersResult = await query(
            'SELECT id, player_name, score FROM players WHERE room_id = $1 AND socket_id IS NOT NULL',
            [roomId]
          )
          
          // Notify all in room
          io.to(roomId).emit('player:left', { socketId: socket.id })
          io.to(roomId).emit('players:list', playersResult.rows)
        }
      } catch (error) {
        console.error('Error in player:leave:', error)
      }
    })

    // Disconnect
    socket.on('disconnect', async () => {
      const player = players.get(socket.id)
      if (player) {
        const roomId = player.roomId
        try {
          // don't delete player from database - we need to keep them for analytics
          // just clear the socket_id so they can't reconnect with the same player record
          // but keep their answers and score for analytics
          await query('UPDATE players SET socket_id = NULL WHERE socket_id = $1', [socket.id])
          
          // Get updated players list (only active players with socket_id)
          const playersResult = await query(
            'SELECT id, player_name, score FROM players WHERE room_id = $1 AND socket_id IS NOT NULL',
            [roomId]
          )
          
          // Notify all in room
          io.to(roomId).emit('player:left', { socketId: socket.id })
          io.to(roomId).emit('players:list', playersResult.rows)
        } catch (error) {
          console.error('Error removing player on disconnect:', error)
        }
        players.delete(socket.id)
      }

      // Check if this was a host disconnecting
      rooms.forEach((sockets, roomId) => {
        if (sockets.has(socket)) {
          sockets.delete(socket)
          
          // Check if this was the host
          const hostSocketId = roomHosts.get(roomId)
          if (hostSocketId === socket.id) {
            // Host disconnected - end quiz
            query('UPDATE rooms SET is_active = FALSE WHERE id = $1', [roomId]).then(() => {
              query('SELECT id, player_name, score FROM players WHERE room_id = $1 ORDER BY score DESC', [roomId])
                .then((playersResult) => {
                  io.to(roomId).emit('quiz:ended', {
                    leaderboard: playersResult.rows,
                  })
                })
            })
            
            roomHosts.delete(roomId)
          }
          
          // If no sockets left in room, clean up
          if (sockets.size === 0) {
            rooms.delete(roomId)
            roomQuestions.delete(roomId)
            roomAnswers.delete(roomId)
            roomHosts.delete(roomId)
          }
        }
      })
    })
  })
}

