import express from 'express'
import { query } from '../db'
import { authenticate, AuthRequest } from '../middleware/auth'

const router = express.Router()

// Get all quizzes with active room info (only public quizzes show access codes)
router.get('/', async (req, res) => {
  try {
    const result = await query('SELECT * FROM quizzes ORDER BY created_at DESC')
    
    // Get active rooms for each quiz
    const quizzesWithRooms = await Promise.all(
      result.rows.map(async (quiz) => {
        const activeRooms = await query(
          'SELECT id FROM rooms WHERE quiz_id = $1 AND is_active = TRUE ORDER BY created_at DESC LIMIT 1',
          [quiz.id]
        )
        return {
          ...quiz,
          // Only show active room code if quiz is public
          activeRoomCode: (activeRooms.rows.length > 0 && quiz.is_public) ? activeRooms.rows[0].id : null,
        }
      })
    )
    
    res.json(quizzesWithRooms)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch quizzes' })
  }
})

// Get user's own quizzes
router.get('/my', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const result = await query(
      'SELECT * FROM quizzes WHERE created_by = $1 ORDER BY created_at DESC',
      [userId]
    )
    
    // Get active rooms for each quiz
    const quizzesWithRooms = await Promise.all(
      result.rows.map(async (quiz) => {
        const activeRooms = await query(
          'SELECT id FROM rooms WHERE quiz_id = $1 AND is_active = TRUE ORDER BY created_at DESC LIMIT 1',
          [quiz.id]
        )
        return {
          ...quiz,
          activeRoomCode: activeRooms.rows.length > 0 ? activeRooms.rows[0].id : null,
        }
      })
    )
    
    res.json(quizzesWithRooms)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch your quizzes' })
  }
})

// Get quiz by ID with questions and options
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params

    const quizResult = await query('SELECT * FROM quizzes WHERE id = $1', [id])
    if (quizResult.rows.length === 0) {
      return res.status(404).json({ error: 'Quiz not found' })
    }

    const quiz = quizResult.rows[0]

    const questionsResult = await query(
      'SELECT * FROM questions WHERE quiz_id = $1 ORDER BY order_index',
      [id]
    )

    const questions = await Promise.all(
      questionsResult.rows.map(async (question) => {
        const optionsResult = await query(
          'SELECT * FROM options WHERE question_id = $1 ORDER BY order_index',
          [question.id]
        )
        return {
          ...question,
          options: optionsResult.rows,
        }
      })
    )

    res.json({
      ...quiz,
      questions,
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Failed to fetch quiz' })
  }
})

// Update quiz (requires authentication and ownership)
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params
    const userId = req.user!.id
    const { title, description, image, questions, isPublic } = req.body

    // Check if quiz exists
    const quizResult = await query('SELECT * FROM quizzes WHERE id = $1', [id])
    if (quizResult.rows.length === 0) {
      return res.status(404).json({ error: 'Quiz not found' })
    }

    const quiz = quizResult.rows[0]

    // Check ownership
    if (quiz.created_by !== userId) {
      return res.status(403).json({ error: 'You can only edit quizzes you created' })
    }

    // Update quiz
    await query(
      'UPDATE quizzes SET title = $1, description = $2, image_url = $3, is_public = $4 WHERE id = $5',
      [title, description, image || null, isPublic !== false, id]
    )

    // Delete existing questions and options (cascade will handle options)
    await query('DELETE FROM questions WHERE quiz_id = $1', [id])

    // Insert updated questions and options
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      const questionResult = await query(
        'INSERT INTO questions (quiz_id, question_text, question_type, time_limit, order_index, image_url) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [id, q.questionText, q.questionType || 'multiple_choice', q.timeLimit || 30, i + 1, q.image || null]
      )
      const question = questionResult.rows[0]

      // Insert options
      const colors = ['red', 'blue', 'yellow', 'green']
      for (let j = 0; j < q.options.length; j++) {
        const option = q.options[j]
        await query(
          'INSERT INTO options (question_id, option_text, is_correct, order_index, color) VALUES ($1, $2, $3, $4, $5)',
          [question.id, option.text, option.isCorrect, j + 1, colors[j] || null]
        )
      }
    }

    res.json({ message: 'Quiz updated successfully' })
  } catch (error: any) {
    console.error('Error updating quiz:', error)
    res.status(500).json({ error: 'Failed to update quiz' })
  }
})

// Delete quiz (requires authentication and ownership)
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params
    const userId = req.user!.id

    // Check if quiz exists
    const quizResult = await query('SELECT * FROM quizzes WHERE id = $1', [id])
    if (quizResult.rows.length === 0) {
      return res.status(404).json({ error: 'Quiz not found' })
    }

    const quiz = quizResult.rows[0]

    // Check ownership
    if (quiz.created_by !== userId) {
      return res.status(403).json({ error: 'You can only delete quizzes you created' })
    }

    // Delete quiz (cascade will delete questions and options)
    await query('DELETE FROM quizzes WHERE id = $1', [id])

    res.json({ message: 'Quiz deleted successfully' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Failed to delete quiz' })
  }
})

// Create quiz (requires authentication)
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { title, description, image, questions, isPublic } = req.body
    const userId = req.user!.id

    // Insert quiz
    const quizResult = await query(
      'INSERT INTO quizzes (title, description, image_url, is_public, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [title, description, image || null, isPublic !== false, userId]
    )
    const quiz = quizResult.rows[0]

    // Insert questions and options
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      const questionResult = await query(
        'INSERT INTO questions (quiz_id, question_text, question_type, time_limit, order_index, image_url) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [quiz.id, q.questionText, q.questionType || 'multiple_choice', q.timeLimit || 30, i + 1, q.image || null]
      )
      const question = questionResult.rows[0]

      // Insert options
      const colors = ['red', 'blue', 'yellow', 'green']
      for (let j = 0; j < q.options.length; j++) {
        const option = q.options[j]
        await query(
          'INSERT INTO options (question_id, option_text, is_correct, order_index, color) VALUES ($1, $2, $3, $4, $5)',
          [question.id, option.text, option.isCorrect, j + 1, colors[j] || null]
        )
      }
    }

    res.json(quiz)
  } catch (error: any) {
    console.error('Error creating quiz:', error)
    const errorMessage = error.message || 'Failed to create quiz'
    res.status(500).json({ error: errorMessage, details: error.stack })
  }
})

export default router

