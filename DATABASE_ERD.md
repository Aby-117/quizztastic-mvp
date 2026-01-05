# Quiztastic Database Entity Relationship Diagram

```mermaid
erDiagram
    users ||--o{ quizzes : creates
    users ||--o{ quiz_sessions : hosts
    quizzes ||--o{ questions : contains
    quizzes ||--o{ rooms : "used in"
    quizzes ||--o{ quiz_sessions : "tracked in"
    questions ||--o{ options : has
    questions ||--o{ answers : "answered in"
    rooms ||--o{ players : contains
    rooms ||--o{ answers : "receives"
    rooms ||--o{ quiz_sessions : "becomes"
    players ||--o{ answers : submits
    quiz_sessions ||--o{ session_leaderboards : has

    users {
        SERIAL id PK
        VARCHAR username UK "UNIQUE"
        VARCHAR email UK "UNIQUE"
        VARCHAR password
        VARCHAR name
        TIMESTAMP created_at
    }

    quizzes {
        SERIAL id PK
        VARCHAR title
        TEXT description
        TEXT image_url
        BOOLEAN is_public "DEFAULT TRUE"
        INTEGER created_by FK
        TIMESTAMP created_at
    }

    questions {
        SERIAL id PK
        INTEGER quiz_id FK
        TEXT question_text
        VARCHAR question_type "DEFAULT 'multiple_choice'"
        INTEGER time_limit "DEFAULT 30"
        INTEGER order_index
        TEXT image_url
        TIMESTAMP created_at
    }

    options {
        SERIAL id PK
        INTEGER question_id FK
        TEXT option_text
        BOOLEAN is_correct "DEFAULT FALSE"
        INTEGER order_index
        VARCHAR color
        TIMESTAMP created_at
    }

    rooms {
        VARCHAR id PK "Room Code"
        INTEGER quiz_id FK
        VARCHAR host_id
        BOOLEAN is_active "DEFAULT TRUE"
        INTEGER current_question "DEFAULT 0"
        TIMESTAMP started_at
        TIMESTAMP created_at
    }

    players {
        SERIAL id PK
        VARCHAR room_id FK
        VARCHAR player_name
        VARCHAR socket_id "NULL when disconnected"
        INTEGER score "DEFAULT 0"
        TIMESTAMP joined_at
    }

    answers {
        SERIAL id PK
        VARCHAR room_id FK
        INTEGER question_id FK
        INTEGER player_id FK
        INTEGER option_id FK
        BOOLEAN is_correct
        INTEGER time_taken
        TIMESTAMP answered_at
    }

    quiz_sessions {
        SERIAL id PK
        VARCHAR room_id FK "NULL if room deleted"
        INTEGER quiz_id FK
        INTEGER host_id FK "NULL if user deleted"
        INTEGER total_players "DEFAULT 0"
        TIMESTAMP started_at
        TIMESTAMP ended_at
        TIMESTAMP created_at
    }

    session_leaderboards {
        SERIAL id PK
        INTEGER session_id FK
        VARCHAR player_name
        INTEGER score "DEFAULT 0"
        INTEGER rank
        TIMESTAMP created_at
    }
```

## Entity Descriptions

### Core Entities

**users**
- Stores registered user accounts
- Authenticated users can create quizzes and host sessions

**quizzes**
- Stores quiz definitions created by users
- Can be public or private
- Contains metadata like title, description, and image

**questions**
- Stores individual questions within a quiz
- Has time limits and can include images
- Ordered by `order_index`

**options**
- Stores answer choices for each question
- One option per question is marked as correct
- Can have color coding for UI display

### Session Entities

**rooms**
- Represents active quiz sessions
- Identified by unique room codes (VARCHAR id)
- Tracks current question and active status

**players**
- Stores players participating in a room
- `socket_id` is NULL when player disconnects (preserved for analytics)
- Tracks individual scores

**answers**
- Records player responses to questions
- Links player, question, selected option, and room
- Stores correctness and time taken

### Analytics Entities

**quiz_sessions**
- Stores completed quiz session records
- Created when quiz ends or host leaves
- Links to room, quiz, and host for analytics

**session_leaderboards**
- Stores final leaderboard data for each session
- Preserves player names, scores, and ranks
- Used for historical analytics

## Relationships

- **users → quizzes**: One-to-many (user creates multiple quizzes)
- **users → quiz_sessions**: One-to-many (user hosts multiple sessions)
- **quizzes → questions**: One-to-many (quiz has multiple questions)
- **quizzes → rooms**: One-to-many (quiz can be used in multiple rooms)
- **quizzes → quiz_sessions**: One-to-many (quiz tracked in multiple sessions)
- **questions → options**: One-to-many (question has multiple options)
- **questions → answers**: One-to-many (question receives multiple answers)
- **rooms → players**: One-to-many (room contains multiple players)
- **rooms → answers**: One-to-many (room receives multiple answers)
- **rooms → quiz_sessions**: One-to-one (room becomes one session record)
- **players → answers**: One-to-many (player submits multiple answers)
- **quiz_sessions → session_leaderboards**: One-to-many (session has multiple leaderboard entries)

## Key Constraints

- **CASCADE DELETE**: Deleting a quiz deletes all related questions, options, rooms, and sessions
- **SET NULL**: Deleting a room sets `room_id` to NULL in quiz_sessions (preserves analytics)
- **SET NULL**: Deleting a user sets `host_id` to NULL in quiz_sessions (preserves analytics)
- **CASCADE DELETE**: Deleting a player deletes all their answers (but players are preserved for analytics)
- **UNIQUE**: Username and email must be unique per user
- **UNIQUE**: Room codes (id) must be unique

