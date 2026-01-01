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

// Show question
const showQuestion = async (io: Server, roomId: string, questionIndex: number) => {
  const questions = roomQuestions.get(roomId) || []
  if (questionIndex >= questions.length) {
    // Quiz ended
    await query('UPDATE rooms SET is_active = FALSE WHERE id = $1', [roomId])
    
    const playersResult = await query(
      'SELECT id, player_name, score FROM players WHERE room_id = $1 ORDER BY score DESC',
      [roomId]
    )

    io.to(roomId).emit('quiz:ended', {
      leaderboard: playersResult.rows,
    })
    return
  }

  const question = questions[questionIndex]
  const timeLimit = question.time_limit || 30

  await query('UPDATE rooms SET current_question = $1 WHERE id = $2', [questionIndex, roomId])
  roomAnswers.set(roomId, new Map())

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
  })

  // Auto-advance after time limit
  setTimeout(() => {
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
        // Check if player already exists with this socket_id
        const existingPlayer = await query(
          'SELECT * FROM players WHERE socket_id = $1',
          [socket.id]
        )

        let player
        if (existingPlayer.rows.length > 0) {
          // Update existing player
          const updateResult = await query(
            'UPDATE players SET room_id = $1, player_name = $2 WHERE socket_id = $3 RETURNING *',
            [roomId, playerName, socket.id]
          )
          player = updateResult.rows[0]
        } else {
          // Check if player with same name already exists in this room
          const sameNamePlayer = await query(
            'SELECT * FROM players WHERE room_id = $1 AND player_name = $2',
            [roomId, playerName]
          )
          
          if (sameNamePlayer.rows.length > 0) {
            // Update existing player in room
            const updateResult = await query(
              'UPDATE players SET socket_id = $1 WHERE id = $2 RETURNING *',
              [socket.id, sameNamePlayer.rows[0].id]
            )
            player = updateResult.rows[0]
          } else {
            // Create new player
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

    // Start quiz
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

        // End quiz for all players
        io.to(roomId).emit('quiz:ended', {
          leaderboard: playersResult.rows,
        })

        // Clean up room data
        rooms.delete(roomId)
        roomQuestions.delete(roomId)
        roomAnswers.delete(roomId)
        roomHosts.delete(roomId)
      } catch (error) {
        console.error('Error in host:leave:', error)
      }
    })

    // Player leave
    socket.on('player:leave', async ({ roomId }) => {
      try {
        const player = players.get(socket.id)
        if (player) {
          // Remove player from database
          await query('DELETE FROM players WHERE socket_id = $1', [socket.id])
          players.delete(socket.id)
          
          // Get updated players list
          const playersResult = await query(
            'SELECT id, player_name, score FROM players WHERE room_id = $1',
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
          // Remove player from database
          await query('DELETE FROM players WHERE socket_id = $1', [socket.id])
          
          // Get updated players list
          const playersResult = await query(
            'SELECT id, player_name, score FROM players WHERE room_id = $1',
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

