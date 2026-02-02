# Quick Start Guide

## Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start development server:**
   ```bash
   npm run dev
   ```

3. **Open browser:**
   Navigate to `http://localhost:5173` (or the port shown in terminal)

## Login Credentials

The system uses mock authentication. You can login with any of these emails:

- **Admin**: `admin@scf.com` / any password
- **Relationship Manager**: `rm@scf.com` / any password
- **Credit Team**: `credit@scf.com` / any password
- **Operations Team**: `ops@scf.com` / any password
- **CEO**: `ceo@scf.com` / any password

## User Flows

### As Relationship Manager (RM)

1. Login with `rm@scf.com`
2. You'll see the RM Dashboard with case list
3. Click "New Customer" to onboard a customer
4. Fill in customer details and upload documents
5. Save as Draft or Submit to Credit Team

### As Credit Team

1. Login with `credit@scf.com`
2. View submitted cases in the dashboard
3. Click on a case to review details
4. Verify documents and enter sanction details
5. Submit for management approval

### As Management (CEO/CFO/MD)

1. Login with `ceo@scf.com`
2. View pending approvals in the dashboard
3. Click on a case to review
4. View approval timeline
5. Approve or Reject with comments

### As Operations Team

1. Login with `ops@scf.com`
2. View post-sanction cases
3. Verify documents, eSign, and eNACH
4. Complete multi-level approval process

### As Admin

1. Login with `admin@scf.com`
2. Access admin dashboard
3. Manage users, roles, and approval flows
4. Configure system settings

## Project Structure Overview

```
src/
├── components/     # Reusable UI components
├── pages/         # Page components (organized by role)
├── layouts/       # Layout components
├── store/         # Redux store and slices
├── services/      # API service layer (currently mocked)
├── hooks/         # Custom React hooks
├── utils/         # Utility functions
└── constants/     # Constants and configurations
```

## Key Features

- ✅ Role-based access control
- ✅ Multi-level approval workflows
- ✅ Document upload and management
- ✅ Status tracking and timeline
- ✅ Responsive design
- ✅ Mock API services ready for backend integration

## Next Steps

1. **Backend Integration**: Replace mock services in `src/services/` with actual API calls
2. **Environment Setup**: Create `.env` file with `VITE_API_BASE_URL`
3. **Real Authentication**: Update `authService.js` to use actual login endpoint
4. **File Upload**: Implement actual file upload in `DocumentUploader` component

## Development Tips

- All API calls are currently mocked with setTimeout delays
- Check browser console for any errors
- Redux DevTools extension recommended for debugging
- Network tab will show mock API calls (currently no real network requests)

## Troubleshooting

**Issue**: Page not loading
- Check if dependencies are installed: `npm install`
- Check if dev server is running: `npm run dev`

**Issue**: Login not working
- Check browser console for errors
- Verify mock user email matches one of the test emails

**Issue**: Routes not working
- Ensure you're logged in
- Check if your role has access to the route
- Verify route paths in `src/App.jsx`

For detailed architecture information, see `ARCHITECTURE.md`.

