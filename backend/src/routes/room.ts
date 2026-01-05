import express from 'express'
import { query } from '../db'
import { v4 as uuidv4 } from 'uuid'
import { authenticate, AuthRequest } from '../middleware/auth'

const router = express.Router()

// create room endpoint - when user wants to start hosting a quiz
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { quizId } = req.body
    // get the user id from jwt token and convert to string (room table stores it as varchar)
    const hostId = req.user!.id.toString()
    
    // check if there's already an active room for this quiz
    // if someone else is hosting it, we can reuse that room
    const existingRoom = await query(
      'SELECT * FROM rooms WHERE quiz_id = $1 AND is_active = TRUE ORDER BY created_at DESC LIMIT 1',
      [quizId]
    )

    if (existingRoom.rows.length > 0) {
      // return the existing room instead of creating a new one
      const room = existingRoom.rows[0]
      // update the host_id in case a different person is now hosting
      await query(
        'UPDATE rooms SET host_id = $1 WHERE id = $2',
        [hostId, room.id]
      )
      res.json({ ...room, host_id: hostId })
      return
    }

    // generate a unique 6 character room code using uuid
    let roomId = uuidv4().substring(0, 6).toUpperCase()
    let attempts = 0
    const maxAttempts = 10

    // make sure the room id is unique - keep trying if it already exists
    while (attempts < maxAttempts) {
      const existing = await query('SELECT id FROM rooms WHERE id = $1', [roomId])
      if (existing.rows.length === 0) {
        break
      }
      // generate a new one if this one is taken
      roomId = uuidv4().substring(0, 6).toUpperCase()
      attempts++
    }

    // insert the new room into database
    const result = await query(
      'INSERT INTO rooms (id, quiz_id, host_id) VALUES ($1, $2, $3) RETURNING *',
      [roomId, quizId, hostId]
    )

    // return the room data including the room code
    res.json(result.rows[0])
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Failed to create room' })
  }
})

// Get room by ID
router.get('/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params

    const roomResult = await query('SELECT * FROM rooms WHERE id = $1', [roomId])
    if (roomResult.rows.length === 0) {
      return res.status(404).json({ error: 'Room not found' })
    }

    const room = roomResult.rows[0]

    const quizResult = await query('SELECT * FROM quizzes WHERE id = $1', [room.quiz_id])
    const quiz = quizResult.rows[0]

    const playersResult = await query(
      'SELECT * FROM players WHERE room_id = $1 ORDER BY score DESC',
      [roomId]
    )

    res.json({
      ...room,
      quiz,
      players: playersResult.rows,
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Failed to fetch room' })
  }
})

export default router

