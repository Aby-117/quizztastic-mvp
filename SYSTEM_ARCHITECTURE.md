# Quiz App - System Architecture Diagram

## Three-Tier Architecture Overview

This document illustrates the detailed system architecture of the Quiz App, showing the three-tier architecture with presentation, application, and data layers, along with integration with external services.

```mermaid
graph TB
    subgraph "PRESENTATION LAYER (Frontend)"
        subgraph "React Application"
            A[React Router<br/>Routing Layer]
            B[Home Page<br/>Quiz List & Join]
            C[CreateQuiz Page<br/>Quiz Creation UI]
            D[QuizRoom Page<br/>Host View]
            E[PlayerView Page<br/>Player Interface]
        end
        
        subgraph "UI Components Library"
            F[Radix UI Components<br/>Dialog, Select, Toast, etc.]
            G[Tailwind CSS<br/>Styling Framework]
            H[React Hook Form<br/>Form Management]
            I[Zod<br/>Client-side Validation]
        end
        
        subgraph "Client Services"
            J[Axios<br/>HTTP Client]
            K[Socket.IO Client<br/>WebSocket Connection]
        end
    end
    
    subgraph "APPLICATION LAYER (Backend)"
        subgraph "Express.js Server"
            L[Express App<br/>HTTP Server]
            M[CORS Middleware]
            N[JSON Parser<br/>Body Parser]
        end
        
        subgraph "REST API Routes"
            O[Quiz Routes<br/>/api/quiz]
            P[Room Routes<br/>/api/room]
        end
        
        subgraph "Socket.IO Server"
            Q[Socket.IO Server<br/>WebSocket Server]
            R[Socket Event Handlers<br/>Real-time Logic]
        end
        
        subgraph "Business Logic"
            S[Quiz Management<br/>CRUD Operations]
            T[Room Management<br/>Room Creation & Control]
            U[Game Logic<br/>Question Flow, Scoring]
            V[Player Management<br/>Join/Leave, Leaderboard]
        end
        
        subgraph "Authentication & Security"
            W[JWT<br/>JSON Web Tokens]
            X[bcryptjs<br/>Password Hashing]
        end
        
        subgraph "Validation"
            Y[Zod<br/>Server-side Validation]
        end
    end
    
    subgraph "DATA LAYER (Database)"
        subgraph "PostgreSQL Database"
            Z[(quizzes<br/>Quiz Metadata)]
            AA[(questions<br/>Question Data)]
            AB[(options<br/>Answer Choices)]
            AC[(rooms<br/>Active Game Rooms)]
            AD[(players<br/>Player Sessions)]
            AE[(answers<br/>Player Responses)]
        end
        
        AF[Database Connection Pool<br/>pg library]
    end
    
    subgraph "EXTERNAL SERVICES & PROTOCOLS"
        AG[HTTP/HTTPS<br/>REST API Protocol]
        AH[WebSocket<br/>Real-time Protocol]
        AI[Environment Variables<br/>dotenv Configuration]
    end
    
    %% Presentation Layer Connections
    A --> B
    A --> C
    A --> D
    A --> E
    B --> F
    C --> F
    D --> F
    E --> F
    B --> G
    C --> G
    D --> G
    E --> G
    C --> H
    H --> I
    B --> J
    C --> J
    D --> K
    E --> K
    
    %% Presentation to Application Layer
    J -->|HTTP Requests| AG
    K -->|WebSocket| AH
    AG --> L
    AH --> Q
    
    %% Application Layer Internal Connections
    L --> M
    M --> N
    N --> O
    N --> P
    L --> Q
    Q --> R
    
    O --> S
    P --> T
    R --> U
    R --> V
    S --> Y
    T --> Y
    U --> Y
    V --> Y
    
    %% Application to Data Layer
    S --> AF
    T --> AF
    U --> AF
    V --> AF
    AF --> Z
    AF --> AA
    AF --> AB
    AF --> AC
    AF --> AD
    AF --> AE
    
    %% External Services
    L --> AI
    Q --> AI
    AF --> AI
    
    %% Styling
    classDef presentation fill:#e1f5ff,stroke:#01579b,stroke-width:2px
    classDef application fill:#fff3e0,stroke:#e65100,stroke-width:2px
    classDef data fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    classDef external fill:#e8f5e9,stroke:#1b5e20,stroke-width:2px
    
    class A,B,C,D,E,F,G,H,I,J,K presentation
    class L,M,N,O,P,Q,R,S,T,U,V,W,X,Y application
    class Z,AA,AB,AC,AD,AE,AF data
    class AG,AH,AI external
```

## Component Relationships

### 1. Presentation Layer Components

#### **React Pages**
- **Home Page**: Displays available quizzes, allows joining rooms, and creating new quizzes
- **CreateQuiz Page**: Form-based interface for creating quizzes with questions and options
- **QuizRoom Page**: Host interface showing player list, quiz control, and leaderboard
- **PlayerView Page**: Player interface displaying questions, answer options, and real-time updates

