# Implementation Chapter - Quiz App Equivalent

This document presents the equivalent implementation sections for the Quiz App, mapping the structure from the Treaty platform chapter to this application's architecture.

## 5.1 Implementation Overview

The Quiz App implementation followed an incremental approach, beginning with core infrastructure and progressively adding real-time multiplayer features. Development commenced with database schema implementation and authentication setup, followed by quiz creation and management functionality. Real-time communication was implemented next using Socket.IO, starting with room creation and player joining, then progressing to live quiz sessions with synchronized question delivery and scoring. The frontend interface was developed concurrently, with components built to support each backend feature as it was implemented. This incremental approach enabled early testing and validation of each component before integration with the broader system.

The implementation utilised TypeScript throughout, providing type safety and improved developer experience. React 18 with Vite was leveraged for the frontend, with React Router for navigation and Socket.IO Client for real-time communication. The backend uses Express.js with TypeScript, PostgreSQL for data persistence, and Socket.IO for WebSocket communication. The codebase follows modular design principles, with clear separation between presentation components (React pages), business logic (Express routes), and data access layers (database queries). Error handling is implemented consistently across all components, with structured error responses and user-friendly error messages.

## 5.2 Core Implementation Components

### 5.2.1 Quiz Creation and Management

The quiz creation and management functionality is implemented in the `/api/quiz` routes, which handle the complete workflow from quiz creation through question and option management. The implementation begins with client-side validation, checking that quiz titles are provided and questions have valid options before submission. Server-side validation provides an additional security layer, ensuring data integrity and proper relationships between quizzes, questions, and options.

```typescript
// Quiz creation endpoint with authentication
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { title, description, imageUrl, isPublic, questions } = req.body
    const userId = req.user!.id

    // Validate required fields
    if (!title || !questions || questions.length === 0) {
      return res.status(400).json({ error: 'Title and at least one question are required' })
    }

    // Create quiz
    const quizResult = await query(
      'INSERT INTO quizzes (title, description, image_url, is_public, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [title, description, imageUrl, isPublic ?? true, userId]
    )

    const quizId = quizResult.rows[0].id

    // Create questions and options
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i]
      const questionResult = await query(
        'INSERT INTO questions (quiz_id, question_text, time_limit, order_index, image_url) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [quizId, question.text, question.timeLimit || 30, i, question.imageUrl]
      )

      const questionId = questionResult.rows[0].id

      // Create options for this question
      for (let j = 0; j < question.options.length; j++) {
        const option = question.options[j]
        await query(
          'INSERT INTO options (question_id, option_text, is_correct, order_index, color) VALUES ($1, $2, $3, $4, $5)',
          [questionId, option.text, option.isCorrect, j, option.color]
        )
      }
    }

    res.json(quizResult.rows[0])
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Failed to create quiz' })
  }
})
```

The quiz data is stored in PostgreSQL with proper relational structure: quizzes table for quiz metadata, questions table for individual questions, and options table for answer choices. The implementation supports image uploads for both quizzes and questions, time limits per question, and public/private quiz visibility settings. Quiz editing functionality allows creators to modify their quizzes, with validation ensuring only the quiz owner can make changes.

### 5.2.2 Real-time Quiz Session Management

The real-time quiz session management is implemented using Socket.IO, enabling synchronized communication between the host and all players. The implementation orchestrates the complete quiz workflow from room creation through question delivery, answer collection, scoring, and leaderboard updates. The system maintains in-memory state for active sessions while persisting critical data to the database.

```typescript
// Socket.IO setup for real-time communication
export const setupSocketIO = (io: Server) => {
  io.on('connection', (socket: Socket) => {
    // Host joins room and loads quiz questions
    socket.on('host:join', async ({ roomId }) => {
      socket.join(roomId)
      roomHosts.set(roomId, socket.id)

      // Load quiz questions from database
      const roomResult = await query('SELECT quiz_id FROM rooms WHERE id = $1', [roomId])
      if (roomResult.rows.length > 0) {
        const quizId = roomResult.rows[0].quiz_id
        const questionsResult = await query(
          'SELECT * FROM questions WHERE quiz_id = $1 ORDER BY order_index',
          [quizId]
        )
        
        // Load options for each question
        const questionsWithOptions = await Promise.all(
          questionsResult.rows.map(async (question) => {
            const optionsResult = await query(
              'SELECT id, option_text as text, is_correct as "isCorrect", color FROM options WHERE question_id = $1 ORDER BY order_index',
              [question.id]
            )
            return { ...question, options: optionsResult.rows }
          })
        )
        
        roomQuestions.set(roomId, questionsWithOptions)
      }
    })

    // Start quiz - broadcast to all players in room
    socket.on('quiz:start', async ({ roomId }) => {
      const questions = roomQuestions.get(roomId) || []
      if (questions.length > 0) {
        await query('UPDATE rooms SET is_active = TRUE, started_at = CURRENT_TIMESTAMP WHERE id = $1', [roomId])
        io.to(roomId).emit('quiz:started', { totalQuestions: questions.length })
        setTimeout(() => showQuestion(io, roomId, 0), 2000)
      }
    })
  })
}
```

