import express from 'express'
import { query } from '../db'
import { authenticate, AuthRequest } from '../middleware/auth'

const router = express.Router()

// get analytics endpoint - returns all quiz sessions that the logged in user has hosted
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    // get the user id from the jwt token (set by authenticate middleware)
    const userId = req.user!.id

    // query to get all quiz sessions where this user was the host
    // join with quizzes table to get quiz title and image
    const sessionsResult = await query(
      `SELECT 
        qs.id,
        qs.room_id,
        qs.quiz_id,
        qs.total_players,
        qs.started_at,
        qs.ended_at,
        q.title as quiz_title,
        q.image_url as quiz_image
      FROM quiz_sessions qs
      JOIN quizzes q ON qs.quiz_id = q.id
      WHERE qs.host_id = $1
      ORDER BY qs.ended_at DESC
      LIMIT 50`,
      [userId]
    )

    // for each session, get more detailed info like leaderboard and question stats
    const sessions = await Promise.all(
      sessionsResult.rows.map(async (session) => {
        // get the leaderboard for this specific session
        const leaderboardResult = await query(
          'SELECT player_name, score, rank FROM session_leaderboards WHERE session_id = $1 ORDER BY rank',
          [session.id]
        )

        // find the winner - they have rank 1
        const winner = leaderboardResult.rows.find((p: any) => p.rank === 1) || null

        // get statistics for each question - how many got it right vs wrong
        // use the session's room_id and time window to find answers from this specific session
        // filter by answered_at timestamp to ensure we only get answers from this session
        // this is important because rooms can be reused for multiple sessions
        // use COALESCE to handle NULL timestamps - if NULL, use a very early/late date to include all
        const sessionStartTime = session.started_at || session.created_at || '1970-01-01'
        const sessionEndTime = session.ended_at || (session.started_at ? new Date(new Date(session.started_at).getTime() + 2 * 60 * 60 * 1000).toISOString() : '2099-12-31')
        
        const questionStatsResult = await query(
          `SELECT 
            q.id as question_id,
            q.question_text,
            q.order_index,
            COUNT(a.id) as total_answers,
            SUM(CASE WHEN a.is_correct = TRUE THEN 1 ELSE 0 END) as correct_answers,
            SUM(CASE WHEN a.is_correct = FALSE THEN 1 ELSE 0 END) as incorrect_answers
          FROM questions q
          LEFT JOIN answers a ON q.id = a.question_id 
            AND a.room_id = $1
            AND a.answered_at >= COALESCE($3::timestamp, '1970-01-01'::timestamp)
            AND a.answered_at <= COALESCE($4::timestamp, '2099-12-31'::timestamp)
          WHERE q.quiz_id = $2
          GROUP BY q.id, q.question_text, q.order_index
          ORDER BY q.order_index`,
          [session.room_id, session.quiz_id, sessionStartTime, sessionEndTime]
        )
        
        // debug: check if we found any answers for this session
        const totalAnswersFound = questionStatsResult.rows.reduce((sum: number, row: any) => sum + parseInt(row.total_answers || 0), 0)
        if (totalAnswersFound === 0 && session.total_players > 0) {
          console.warn(`Session ${session.id} (room ${session.room_id}): No answers found but ${session.total_players} players participated. Time window: ${sessionStartTime} to ${sessionEndTime}`)
        }

        // find which question had the most wrong answers
        // sort by incorrect rate (incorrect answers / total answers)
        const mostIncorrect = questionStatsResult.rows
          .filter((q: any) => q.total_answers > 0)
          .sort((a: any, b: any) => {
            const aIncorrectRate = a.incorrect_answers / a.total_answers
            const bIncorrectRate = b.incorrect_answers / b.total_answers
            return bIncorrectRate - aIncorrectRate
          })[0] || null

        // return all the data combined together
        return {
          ...session,
          leaderboard: leaderboardResult.rows,
          // winner is the person with rank 1
          winner: winner ? { name: winner.player_name, score: winner.score } : null,
          // calculate accuracy and incorrect rate as percentages for each question
          questionStats: questionStatsResult.rows.map((stat: any) => ({
            ...stat,
            // accuracy = (correct answers / total answers) * 100
            accuracy: stat.total_answers > 0 
              ? ((stat.correct_answers / stat.total_answers) * 100).toFixed(1)
              : '0.0',
            // incorrect rate = (wrong answers / total answers) * 100
            incorrectRate: stat.total_answers > 0
              ? ((stat.incorrect_answers / stat.total_answers) * 100).toFixed(1)
              : '0.0',
          })),
          // include info about the hardest question
          mostIncorrectQuestion: mostIncorrect ? {
            question_text: mostIncorrect.question_text,
            order_index: mostIncorrect.order_index,
            incorrect_answers: mostIncorrect.incorrect_answers,
            total_answers: mostIncorrect.total_answers,
            incorrectRate: mostIncorrect.total_answers > 0
              ? ((mostIncorrect.incorrect_answers / mostIncorrect.total_answers) * 100).toFixed(1)
              : '0.0',
          } : null,
        }
      })
    )

    // send all the session data back to frontend
    res.json(sessions)
  } catch (error) {
    console.error('Error fetching analytics:', error)
    res.status(500).json({ error: 'Failed to fetch analytics' })
  }
})