#### **UI Components**
- **Radix UI**: Accessible component primitives (Dialog, Select, Toast, Label, etc.)
- **Tailwind CSS**: Utility-first CSS framework for styling
- **React Hook Form**: Form state management and validation
- **Zod**: Schema validation for form data

#### **Client Services**
- **Axios**: HTTP client for REST API communication
- **Socket.IO Client**: WebSocket client for real-time bidirectional communication

### 2. Application Layer Components

#### **HTTP Server (Express.js)**
- **Express App**: Main HTTP server handling REST API requests
- **CORS Middleware**: Enables cross-origin resource sharing
- **JSON Parser**: Parses JSON request bodies

#### **REST API Routes**
- **Quiz Routes** (`/api/quiz`):
  - `GET /` - Fetch all quizzes
  - `GET /:id` - Get quiz by ID with questions and options
  - `POST /` - Create new quiz
  - `DELETE /:id` - Delete quiz

- **Room Routes** (`/api/room`):
  - `POST /` - Create game room
  - `GET /:roomId` - Get room details with players

#### **Socket.IO Server**
- **WebSocket Server**: Handles real-time connections
- **Event Handlers**:
  - `host:join` - Host joins room
  - `player:join` - Player joins room
  - `quiz:start` - Start quiz session
  - `answer:submit` - Player submits answer
  - `host:leave` - Host leaves room
  - `player:leave` - Player leaves room
  - `disconnect` - Handle disconnections

#### **Business Logic Modules**
- **Quiz Management**: CRUD operations for quizzes, questions, and options
- **Room Management**: Room creation, activation, and lifecycle management
- **Game Logic**: Question flow control, timing, answer validation, scoring
- **Player Management**: Player registration, score tracking, leaderboard updates

#### **Security & Validation**
- **JWT**: Token-based authentication (configured but may be extended)
- **bcryptjs**: Password hashing for user authentication
- **Zod**: Server-side schema validation for request data

### 3. Data Layer Components

#### **PostgreSQL Database Tables**

1. **quizzes**
   - Stores quiz metadata (title, description, image_url)
   - Primary key: `id`

2. **questions**
   - Stores question data (text, type, time_limit, order_index, image_url)
   - Foreign key: `quiz_id` → quizzes.id

3. **options**
   - Stores answer choices (text, is_correct, color, order_index)
   - Foreign key: `question_id` → questions.id

4. **rooms**
   - Stores active game rooms (room_id, quiz_id, host_id, is_active, current_question)
   - Primary key: `id` (6-character code)
   - Foreign key: `quiz_id` → quizzes.id

5. **players**
   - Stores player sessions (room_id, player_name, socket_id, score)
   - Foreign key: `room_id` → rooms.id

6. **answers**
   - Stores player responses (room_id, question_id, player_id, option_id, is_correct, time_taken)
   - Foreign keys: `room_id` → rooms.id, `question_id` → questions.id, `player_id` → players.id, `option_id` → options.id

#### **Database Connection**
- **pg (node-postgres)**: PostgreSQL client library
- **Connection Pool**: Manages database connections efficiently

### 4. External Services & Protocols

- **HTTP/HTTPS**: REST API communication protocol
- **WebSocket**: Real-time bidirectional communication protocol
- **Environment Variables**: Configuration management via dotenv

## Data Flow

### Quiz Creation Flow
1. User fills form in **CreateQuiz Page**
2. Form validated with **Zod** (client-side)
3. **Axios** sends POST request to `/api/quiz`
4. **Express** receives request, validates with **Zod** (server-side)
5. **Quiz Management** logic processes request
6. Data persisted in **PostgreSQL** (quizzes, questions, options tables)
7. Response sent back to client

### Real-time Game Flow
1. Host creates room via REST API
2. Host connects via **Socket.IO Client** → **Socket.IO Server**
3. Players join room via **Socket.IO Client** → **Socket.IO Server**
4. Host starts quiz → **Game Logic** module
5. Questions broadcast to all players via WebSocket
6. Players submit answers → **Game Logic** processes and scores
7. Leaderboard updated in real-time
8. All data persisted in **PostgreSQL** (rooms, players, answers tables)

## Technology Stack Summary

### Frontend
- React 18.2.0
- TypeScript 5.2.2
- Vite 5.0.8
- React Router DOM 6.20.1
- Tailwind CSS 3.3.6
- Radix UI Components
- Socket.IO Client 4.5.4
- Axios 1.6.2

### Backend
- Node.js
- Express 4.18.2
- TypeScript 5.3.3
- Socket.IO 4.5.4
- PostgreSQL (via pg 8.11.3)
- JWT 9.0.2
- bcryptjs 2.4.3
- Zod 3.22.4

### Infrastructure
- PostgreSQL Database
- WebSocket Protocol
- HTTP/HTTPS Protocol


