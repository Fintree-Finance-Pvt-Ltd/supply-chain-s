# Supply Chain Finance - Backend API

## Tech Stack
- Node.js + Express.js
- TypeORM + MySQL
- JWT Authentication
- bcrypt for password hashing
- Multer for file uploads

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

3. **Run migrations:**
   ```bash
   npm run migration:run
   ```

4. **Seed database:**
   ```bash
   npm run seed
   ```

5. **Start development server:**
   ```bash
   npm run dev
   ```

## API Endpoints

See API documentation in `/docs` folder or check route files.

## Database

- MySQL database required
- Run SQL scripts in `/sql` folder for manual setup
- Or use TypeORM migrations


