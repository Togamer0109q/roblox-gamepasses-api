# Roblox Gamepasses API

## Overview

This is a Node.js Express API server that provides a proxy/wrapper service for fetching Roblox gamepass data. The service retrieves gamepass information for specified Roblox users, implementing caching and rate limiting to optimize performance and prevent abuse.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Backend Framework
- **Express.js 5.x** serves as the web framework
- Single-file architecture (`src/index.js`) containing all server logic
- Designed to run behind a proxy (configured with `trust proxy`)

### API Design
- RESTful endpoint pattern: `GET /gamepasses/:userId`
- Parameter validation for userId (must be numeric)
- JSON response format for all endpoints

### Caching Strategy
- **In-memory caching** using JavaScript `Map`
- 5-minute TTL (Time To Live) for cached responses
- Cache key is the userId
- Reduces redundant external API calls to Roblox

### Rate Limiting
- 100 requests per 15 minutes per IP address
- Implemented using `express-rate-limit` middleware
- Returns JSON error message when limit exceeded

### Security & Middleware
- CORS enabled for cross-origin requests
- JSON body parsing enabled
- Rate limiting applied globally to all routes

## External Dependencies

### Third-Party APIs
- **Roblox API** - External data source for gamepass information (fetched via axios)

### NPM Packages
| Package | Purpose |
|---------|---------|
| express | Web server framework |
| axios | HTTP client for Roblox API calls |
| cors | Cross-origin resource sharing middleware |
| express-rate-limit | Request throttling middleware |

### Infrastructure
- Designed to run on Replit or similar cloud platforms
- Uses `PORT` environment variable (defaults to 3000)
- No database required - uses in-memory caching only