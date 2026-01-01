import { Pool } from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'quiz_app',
  password: process.env.DB_PASSWORD || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432'),
})

export const query = async (text: string, params?: any[]) => {
  const start = Date.now()
  const res = await pool.query(text, params)
  const duration = Date.now() - start
  console.log('executed query', { text, duration, rows: res.rowCount })
  return res
}

export const initDB = async () => {
  try {
    // Create tables
    await query(`
      CREATE TABLE IF NOT EXISTS quizzes (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        image_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Add image_url column if it doesn't exist (for existing databases)
    try {
      await query(`
        ALTER TABLE quizzes ADD COLUMN image_url TEXT
      `)
    } catch (error: any) {
      // Column might already exist, which is fine
      if (!error.message?.includes('already exists')) {
        console.warn('Could not add image_url column to quizzes:', error.message)
      }
    }

    await query(`
      CREATE TABLE IF NOT EXISTS questions (
        id SERIAL PRIMARY KEY,
        quiz_id INTEGER REFERENCES quizzes(id) ON DELETE CASCADE,
        question_text TEXT NOT NULL,
        question_type VARCHAR(50) DEFAULT 'multiple_choice',
        time_limit INTEGER DEFAULT 30,
        order_index INTEGER NOT NULL,
        image_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Add image_url column if it doesn't exist (for existing databases)
    try {
      await query(`
        ALTER TABLE questions ADD COLUMN image_url TEXT
      `)
    } catch (error: any) {
      // Column might already exist, which is fine
      if (!error.message?.includes('already exists')) {
        console.warn('Could not add image_url column to questions:', error.message)
      }
    }

    await query(`
      CREATE TABLE IF NOT EXISTS options (
        id SERIAL PRIMARY KEY,
        question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
        option_text TEXT NOT NULL,
        is_correct BOOLEAN DEFAULT FALSE,
        order_index INTEGER NOT NULL,
        color VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await query(`
      CREATE TABLE IF NOT EXISTS rooms (
        id VARCHAR(255) PRIMARY KEY,
        quiz_id INTEGER REFERENCES quizzes(id) ON DELETE CASCADE,
        host_id VARCHAR(255),
        is_active BOOLEAN DEFAULT TRUE,
        current_question INTEGER DEFAULT 0,
        started_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await query(`
      CREATE TABLE IF NOT EXISTS players (
        id SERIAL PRIMARY KEY,
        room_id VARCHAR(255) REFERENCES rooms(id) ON DELETE CASCADE,
        player_name VARCHAR(255) NOT NULL,
        socket_id VARCHAR(255),
        score INTEGER DEFAULT 0,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await query(`
      CREATE TABLE IF NOT EXISTS answers (
        id SERIAL PRIMARY KEY,
        room_id VARCHAR(255) REFERENCES rooms(id) ON DELETE CASCADE,
        question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
        player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
        option_id INTEGER REFERENCES options(id),
        is_correct BOOLEAN,
        time_taken INTEGER,
        answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    console.log('Database initialized successfully')
  } catch (error) {
    console.error('Error initializing database:', error)
    throw error
  }
}

export default pool