// Get analytics for a specific quiz
router.get('/quiz/:quizId', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const { quizId } = req.params

    // Verify ownership
    const quizResult = await query('SELECT * FROM quizzes WHERE id = $1', [quizId])
    if (quizResult.rows.length === 0) {
      return res.status(404).json({ error: 'Quiz not found' })
    }

    if (quizResult.rows[0].created_by !== userId) {
      return res.status(403).json({ error: 'You can only view analytics for your own quizzes' })
    }

    // Get all sessions for this quiz
    const sessionsResult = await query(
      `SELECT 
        qs.id,
        qs.room_id,
        qs.total_players,
        qs.started_at,
        qs.ended_at
      FROM quiz_sessions qs
      WHERE qs.quiz_id = $1 AND qs.host_id = $2
      ORDER BY qs.ended_at DESC`,
      [quizId, userId]
    )

    // Aggregate question statistics across all sessions
    const questionStatsResult = await query(
      `SELECT 
        q.id as question_id,
        q.question_text,
        q.order_index,
        COUNT(DISTINCT a.room_id) as session_count,
        COUNT(a.id) as total_answers,
        SUM(CASE WHEN a.is_correct = TRUE THEN 1 ELSE 0 END) as correct_answers,
        SUM(CASE WHEN a.is_correct = FALSE THEN 1 ELSE 0 END) as incorrect_answers
      FROM questions q
      LEFT JOIN answers a ON q.id = a.question_id
      LEFT JOIN rooms r ON a.room_id = r.id
      LEFT JOIN quiz_sessions qs ON r.id = qs.room_id AND qs.host_id = $2
      WHERE q.quiz_id = $1 AND (r.id IS NULL OR r.quiz_id = $1)
      GROUP BY q.id, q.question_text, q.order_index
      ORDER BY q.order_index`,
      [quizId, userId]
    )

    const questionStats = questionStatsResult.rows.map((stat: any) => ({
      ...stat,
      accuracy: stat.total_answers > 0 
        ? ((stat.correct_answers / stat.total_answers) * 100).toFixed(1)
        : '0.0',
      incorrectRate: stat.total_answers > 0
        ? ((stat.incorrect_answers / stat.total_answers) * 100).toFixed(1)
        : '0.0',
      difficulty: stat.total_answers > 0
        ? stat.correct_answers / stat.total_answers < 0.5 ? 'Hard' 
        : stat.correct_answers / stat.total_answers < 0.7 ? 'Medium' 
        : 'Easy'
        : 'Unknown',
    }))

    // Find most difficult questions (lowest accuracy / highest incorrect rate)
    const mostDifficult = [...questionStats]
      .filter(q => q.total_answers > 0)
      .sort((a, b) => parseFloat(b.incorrectRate) - parseFloat(a.incorrectRate))
      .slice(0, 5)

    res.json({
      sessions: sessionsResult.rows,
      questionStats,
      mostDifficult,
      totalSessions: sessionsResult.rows.length,
    })
  } catch (error) {
    console.error('Error fetching quiz analytics:', error)
    res.status(500).json({ error: 'Failed to fetch quiz analytics' })
  }
})

export default router
