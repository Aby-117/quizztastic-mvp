import express from 'express'
import { query } from '../db'

const router = express.Router()

// Get all quizzes
router.get('/', async (req, res) => {
  try {
    const result = await query('SELECT * FROM quizzes ORDER BY created_at DESC')
    res.json(result.rows)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch quizzes' })
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

// Delete quiz
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params

    // Check if quiz exists
    const quizResult = await query('SELECT * FROM quizzes WHERE id = $1', [id])
    if (quizResult.rows.length === 0) {
      return res.status(404).json({ error: 'Quiz not found' })
    }

    // Delete quiz (cascade will delete questions and options)
    await query('DELETE FROM quizzes WHERE id = $1', [id])

    res.json({ message: 'Quiz deleted successfully' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Failed to delete quiz' })
  }
})

// Create quiz
router.post('/', async (req, res) => {
  try {
    const { title, description, image, questions } = req.body

    // Insert quiz
    const quizResult = await query(
      'INSERT INTO quizzes (title, description, image_url) VALUES ($1, $2, $3) RETURNING *',
      [title, description, image || null]
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

