# Gmail Unread Messages Web Application

A simple web application that authenticates users with their Gmail accounts and displays their last 10 unread messages.

## Features

- Google OAuth2 authentication
- Secure Gmail API integration
- Display of last 10 unread messages with sender, subject, date, and snippet
- Simple React frontend for testing
- TypeScript implementation with robust error handling

## Project Structure

```
/
├── server/                 # Node.js TypeScript backend
│   ├── src/
│   │   ├── routes/         # API routes (auth, messages)
│   │   ├── services/       # Gmail API service
│   │   ├── types/          # TypeScript type definitions
│   │   └── server.ts       # Main server file
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example        # Environment variables template
├── client/                 # React TypeScript frontend
│   ├── src/
│   │   ├── components/
│   │   ├── App.tsx         # Main React component
│   │   └── index.tsx       # React entry point
│   ├── public/
│   └── package.json
├── PRD.md                  # Product Requirements Document
└── README.md              # This file
```

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Google Cloud Platform account

## Setup Instructions

### 1. Google Cloud Platform Setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Gmail API:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Gmail API" and enable it
4. Create OAuth2 credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth 2.0 Client IDs"
   - Configure the consent screen if not already done
   - Select "Web application" as the application type
   - Add authorized redirect URIs:
     - `http://localhost:8080/auth/callback` (for development)
   - Save the Client ID and Client Secret

### 2. Server Setup

1. Navigate to the server directory:
   ```bash
   cd server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create environment file:
   ```bash
   cp .env.example .env
   ```

4. Configure environment variables in `.env`:
   ```env
   GOOGLE_CLIENT_ID=your_google_client_id_here
   GOOGLE_CLIENT_SECRET=your_google_client_secret_here
   GOOGLE_REDIRECT_URI=http://localhost:8080/auth/callback
   SESSION_SECRET=your_session_secret_here
   PORT=8080
   NODE_ENV=development
   CLIENT_URL=http://localhost:3000
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

The server will be running on `http://localhost:8080`

### 3. Client Setup

1. Navigate to the client directory:
   ```bash
   cd client
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

The client will be running on `http://localhost:3000`

## API Endpoints

### Authentication
- `GET /auth` - Initiate OAuth2 flow
- `GET /auth/callback` - Handle OAuth2 callback
- `GET /auth/status` - Check authentication status
- `POST /auth/logout` - Logout user

### Messages
- `GET /api/messages` - Get last 10 unread messages (requires authentication)

### Health Check
- `GET /health` - Server health check

## Usage

1. Start both the server and client applications
2. Navigate to `http://localhost:3000`
3. Click "Sign in with Google" to authenticate
4. Grant permissions to read Gmail messages
5. View your last 10 unread messages
6. Use "Refresh Messages" to fetch the latest unread messages

## Security Features

- OAuth2 implementation with proper scope limitations
- Session-based authentication
- CORS configuration
- Environment variable protection
- HTTPS enforcement for production

## Development

### Building for Production

**Server:**
```bash
cd server
npm run build
npm start
```

**Client:**
```bash
cd client
npm run build
```

### Environment Variables

Make sure to set appropriate environment variables for production:
- Use HTTPS URLs for redirect URIs
- Set `NODE_ENV=production`
- Use secure session secrets
- Configure proper CORS origins

## Troubleshooting

1. **Authentication fails**: Check Google Cloud credentials and redirect URIs
2. **CORS errors**: Verify CLIENT_URL matches the actual client URL
3. **Gmail API errors**: Ensure Gmail API is enabled and quotas are not exceeded
4. **Session issues**: Check SESSION_SECRET is set and consistent

## Next Steps for Production

1. **Complete Google Cloud Setup**: Create a project, enable Gmail API, and configure OAuth2 credentials
2. **Environment Configuration**: Set up production environment variables
3. **Deploy**: Deploy both server and client to your preferred hosting platforms
4. **Security**: Configure HTTPS and secure session management

## Testing the Application

Once you have:
1. ✅ Completed Google Cloud setup
2. ✅ Set environment variables in `server/.env`
3. ✅ Started both server (`npm run dev`) and client (`npm start`)

You can test the full authentication flow and Gmail integration.

## License

MIT License
