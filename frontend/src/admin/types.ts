export type ConfigStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED'

export interface CrashSettings {
  alpha: number
  maxMultiplier: number
  minCrashMultiplier: number
  multiplierGrowthRate: number
  fps: number
  delta: number
}
export interface ThemeProbabilities { [key: `line${number}LootProb`]: number }
export interface BoosterSettings {
  multiplierTier1Value: number
  multiplierTier2Value: number
  multiplierTier3Value: number
  multiplierTier4Value: number
  green: ThemeProbabilities
  red: ThemeProbabilities
}
export interface PointsSettings { pointsPerLine: number; pointsCashoutBonus: number; pointsXNBonus: number }

export interface GameConfiguration {
  id: string
  revision: number
  status: ConfigStatus
  createdAt: string
  createdBy: string
  activatedAt: string | null
  activatedBy: string | null
  baseRevision: number | null
  sourceVersionId: string | null
  gameId: string
  gameName: string
  gameType: 'CRASH'
  isActive: boolean
  crash: CrashSettings
  boosters: BoosterSettings
  points: PointsSettings
}

export interface GameConfigurationWrite {
  gameId: string
  gameName: string
  gameType: 'CRASH'
  isActive: boolean
  revision: number
  crash: CrashSettings
  boosters: BoosterSettings
  points: PointsSettings
}

export interface ConfigurationVersionSummary {
  id: string
  revision: number
  status: ConfigStatus
  baseRevision: number | null
  sourceVersionId: string | null
  createdAt: string
  createdBy: string
  activatedAt: string | null
  activatedBy: string | null
}

export interface DiffEntry { field: string; before: unknown | null; after: unknown | null }
export interface ConfigDiff { fromVersionId: string; toVersionId: string; changes: DiffEntry[] }

export type MetadataGroup = 'general' | 'crash' | 'boosters' | 'points'
export type MetadataType = 'string' | 'number' | 'integer' | 'percent' | 'boolean'

export interface ParameterMetadata {
  technicalName: string
  displayName: string
  description: string | null
  dataType: MetadataType
  unit: string | null
  min: number | null
  max: number | null
  defaultValue: unknown | null
  required: boolean
  mutable: boolean
  group: MetadataGroup
  semanticType: string | null
  allowedValues: string[] | null
  effectOnGame: string | null
}

export interface ConfigMetadata {
  gameIdPolicy: string
  probabilityModel: string
  greenLevelCount: number
  redLevelCount: number
  parameters: ParameterMetadata[]
}

export interface AuditEvent {
  id: string
  timestamp: string
  administrator: string
  action: string
  affectedEntity: string | null
  gameId: string | null
  configId: string | null
  traceId: string | null
  metadata: string | null
}

export interface PageResponse<T> { content: T[]; page: number; size: number; totalElements: number; totalPages: number }

export interface FieldViolation { field: string; message: string; rejectedValue?: unknown }
export interface ValidationResult { valid: boolean; warnings: string[] }
export interface AdminErrorBody {
  timestamp: string
  status: number
  code: string
  message: string
  traceId: string
  fieldErrors?: FieldViolation[]
  currentVersion?: number
}

export interface LoginRequest { username: string; password: string }
export interface LoginResponse { accessToken: string; tokenType: string; expiresAt: string }

export const ADMIN_ACTIONS = ['CONFIG_CREATED', 'CONFIG_VALIDATED', 'CONFIG_ACTIVATED', 'CONFIG_ROLLBACK', 'ADMIN_LOGIN', 'ADMIN_LOGOUT'] as const