# Screenshots Feature - REST API Implementation Guide

## Overview
The game launcher now supports multiple screenshots per game. Users can upload up to 10 screenshots when creating or editing games. These screenshots are displayed in the game details view.

## Data Structure

### Screenshots Field
- **Field Name**: `screenshots`
- **Type**: Array of strings (URLs)
- **Format**: Each string is a full URL to an image hosted on the CDN
- **Example**: 
  ```json
  {
    "screenshots": [
      "https://cdn.diabolical.services/path/to/screenshot1.jpg",
      "https://cdn.diabolical.services/path/to/screenshot2.png",
      "https://cdn.diabolical.services/path/to/screenshot3.webp"
    ]
  }
  ```

### Database Schema
The `screenshots` field should be added to the games table:
- **Column Name**: `screenshots`
- **Data Type**: JSON array or TEXT (depending on your database)
  - For PostgreSQL: `JSONB` or `TEXT[]`
  - For MySQL: `JSON` or `TEXT`
  - For SQLite: `TEXT` (store as JSON string)
- **Nullable**: Yes (can be NULL or empty array)
- **Default**: `NULL` or `[]` (empty array)

## API Endpoints

### 1. Create Game (`POST /rest-api/games`)

**Request Body:**
```json
{
  "game_name": "My Game",
  "game_id": "mygame",
  "team_name": "MyTeam",
  "description": "Game description",
  "background_image_url": "https://cdn.diabolical.services/background.jpg",
  "version": "1.0.0",
  "team_icon_url": "https://cdn.diabolical.services/icon.png",
  "github_repo": "user/repo",
  "status": "public",
  "screenshots": [
    "https://cdn.diabolical.services/screenshot1.jpg",
    "https://cdn.diabolical.services/screenshot2.png"
  ]
}
```

**Implementation Notes:**
- `screenshots` is **optional** - if not provided, set to `NULL` or empty array `[]`
- If provided, validate it's an array
- Each element should be a valid URL string
- Maximum 10 screenshots (enforce this limit)
- Store the array as-is in the database

### 2. Update Game (`PUT /rest-api/games/{game_id}`)

**Request Body:**
```json
{
  "game_name": "Updated Game Name",
  "background_image_url": "https://cdn.diabolical.services/new-background.jpg",
  "description": "Updated description",
  "version": "1.1.0",
  "status": "public",
  "screenshots": [
    "https://cdn.diabolical.services/screenshot1.jpg",
    "https://cdn.diabolical.services/screenshot2.png",
    "https://cdn.diabolical.services/screenshot3.webp"
  ]
}
```

**Implementation Notes:**
- `screenshots` is **optional** in update requests
- If `screenshots` is provided (even if empty array `[]`), update the field
- If `screenshots` is `undefined` or not in the request, don't modify the existing screenshots
- If provided, validate it's an array with max 10 elements
- Replace the entire array (not merge)

### 3. Get Game (`GET /rest-api/games/{game_id}`)

**Response:**
```json
{
  "game_id": "mygame",
  "game_name": "My Game",
  "background_image_url": "https://cdn.diabolical.services/background.jpg",
  "description": "Game description",
  "version": "1.0.0",
  "status": "public",
  "screenshots": [
    "https://cdn.diabolical.services/screenshot1.jpg",
    "https://cdn.diabolical.services/screenshot2.png"
  ]
}
```

**Implementation Notes:**
- Always include `screenshots` field in response
- If no screenshots exist, return empty array `[]` or `null` (be consistent)
- Ensure the array is properly serialized from database format

## Validation Rules

1. **Type Validation**: `screenshots` must be an array (if provided)
2. **Max Length**: Maximum 10 screenshots per game
3. **URL Format**: Each screenshot URL should be a valid URL string
4. **Optional Field**: `screenshots` is optional in both create and update operations

## Database Examples

### PostgreSQL (JSONB)
```sql
CREATE TABLE games (
  game_id VARCHAR(255) PRIMARY KEY,
  game_name VARCHAR(255),
  background_image_url TEXT,
  screenshots JSONB DEFAULT '[]'::jsonb,
  -- other fields...
);

-- Insert example
INSERT INTO games (game_id, game_name, screenshots) 
VALUES ('mygame', 'My Game', '["https://cdn.diabolical.services/s1.jpg", "https://cdn.diabolical.services/s2.jpg"]'::jsonb);

-- Query example
SELECT game_id, game_name, screenshots FROM games WHERE game_id = 'mygame';
```

### MySQL (JSON)
```sql
CREATE TABLE games (
  game_id VARCHAR(255) PRIMARY KEY,
  game_name VARCHAR(255),
  background_image_url TEXT,
  screenshots JSON DEFAULT (JSON_ARRAY()),
  -- other fields...
);

-- Insert example
INSERT INTO games (game_id, game_name, screenshots) 
VALUES ('mygame', 'My Game', JSON_ARRAY('https://cdn.diabolical.services/s1.jpg', 'https://cdn.diabolical.services/s2.jpg'));
```

### SQLite (TEXT as JSON)
```sql
CREATE TABLE games (
  game_id TEXT PRIMARY KEY,
  game_name TEXT,
  background_image_url TEXT,
  screenshots TEXT DEFAULT '[]',
  -- other fields...
);

-- Insert example (store as JSON string)
INSERT INTO games (game_id, game_name, screenshots) 
VALUES ('mygame', 'My Game', '["https://cdn.diabolical.services/s1.jpg", "https://cdn.diabolical.services/s2.jpg"]');
```

## Response Format

Always return `screenshots` as a JSON array in API responses:

```json
{
  "screenshots": ["url1", "url2", "url3"]
}
```

If no screenshots:
```json
{
  "screenshots": []
}
```

## Migration Guide

If you need to add this field to existing games:

```sql
-- PostgreSQL
ALTER TABLE games ADD COLUMN screenshots JSONB DEFAULT '[]'::jsonb;

-- MySQL
ALTER TABLE games ADD COLUMN screenshots JSON DEFAULT (JSON_ARRAY());

-- SQLite
ALTER TABLE games ADD COLUMN screenshots TEXT DEFAULT '[]';
```

Then update existing records to have empty arrays:
```sql
UPDATE games SET screenshots = '[]' WHERE screenshots IS NULL;
```

## Error Handling

- If `screenshots` is provided but not an array: Return 400 Bad Request
- If `screenshots` array has more than 10 elements: Return 400 Bad Request with message "Maximum 10 screenshots allowed"
- If any screenshot URL is invalid format: Return 400 Bad Request (optional validation)

## Testing Examples

### Create game with screenshots
```bash
POST /rest-api/games
{
  "game_name": "Test Game",
  "game_id": "testgame",
  "team_name": "TestTeam",
  "screenshots": ["https://cdn.diabolical.services/test1.jpg", "https://cdn.diabolical.services/test2.jpg"]
}
```

### Update game screenshots
```bash
PUT /rest-api/games/testgame
{
  "screenshots": ["https://cdn.diabolical.services/new1.jpg"]
}
```

### Create game without screenshots (should work)
```bash
POST /rest-api/games
{
  "game_name": "Test Game 2",
  "game_id": "testgame2",
  "team_name": "TestTeam"
  // screenshots not provided - should default to [] or NULL
}
```

