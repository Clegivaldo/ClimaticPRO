# Climatic Pro Backend API

Backend REST API for the Climatic Pro environmental sensor monitoring system.

## Tech Stack

- **Runtime**: Node.js 20+
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL 15+
- **ORM**: Prisma
- **Authentication**: JWT
- **Validation**: Zod

## Project Structure

```
backend/
├── src/
│   ├── routes/       # API route handlers
│   ├── services/     # Business logic
│   ├── middleware/   # Express middleware
│   ├── utils/        # Utility functions
│   └── index.ts      # Application entry point
├── prisma/           # Database schema and migrations
├── dist/             # Compiled JavaScript (generated)
└── tests/            # Test files
```

## Getting Started

### Prerequisites

- Node.js 20 or higher
- PostgreSQL 15 or higher
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Set up the database:
```bash
npx prisma migrate dev
```

### Development

Run the development server with hot reload:
```bash
npm run dev
```

### Building

Build for production:
```bash
npm run build
```

### Running in Production

```bash
npm start
```

## Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint errors
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage

## API Documentation

API documentation will be available at `/api/docs` once implemented.

## License

MIT