The question delivery system automatically advances through questions based on time limits, broadcasting questions to all players simultaneously. Answer collection tracks player responses in real-time, updating scores immediately for correct answers with time-based point calculations. The leaderboard updates are broadcast to all participants after each question, maintaining synchronized state across all clients.

### 5.2.3 Player Join and Room Management

Player join functionality is implemented in the Socket.IO handler, managing player registration, room assignment, and real-time player list updates. The implementation handles player reconnection scenarios, duplicate name detection, and maintains player state across the session lifecycle.

```typescript
// Player join handler with duplicate name handling
socket.on('player:join', async ({ roomId, playerName }) => {
  socket.join(roomId)

  try {
    // Check if player already exists with this socket_id (reconnection)
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
        // Update existing player in room (reconnection)
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

    // Broadcast updated player list to all in room
    const playersResult = await query(
      'SELECT id, player_name, score FROM players WHERE room_id = $1',
      [roomId]
    )
    io.to(roomId).emit('players:list', playersResult.rows)
  } catch (error) {
    console.error('Error in player:join:', error)
    socket.emit('error', { message: 'Failed to join room' })
  }
})
```

Room creation generates unique 6-character room codes using UUID, with collision detection to ensure uniqueness. The room management system tracks active sessions, manages room lifecycle (creation, activation, completion), and handles cleanup when hosts leave or sessions end. Room codes are displayed to hosts for sharing with players, enabling easy access to quiz sessions.

### 5.2.4 Real-time Question/Answer Flow

The question/answer flow is implemented through synchronized Socket.IO events, ensuring all players receive questions simultaneously and answers are collected in real-time. The implementation includes automatic question progression based on time limits, answer validation, score calculation, and statistics aggregation.

```typescript
// Question display with automatic progression
const showQuestion = async (io: Server, roomId: string, questionIndex: number) => {
  const questions = roomQuestions.get(roomId) || []
  if (questionIndex >= questions.length) {
    // Quiz ended - save session results and show leaderboard
    await query('UPDATE rooms SET is_active = FALSE WHERE id = $1', [roomId])
    const playersResult = await query(
      'SELECT id, player_name, score FROM players WHERE room_id = $1 ORDER BY score DESC',
      [roomId]
    )
    io.to(roomId).emit('quiz:ended', { leaderboard: playersResult.rows })
    return
  }

  const question = questions[questionIndex]
  const timeLimit = question.time_limit || 30

  // Broadcast question to all players
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

// Answer submission with scoring
socket.on('answer:submit', async ({ roomId, questionId, optionId, timeTaken }) => {
  const player = players.get(socket.id)
  if (!player) return

  const questions = roomQuestions.get(roomId) || []
  const question = questions.find((q: any) => q.id === questionId)
  const selectedOption = question?.options.find((opt: any) => opt.id === optionId)

  if (selectedOption) {
    const isCorrect = selectedOption.isCorrect
    
    // Save answer to database
    await query(
      'INSERT INTO answers (room_id, question_id, player_id, option_id, is_correct, time_taken) VALUES ($1, $2, $3, $4, $5, $6)',
      [roomId, questionId, player.id, optionId, isCorrect, timeTaken]
    )

    // Update score if correct (time-based scoring)
    if (isCorrect) {
      const points = Math.max(1000 - timeTaken * 10, 100)
      await query('UPDATE players SET score = score + $1 WHERE id = $2', [points, player.id])
      player.score += points

      // Broadcast updated leaderboard
      const playersResult = await query(
        'SELECT id, player_name, score FROM players WHERE room_id = $1 ORDER BY score DESC',
        [roomId]
      )
      io.to(roomId).emit('leaderboard:update', playersResult.rows)
    }

    socket.emit('answer:result', { isCorrect, correctOptionId: question.options.find((opt: any) => opt.isCorrect)?.id })
  }
})
```

