export type ConfigurationStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export interface CrashConfiguration {
  alpha: number;
  maxMultiplier: number;
  minCrashMultiplier: number;
  multiplierGrowthRate: number;
  fps: number;
  delta: number;
}

export interface BoosterConfiguration {
  multiplierTier1Value: number;
  multiplierTier2Value: number;
  multiplierTier3Value: number;
  multiplierTier4Value: number;
  green: Record<string, number>;
  red: Record<string, number>;
}

export interface PointsConfiguration {
  pointsPerLine: number;
  pointsCashoutBonus: number;
  pointsXNBonus: number;
}

export interface GameConfigurationResponse {
  id: string;
  revision: number;
  status: ConfigurationStatus;
  baseRevision?: number | null;
  sourceVersionId?: string | null;
  createdAt: string;
  createdBy: string;
  activatedAt?: string | null;
  activatedBy?: string | null;
  gameId: string;
  gameName: string;
  gameType: string;
  isActive: boolean;
  crash: CrashConfiguration;
  boosters: BoosterConfiguration;
  points: PointsConfiguration;
}

export interface GameConfigurationCandidateRequest {
  revision: number;
  gameId: string;
  gameName: string;
  gameType: string;
  isActive: boolean;
  crash: CrashConfiguration;
  boosters: BoosterConfiguration;
  points: PointsConfiguration;
}

export type MetadataScalar = string | number | boolean | null;

export interface ConfigParameterMetadata {
  technicalName: string;
  displayName?: string | null;
  description?: string | null;
  dataType: string;
  min?: number | null;
  max?: number | null;
  defaultValue?: MetadataScalar;
  required: boolean;
  mutable: boolean;
  group?: string | null;
  effectOnGame?: string | null;
  allowedValues?: Array<string | number | boolean> | null;
}

export interface ConfigMetadataResponse {
  gameIdPolicy?: string | null;
  probabilityModel?: string | null;
  greenLevelCount: number;
  redLevelCount: number;
  parameters: ConfigParameterMetadata[];
}

export interface ValidationResponse {
  valid: boolean;
  warnings: string[];
}

export interface VersionSummary {
  id: string;
  revision: number;
  status: ConfigurationStatus;
  baseRevision?: number | null;
  sourceVersionId?: string | null;
  createdAt: string;
  createdBy: string;
  activatedAt?: string | null;
  activatedBy?: string | null;
}

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface DiffChange {
  field: string;
  before: unknown;
  after: unknown;
}

export interface DiffResponse {
  fromVersionId: string;
  toVersionId: string;
  changes: DiffChange[];
}

export type AuditAction =
  | 'CONFIG_CREATED'
  | 'CONFIG_VALIDATED'
  | 'CONFIG_ACTIVATED'
  | 'CONFIG_ROLLBACK'
  | 'ADMIN_LOGIN'
  | 'ADMIN_LOGOUT';

export interface AuditEntry {
  id: string;
  timestamp: string;
  administrator: string;
  action: AuditAction;
  affectedEntity?: string | null;
  gameId?: string | null;
  configId?: string | null;
  traceId?: string | null;
  metadata?: string | null;
}

export type AuditResponse = PageResponse<AuditEntry>;

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: string;
  expiresAt: string;
}

export interface FieldErrorItem {
  field: string;
  message: string;
}

export interface ApiErrorResponse {
  status: number;
  code?: string;
  message?: string;
  fieldErrors?: Record<string, string> | FieldErrorItem[];
  traceId?: string;
  currentVersion?: number;
}
