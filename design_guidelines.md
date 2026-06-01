# Jango.us Gaming Platform - Design Guidelines

## Design Approach

**Reference-Based Strategy:** Primary inspiration from **Stake's dark casino aesthetic** with neon-infused energy, supplemented by high-end gaming interfaces (Riot Games, Razer) and premium fintech dashboards (Robinhood's dark mode).

**Core Principles:**
- Premium dark-first design with vibrant neon accents for competitive energy
- Low eye strain backgrounds (deep charcoal to near-black) with strategic luminosity
- Glowing interactive elements that signal engagement opportunities
- Dynamic visual feedback responding to game states and user actions
- Sophisticated minimalism - clean layouts with purposeful neon highlights

---

## Color Palette

### Dark Foundation
- **Background Base:** `222 18% 6%` - Near-black foundation for minimal eye strain
- **Surface Layer:** `222 15% 10%` - Cards, elevated containers
- **Surface Elevated:** `222 12% 14%` - Modals, active states, overlays

### Neon Accent System
- **Electric Blue (Primary):** `217 91% 60%` - CTAs, active matches, primary interactions, win states
- **Cyber Purple (Secondary):** `270 75% 65%` - Premium features, challenges, special events
- **Neon Green (Success):** `142 80% 50%` - Wins, balance increases, available matches, online indicators
- **Hot Pink (Accent):** `320 85% 60%` - Notifications, challenges, urgency
- **Amber (Warning):** `38 92% 55%` - Pending states, low balance warnings

### Functional Colors
- **Danger Red:** `0 85% 62%` - Losses, close match, destructive actions
- **Text Primary:** `0 0% 98%` - Headings, critical info
- **Text Secondary:** `0 0% 72%` - Body text
- **Text Muted:** `0 0% 48%` - Metadata, timestamps
- **Border Subtle:** `0 0% 18%` - Dividers
- **Border Glow:** Neon colors at 40-60% opacity for interactive element halos

---

## Typography

**Font Stack:**
- **Primary:** 'Inter' - UI, body text, stats
- **Display:** 'Space Grotesk' - Headlines, game titles, branding
- **Monospace:** 'JetBrains Mono' - Match IDs, timers, balance displays

**Hierarchy:**
- Hero: `text-6xl md:text-8xl font-bold` (Space Grotesk, neon text-shadow)
- H1: `text-4xl md:text-6xl font-bold`
- H2: `text-3xl md:text-4xl font-semibold`
- H3: `text-2xl font-semibold`
- Body: `text-base font-normal`
- Balance/Stats: `text-xl md:text-2xl font-bold` (JetBrains Mono)
- Small: `text-sm`

---

## Layout System

**Spacing Primitives:** Tailwind units of **2, 4, 8, 12, 16**

**Containers:**
- Content max-width: `max-w-7xl mx-auto px-4 md:px-8`
- Game canvas: `max-w-6xl mx-auto`
- Dashboard sections: `max-w-7xl`