The scoring system uses time-based point calculation, rewarding faster correct answers with higher scores. Answer statistics are aggregated in real-time, showing the distribution of answers across all options. The system automatically progresses through questions, displays correct answers and statistics after each question, and maintains synchronized state across all participants.

### 5.2.5 Database Operations and Security

All database operations utilise PostgreSQL with the `pg` library, providing type safety through TypeScript and parameterized queries to prevent SQL injection. Authentication middleware verifies user identity before allowing access to protected resources, ensuring users can only create, edit, and view their own quizzes. Server-side validation provides an additional security layer, ensuring data integrity and proper authorization.

```typescript
// Authentication middleware
export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; username: string }
    const result = await query(
      'SELECT id, username, email, name FROM users WHERE id = $1',
      [decoded.userId]
    )

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' })
    }

    req.user = result.rows[0]
    next()
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired token' })
    }
    res.status(500).json({ error: 'Authentication failed' })
  }
}

// Quiz creation with ownership verification
router.post('/', authenticate, async (req: AuthRequest, res) => {
  const userId = req.user!.id // User ID from authenticated token
  // ... quiz creation logic
})

// Quiz editing with ownership check
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
  const userId = req.user!.id
  const { id } = req.params

  // Verify ownership
  const quizResult = await query('SELECT created_by FROM quizzes WHERE id = $1', [id])
  if (quizResult.rows.length === 0 || quizResult.rows[0].created_by !== userId) {
    return res.status(403).json({ error: 'Not authorized to edit this quiz' })
  }
  // ... update logic
})
```

The implementation includes comprehensive error handling for database operations, with structured error responses that distinguish between validation errors, authorization failures, and system errors. This approach enables appropriate error handling in the frontend, displaying user-friendly messages while logging detailed error information for debugging. All database queries use parameterized statements to prevent SQL injection attacks, and user input is validated both client-side and server-side.

### 5.2.6 Analytics and Session Tracking

The analytics system tracks completed quiz sessions, storing session metadata, leaderboards, and question-level statistics. This enables hosts to review past quiz performance, identify challenging questions, and analyze player engagement.

```typescript
// Save session results when quiz ends
const sessionResult = await query(
  'INSERT INTO quiz_sessions (room_id, quiz_id, host_id, total_players, started_at, ended_at) VALUES ($1, $2, $3, $4, (SELECT started_at FROM rooms WHERE id = $1), CURRENT_TIMESTAMP) RETURNING id',
  [roomId, quizId, hostId, playersResult.rows.length]
)
const sessionId = sessionResult.rows[0].id

// Save leaderboard for this session
for (let i = 0; i < playersResult.rows.length; i++) {
  const player = playersResult.rows[i]
  await query(
    'INSERT INTO session_leaderboards (session_id, player_name, score, rank) VALUES ($1, $2, $3, $4)',
    [sessionId, player.player_name, player.score, i + 1]
  )
}

// Analytics endpoint - get session statistics
router.get('/', authenticate, async (req: AuthRequest, res) => {
  const userId = req.user!.id
  
  // Get all sessions for quizzes hosted by user
  const sessionsResult = await query(
    `SELECT qs.*, q.title as quiz_title 
     FROM quiz_sessions qs
     JOIN quizzes q ON qs.quiz_id = q.id
     WHERE qs.host_id = $1
     ORDER BY qs.ended_at DESC`,
    [userId]
  )

  // Calculate question statistics for each session
  const sessions = await Promise.all(
    sessionsResult.rows.map(async (session) => {
      const questionStatsResult = await query(
        `SELECT q.id, q.question_text, q.order_index,
         COUNT(a.id) as total_answers,
         SUM(CASE WHEN a.is_correct = TRUE THEN 1 ELSE 0 END) as correct_answers
         FROM questions q
         LEFT JOIN answers a ON q.id = a.question_id AND a.room_id = $1
         WHERE q.quiz_id = $2
         GROUP BY q.id, q.question_text, q.order_index`,
        [session.room_id, session.quiz_id]
      )
      // ... calculate most incorrectly answered question
    })
  )
  
  res.json(sessions)
})
```

The analytics system provides insights into quiz performance, including winner identification, question difficulty analysis, and player engagement metrics. This data helps quiz creators improve their content and understand player behavior patterns.

