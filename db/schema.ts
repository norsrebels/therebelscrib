import { pgTable, serial, text, integer, timestamp, jsonb, boolean, uuid, varchar } from "drizzle-orm/pg-core";

export const players = pgTable("players", {
  id: serial().primaryKey(),
  nickname: text().notNull(),
  position: text().notNull().default(""),
  overallScore: integer("overall_score").notNull().default(0),
  playerLevel: text("player_level").notNull().default("Developmental"),
  profilePicture: text("profile_picture"),
  jerseyNumber: integer("jersey_number"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const assessments = pgTable("assessments", {
  id: serial().primaryKey(),
  playerId: integer("player_id")
    .notNull()
    .references(() => players.id, { onDelete: "cascade" }),
  // Technical
  serving: integer().notNull().default(0),
  servingVariations: integer("serving_variations").notNull().default(0),
  passing: integer().notNull().default(0),
  setting: integer().notNull().default(0),
  attacking: integer().notNull().default(0),
  backRowAttack: integer("back_row_attack").notNull().default(0),
  blocking: integer().notNull().default(0),
  defensiveCoverage: integer("defensive_coverage").notNull().default(0),
  transitionPlay: integer("transition_play").notNull().default(0),
  tipOffSpeedShots: integer("tip_off_speed_shots").notNull().default(0),
  firstBallContact: integer("first_ball_contact").notNull().default(0),
  // Tactical
  blockingStrategy: integer("blocking_strategy").notNull().default(0),
  shotPlacementAwareness: integer("shot_placement_awareness").notNull().default(0),
  rotationDiscipline: integer("rotation_discipline").notNull().default(0),
  courtVision: integer("court_vision").notNull().default(0),
  // Physical
  speedAgility: integer("speed_agility").notNull().default(0),
  jumpingAbility: integer("jumping_ability").notNull().default(0),
  explosiveness: integer().notNull().default(0),
  flexibility: integer().notNull().default(0),
  lateralQuickness: integer("lateral_quickness").notNull().default(0),
  enduranceStrength: integer("endurance_strength").notNull().default(0),
  // Mental
  gameIq: integer("game_iq").notNull().default(0),
  adaptability: integer().notNull().default(0),
  composure: integer().notNull().default(0),
  pressureHandling: integer("pressure_handling").notNull().default(0),
  emotionalControl: integer("emotional_control").notNull().default(0),
  // Teamwork
  communication: integer().notNull().default(0),
  teamworkDiscipline: integer("teamwork_discipline").notNull().default(0),

  // New flexible scores JSON field
  scores: jsonb("scores").default({}),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const settings = pgTable("settings", {
  id: serial().primaryKey(),
  key: text().notNull().unique(),
  value: jsonb().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const tournaments = pgTable("tournaments", {
  id: serial().primaryKey(),
  externalId: text("external_id").notNull().unique(),
  name: text().notNull(),
  archived: boolean().notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const albums = pgTable("albums", {
  id: serial().primaryKey(),
  name: text().notNull(),
  coverImageUrl: text("cover_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const albumImages = pgTable("album_images", {
  id: serial().primaryKey(),
  albumId: integer("album_id").notNull().references(() => albums.id, { onDelete: "cascade" }),
  imageId: text("image_id").notNull(),
  imageUrl: text("image_url").notNull(),
  alt: text().notNull().default(""),
  caption: text().notNull().default(""),
  createdAt: timestamp("created_at").defaultNow(),
});

export const siteSettings = pgTable("site_settings", {
  id: serial().primaryKey(),
  key: text().notNull().unique(),
  value: text().notNull().default(""),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const announcements = pgTable('announcements', {
  id: serial().primaryKey(),
  title: text().notNull(),
  body: text().notNull(),
  tag: text().notNull().default('Announcement'),
  tagColor: text('tag_color').notNull().default('blue'),
  pinned: boolean().notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

// VIS Match Stats System
export const visMatches = pgTable('vis_matches', {
  id: serial().primaryKey(),
  matchDate: text('match_date').notNull(),
  teamName: text('team_name').notNull().default('The Rebels'),
  opponentName: text('opponent_name').notNull(),
  location: text().notNull().default(''),
  passwordHash: text('password_hash').notNull(),
  totalSets: integer('total_sets').notNull().default(1),
  // Tournament linkage (optional)
  tournamentId: text('tournament_id'),
  tournamentMatchId: text('tournament_match_id'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const visMatchPlayers = pgTable('vis_match_players', {
  id: serial().primaryKey(),
  matchId: integer('match_id').notNull().references(() => visMatches.id, { onDelete: 'cascade' }),
  jerseyNumber: integer('jersey_number').notNull(),
  playerName: text('player_name').notNull(),
  globalPlayerId: integer('global_player_id').references(() => players.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow(),
})

export const visSetStats = pgTable('vis_set_stats', {
  id: serial().primaryKey(),
  matchId: integer('match_id').notNull().references(() => visMatches.id, { onDelete: 'cascade' }),
  playerId: integer('player_id').notNull().references(() => visMatchPlayers.id, { onDelete: 'cascade' }),
  setNumber: integer('set_number').notNull(),
  // Offense
  spikeKill: integer('spike_kill').notNull().default(0),
  spikeError: integer('spike_error').notNull().default(0),
  spikeAttempt: integer('spike_attempt').notNull().default(0),
  blockKill: integer('block_kill').notNull().default(0),
  blockError: integer('block_error').notNull().default(0),
  blockRebound: integer('block_rebound').notNull().default(0),
  serveAce: integer('serve_ace').notNull().default(0),
  serveError: integer('serve_error').notNull().default(0),
  serveAttempt: integer('serve_attempt').notNull().default(0),
  // Defense
  digExcellent: integer('dig_excellent').notNull().default(0),
  digFault: integer('dig_fault').notNull().default(0),
  digAttempt: integer('dig_attempt').notNull().default(0),
  setExcellent: integer('set_excellent').notNull().default(0),
  setFault: integer('set_fault').notNull().default(0),
  setAttempt: integer('set_attempt').notNull().default(0),
  receiveExcellent: integer('receive_excellent').notNull().default(0),
  receiveError: integer('receive_error').notNull().default(0),
  receiveAttempt: integer('receive_attempt').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

// ─── VIS Statistics Module ──────────────────────────────────────

export const statUsers = pgTable('stat_users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: varchar('role', { length: 20 }).notNull().default('statistician'),
  isActive: boolean('is_active').notNull().default(true),
  mustChangePassword: boolean('must_change_password').notNull().default(true),
  failedLoginCount: integer('failed_login_count').notNull().default(0),
  lockoutUntil: timestamp('lockout_until'),
  lastLoginAt: timestamp('last_login_at'),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const playerStats = pgTable('player_stats', {
  id: uuid('id').primaryKey().defaultRandom(),
  matchId: varchar('match_id', { length: 100 }).notNull(),
  playerId: integer('player_id').notNull().references(() => players.id),
  teamId: varchar('team_id', { length: 100 }).notNull(),
  setNumber: integer('set_number').notNull().default(0),
  attackKill: integer('attack_kill').notNull().default(0),
  attackError: integer('attack_error').notNull().default(0),
  attackAttempt: integer('attack_attempt').notNull().default(0),
  serveAce: integer('serve_ace').notNull().default(0),
  serveError: integer('serve_error').notNull().default(0),
  serveAttempt: integer('serve_attempt').notNull().default(0),
  receptionPerfect: integer('reception_perfect').notNull().default(0),
  receptionGood: integer('reception_good').notNull().default(0),
  receptionOk: integer('reception_ok').notNull().default(0),
  receptionError: integer('reception_error').notNull().default(0),
  setAssist: integer('set_assist').notNull().default(0),
  setAttempt: integer('set_attempt').notNull().default(0),
  setBallHandlingError: integer('set_ball_handling_error').notNull().default(0),
  blockSolo: integer('block_solo').notNull().default(0),
  blockAssist: integer('block_assist').notNull().default(0),
  blockError: integer('block_error').notNull().default(0),
  blockRebound: integer('block_rebound').notNull().default(0),
  dig: integer('dig').notNull().default(0),
  digError: integer('dig_error').notNull().default(0),
  digAttempt: integer('dig_attempt').notNull().default(0),
  receiveAttempt: integer('receive_attempt').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  statUserId: uuid('stat_user_id'),
  username: varchar('username', { length: 50 }).notNull(),
  userRole: varchar('user_role', { length: 20 }).notNull(),
  action: varchar('action', { length: 50 }).notNull(),
  entityType: varchar('entity_type', { length: 30 }),
  entityId: varchar('entity_id', { length: 100 }),
  matchId: varchar('match_id', { length: 100 }),
  fieldName: varchar('field_name', { length: 50 }),
  oldValue: text('old_value'),
  newValue: text('new_value'),
  ipAddress: varchar('ip_address', { length: 45 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})
