# Supply Chain Finance System - Frontend

## Tech Stack
- React 18 with Vite
- React Router v6
- Redux Toolkit for state management
- Axios for API calls
- Tailwind CSS for styling
- React Icons for icons

## Project Structure

```
src/
├── components/       # Reusable UI components
├── pages/           # Page components
├── layouts/         # Layout components
├── store/           # Redux store and slices
├── services/        # API services
├── hooks/           # Custom React hooks
├── utils/           # Utility functions
├── constants/       # Constants and configurations
└── context/         # React Context (if needed)
```

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Run development server:
```bash
npm run dev
```

3. Build for production:
```bash
npm run build
```

## Role-Based Access

The system supports multiple roles:
- Admin
- Relationship Manager (RM)
- Credit Team
- Operations Team
- Management (CEO, CFO, MD)

Each role has specific routes and permissions configured in the routing system.

