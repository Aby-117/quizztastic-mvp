import express from 'express'
import { query } from '../db'
import { v4 as uuidv4 } from 'uuid'

const router = express.Router()

// Create room
router.post('/', async (req, res) => {
  try {
    const { quizId, hostId } = req.body
    
    // Check if there's an existing active room for this quiz
    const existingRoom = await query(
      'SELECT * FROM rooms WHERE quiz_id = $1 AND is_active = TRUE ORDER BY created_at DESC LIMIT 1',
      [quizId]
    )

    if (existingRoom.rows.length > 0) {
      // Return existing active room
      const room = existingRoom.rows[0]
      // Update host_id in case it's a different host
      await query(
        'UPDATE rooms SET host_id = $1 WHERE id = $2',
        [hostId, room.id]
      )
      res.json({ ...room, host_id: hostId })
      return
    }

    // Generate a unique room ID (6 characters)
    let roomId = uuidv4().substring(0, 6).toUpperCase()
    let attempts = 0
    const maxAttempts = 10

    // Ensure room ID is unique
    while (attempts < maxAttempts) {
      const existing = await query('SELECT id FROM rooms WHERE id = $1', [roomId])
      if (existing.rows.length === 0) {
        break
      }
      roomId = uuidv4().substring(0, 6).toUpperCase()
      attempts++
    }

    const result = await query(
      'INSERT INTO rooms (id, quiz_id, host_id) VALUES ($1, $2, $3) RETURNING *',
      [roomId, quizId, hostId]
    )

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

