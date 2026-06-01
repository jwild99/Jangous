# Jango.us - Competitive Skill-Based Gaming Platform

## Overview
Jango.us is a real-time, peer-to-peer gaming platform for head-to-head skill-based competitions in popular casual games. It offers a comprehensive competitive gaming experience with features like user authentication, live matchmaking, global leaderboards, a secure betting system, and daily login rewards. The platform aims to provide an engaging and high-quality environment for competitive play, with significant market potential for expansion through a diverse game catalog and robust competitive features, focusing on a 3% platform rake.

## User Preferences
- Apple Glass morphism UI across the entire site (translucent panels, backdrop-blur, ambient glow, card lift animations)
- Dark-themed UI with deep navy background and subtle ambient blue/purple radial glows
- Clean, modern interface with high contrast
- Responsive design for mobile and desktop
- Real-time gameplay with instant feedback
- 3% platform rake
- Daily login streak rewards with escalating bonuses

## System Architecture

### UI/UX Decisions
The platform features a dark-themed UI with electric blue accents, utilizing Shadcn UI and Space Grotesh font for a high-contrast, modern, and responsive aesthetic. Design incorporates intuitive navigation, smooth transitions, custom SVG game icons, and Apple Glass morphism principles. It ensures a consistent user experience across all games and features, with full mobile optimization including responsive layouts, canvas scaling, and touch input considerations. Specific visual overhauls include a 3D rail bevel for pool tables, realistic corner and side pockets, cushioned strips, and felt lighting effects.

### Technical Implementations
Jango.us is built with a React frontend, TypeScript, Wouter, TanStack Query, Tailwind CSS, and Framer Motion. The backend uses Express.js and Passport.js, with `ws` for WebSocket communication to manage real-time game states. Server-side engines handle game logic, rules, and state, integrating advanced physics engines for various games. The platform includes a secure betting system, atomic wallet operations via PostgreSQL transactions, and a dual payment system. Security features encompass server-side validation, anti-cheat mechanisms, and robust authentication, complemented by a comprehensive notification system and difficulty-aware bot AIs for all supported games. Performance optimizations include `structuralSharing: true` for React Query, `React.memo` for game components, memoized callbacks, and offscreen canvas caching for static game elements.

### Shared GameHUD System
A reusable `GameHUD` component (`client/src/components/games/GameHUD.tsx`) provides a premium in-game HUD strip across all games. Includes: `GameHUD` (player chips with avatar, XP bar, currency badge), `EventFeed` (animated action feed: +XP, Goal!, Combo etc.), `MiniXpBar`, `StreakBadge`, `CurrencyBadge`, `ShopButton`, `PlayerChip`. Feed events emitted via `emitFeedEvent()`. Applied to Air Hockey, 8-Ball Pool, and Bowling.

### Feature Specifications
The platform supports a diverse range of competitive games (e.g., Chess, Mini Golf, Air Hockey, 8-Ball Pool, Tron). Key features include: a Wallet Dashboard, Reputation System (0-100 score with badges), Player Reporting, Private Matches, XP Progress Bar, Activity Feed, Live Notification System, Admin Reports Review, Clan System, Victory/Defeat Animations, Challenge Claim System, Moderation Dashboard, a 100-tier Battle Pass (free/premium tracks with cosmetics and "Scalps"), Spectator Mode, Streamer Mode, Betting Slip, Social Community Hub (feed, messaging, friends list), User Management (auth, profiles, history, friends), Financial System (deposits, planned withdrawals), Competitive Systems (ELO/MMR, rank ladder, post-game screens), Game Mechanics (matchmaking, leaderboards, practice modes, challenges, rival system), Engagement (login streaks, achievements, chat, customization), Monetization & Customization (item shop, currency, equip system), Tournaments, User Experience (Play, Competitive, Discovery Zones, "Double or Nothing"), a centralized Sound System, and a comprehensive Admin Panel.

### System Design Choices
The system uses PostgreSQL (Neon) with Drizzle ORM for all application data, ensuring integrity and efficient querying. Game states are server-authoritative. A modular architecture is used for game engines and UI components. Drizzle Column Restriction Pattern optimizes database queries. All games are designed with mobile-compatible touch controls and responsive layouts. Match statuses include "reconnecting" and "disputed." Security measures ensure only participants or admins can submit match results. An audit logger records all critical events, and a reconnect manager handles disconnections with a 5-minute window before auto-forfeit. The anti-cheat system records actions, performs move validation, and applies suspicion scoring. A DB-backed matchmaking queue with expanding search radius manages player pairings.

## External Dependencies
- **Authentication**: Replit Auth (OpenID Connect)
- **Database**: PostgreSQL (Neon)
- **ORM**: Drizzle ORM
- **Frontend Libraries**: React, Wouter, TanStack Query, Tailwind CSS, Framer Motion, Recharts
- **Backend Libraries**: Express, Passport.js, OpenID Client, `ws` (WebSocket library), Stripe SDK
- **Payment Processing**: Stripe (card payments), NOWPAYMENTS (cryptocurrency payments)