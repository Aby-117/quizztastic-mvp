# Quiztastic Prototype

A full-stack quiz application built with React, TypeScript, Express, and PostgreSQL, similar to Kahoot. Create interactive quizzes and play them in real-time with multiple players.

## Features

- 🎮 **Create Quizzes**: Build custom quizzes with multiple choice questions
- 👥 **Real-time Multiplayer**: Host quiz sessions and allow players to join via room codes
- ⏱️ **Timed Questions**: Set time limits for each question
- 📊 **Live Leaderboard**: See scores update in real-time
- 🎨 **Beautiful UI**: Modern, responsive design with shadcn/ui components
- 🔴 **Color-coded Answers**: Kahoot-style colored answer options
- 📈 **Statistics**: View answer statistics after each question

## Tech Stack

### Frontend
- React 18
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui components
- Socket.io Client
- React Router

### Backend
- Node.js
- Express
- TypeScript
- PostgreSQL
- Socket.io
- pg (PostgreSQL client)

## Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd Quiz-App
```

### 2. Install Dependencies

```bash
# Install root dependencies
npm install

# Install all dependencies (frontend + backend)
npm run install:all
```

Or manually:
```bash
cd frontend && npm install
cd ../backend && npm install
```

### 3. Set Up PostgreSQL Database

1. Create a PostgreSQL database:
```sql
CREATE DATABASE quiz_app;
```

2. Update the database configuration in `backend/.env`:
```env
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=quiz_app
FRONTEND_URL=http://localhost:3000
```

3. Create a `.env` file in the `backend` directory:
```bash
cd backend
cp .env.example .env
# Then edit .env with your database credentials
```

### 4. Start the Development Servers

#### Option 1: Run both servers together
```bash
npm run dev
```

#### Option 2: Run servers separately

Terminal 1 (Backend):
```bash
cd backend
npm run dev
```

Terminal 2 (Frontend):
```bash
cd frontend
npm run dev
```

### 5. Access the Application

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

## Usage

### Creating a Quiz

1. Click "Create New Quiz" on the home page
2. Enter a quiz title and description
3. Add questions with:
   - Question text
   - Time limit (in seconds)
   - 4 answer options
   - Mark the correct answer
4. Add more questions as needed
5. Click "Create Quiz"

### Hosting a Quiz

1. On the home page, click "Start Quiz" on any quiz
2. You'll be given a room code (e.g., "ABC123")
3. Share the room code with players
4. Click "Start Quiz" when ready
5. Monitor the quiz progress and leaderboard

### Joining a Quiz

1. Enter the room code provided by the host
2. Enter your player name
3. Click "Join Quiz"
4. Wait for the host to start the quiz
5. Answer questions as they appear
6. View your score and ranking

## Project Structure

```
Quiz-App/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── ui/          # shadcn/ui components
│   │   ├── pages/           # React pages
│   │   ├── lib/             # Utility functions
│   │   └── App.tsx          # Main app component
│   ├── package.json
│   └── vite.config.ts
├── backend/
│   ├── src/
│   │   ├── routes/          # API routes
│   │   ├── db/              # Database setup
│   │   ├── socket.ts        # Socket.io setup
│   │   └── index.ts         # Server entry point
│   ├── package.json
│   └── tsconfig.json
└── README.md
```

## API Endpoints

### Quizzes
- `GET /api/quiz` - Get all quizzes
- `GET /api/quiz/:id` - Get quiz by ID with questions
- `POST /api/quiz` - Create a new quiz

### Rooms
- `POST /api/room` - Create a new room
- `GET /api/room/:roomId` - Get room details

### Socket Events

#### Host Events
- `host:join` - Host joins a room
- `quiz:start` - Start the quiz

#### Player Events
- `player:join` - Player joins a room
- `answer:submit` - Submit an answer

#### Server Events
- `question:show` - Show a question
- `answer:show` - Show correct answer and statistics
- `leaderboard:update` - Update leaderboard
- `quiz:ended` - Quiz has ended

## Database Schema

- **quizzes**: Store quiz information
- **questions**: Store questions for each quiz
- **options**: Store answer options for each question
- **rooms**: Store active quiz rooms
- **players**: Store players in each room
- **answers**: Store player answers

## Development

### Building for Production

Frontend:
```bash
cd frontend
npm run build
```

Backend:
```bash
cd backend
npm run build
npm start
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