**Grid Patterns:**
- Game lobby: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`
- Active matches: `grid-cols-1 gap-4`
- Leaderboard stats: `grid-cols-2 md:grid-cols-4 gap-4`

---

## Component Library

### Navigation
**Fixed Top Bar (h-16):** Dark background (Surface Layer) with subtle bottom glow border (Electric Blue at 20%). Logo left, horizontal game quick-nav center, user section right (animated balance counter + avatar with online glow indicator).

### Hero Section
**Full-viewport immersive hero** with large background image (dark gaming arena with neon underglow - think cyberpunk competitive space with glowing game elements). Gradient overlay: `from-[#0a0a0f]/95 via-[#0a0a0f]/80 to-transparent`. 

Centered content:
- Display headline: "Where Skill Meets Stakes" with Electric Blue neon glow effect
- Subheading: "Premium competitive gaming. Real rewards."
- Live metrics bar: "1,342 Active Players • $47,234 in Play • 890 Matches Today" with pulsing green indicators
- Dual CTAs: Primary "Start Competing" (solid Electric Blue with glow), Secondary "Explore Games" (glass-morphism with backdrop blur)

### Game Cards
**Premium card design** with Surface Layer background, rounded-xl borders with subtle neon glow on hover. Each card:
- Game preview image (16:9) with overlay gradient
- Game title (H3) with live player count badge (Neon Green)
- Quick stats row: Avg stake, active matches, difficulty
- Entry stakes row with currency icons
- "Join Game" button (full-width, Electric Blue with pulse effect)
- Hover state: Lift with intensified border glow (Cyber Purple)

### Match Lobby
**Active Matches Grid:** Horizontal cards showing:
- Player avatars (both sides) with ELO ratings
- Game icon center with stake amount in bold (JetBrains Mono)
- Match timer with progress bar
- "Spectate" or "Join" button (Neon Green if available)
- Featured/premium matches: Cyber Purple border with subtle animation

**Create Match Card:** Large dashed border card with centered "+" icon, "Create New Match" text, gradient background on hover

### Real-Time HUD (In-Game)
**Top overlay bar:** Semi-transparent dark background with backdrop blur
- Left: Player 1 (avatar, name, timer with countdown animation)
- Center: Match ID, current stake display (large, glowing)
- Right: Player 2 info mirrored
- Bottom: Turn indicator with glowing line pointing to active player

**Stats sidebar (collapsible):** Thin vertical bar showing:
- Move count
- Time elapsed
- Spectator count with live updates

### Balance Display
**Animated Counter Component:** Large balance in JetBrains Mono with:
- Increment animation: Green glow pulse when increasing
- Decrement animation: Red flash when decreasing
- Resting state: Subtle Electric Blue glow
- Placement: Top-right nav, dashboard hero

### Dashboard
**Stats Overview Section:**
- Large hero card with win/loss record, circular win-rate chart (Neon Green/Danger Red)
- Grid of stat cards (2x2): Total earnings (Success), Games played, Current streak, Rank with glowing borders
- Recent matches timeline: Vertical cards with game icons, opponent names, results (color-coded), timestamp
- Dynamic background gradient that shifts based on recent performance (winning streak = green tint, losing = red tint)

### Notification Toasts
**Floating notifications** (top-right corner):
- Glass-morphism cards with backdrop blur
- Icon left (context-specific), message center, dismiss right
- Challenge received: Hot Pink border with pulse
- Match started: Electric Blue
- Balance updated: Neon Green
- Auto-dismiss after 5s with fade-out animation

### Chat Sidebar
**Minimized by default** (right edge):
- Collapsed: Vertical tab with chat icon and unread count badge (Hot Pink)
- Expanded: 300px width overlay with dark Surface Elevated background
- Message bubbles: Self (Electric Blue accent), Others (Surface Layer)
- Input field with neon focus glow
- Online user list with green dot indicators

### Leaderboard
**Premium table design:**
- Alternating row backgrounds (Surface Layer/Background Base)
- Rank column with animated medal icons (top 3 glow effect)
- Player column: Avatar + username + verified badge
- Stats columns: Wins, Win Rate % (with progress bars), Total Stakes
- Current user row: Electric Blue border glow with highlight

### Modals & Overlays
**Match Result Modal:** Centered card with semi-transparent backdrop (black/90):
- Result header with appropriate neon color ("VICTORY" - Neon Green, "DEFEAT" - Danger Red)
- Animated balance change display with increment counter
- Stats breakdown: Duration, moves, earnings
- Particle burst animation (confetti for wins)
- Rematch and Lobby buttons

### Buttons
**Primary:** Solid Electric Blue with subtle box-shadow glow, hover increases brightness and glow intensity
**Secondary:** Outline with Cyber Purple, hover fills with color at 15% opacity
**Success:** Solid Neon Green for match joins, available actions
**Danger:** Solid red for forfeit, destructive actions
**Glass Buttons (on hero/images):** Backdrop blur, white/10 background, white text, no hover interactions (blur ensures readability)

---

## Images

### Hero Section
**Large immersive background:** Dark futuristic gaming arena with neon accents. Ideal composition:
- Overhead view of circular competitive gaming space
- Neon blue and purple light strips on floor/walls
- Dark ambient lighting with dramatic shadows
- Abstract glowing game elements (chess pieces, cards, etc.) floating or positioned
- Cyberpunk aesthetic with premium materials (dark glass, polished surfaces)

### Game Thumbnails
High-quality stylized previews for each game:
- **Chess:** Dramatic low-angle shot of neon-edged pieces, dark background with blue rim lighting
- **Mini Golf:** Neon-lit course layout with glowing ball trail
- **Connect 4:** Glowing grid with winning combination highlighted in electric blue
- Each image: 16:9 aspect, dark with strategic neon highlights

### Dashboard
- User avatars with neon border matching rank tier
- Game icons as simplified monochromatic SVGs with neon glow effect
- Match history thumbnails showing game state snapshots

---

## Animation Guidelines

**Core Principles:** Smooth, premium animations that enhance without distracting. Target 60fps with hardware acceleration.

**Interactive Animations:**
- Card hover: Lift (4px translate-y) + intensified border glow (300ms ease-out)
- Button press: Scale 0.97 with glow pulse (150ms)
- Balance counter: Number roll-up animation with digit transitions (500ms)
- Match updates: Fade-in slide for new lobby entries (400ms)
- Chat messages: Slide-in from right (250ms)
- Notification toasts: Slide-down from top with bounce (400ms elastic)

**Ambient Animations:**
- Neon glow pulse on primary CTAs (2s infinite, subtle)
- Balance display: Gentle breathing glow (3s infinite)
- Online status indicators: Soft pulse (2s infinite)
- Dynamic gradients: Smooth color shifts on game events (1s transition)

**Game State Animations:**
- Win: Confetti particle burst + green gradient wash + balance increment counter
- Loss: Subtle red flash + balance decrement
- Turn changes: Glowing indicator slides between players (400ms)
- Timer warnings: Pulsing red when <10s remaining

**Loading States:**
- Skeleton screens with animated shimmer (neon blue gradient sweep)
- Progress bars with Electric Blue fill and glow trail
- Spinner: Neon ring with rotating gradient

**Performance:** Use CSS transforms (translate, scale) and opacity for all animations. Avoid animating width, height, or positions directly. Leverage will-change for heavy animations.