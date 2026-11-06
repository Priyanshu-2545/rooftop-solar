// Money columns are integer paise. Timestamps are UTC; shown in Asia/Kolkata (A24).
import {
  boolean, customType, index, integer, jsonb, numeric, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });
const id = () => uuid("id").primaryKey().defaultRandom();
const at = (name: string) => timestamp(name, { withTimezone: true }).notNull().defaultNow();

export const users = pgTable("users", {
  id: id(),
  phone: text("phone").notNull().unique(),
  name: text("name").notNull(),
  role: text("role", { enum: ["homeowner", "sales"] }).notNull(),
  isAdmin: boolean("is_admin").notNull().default(false),
  language: text("language", { enum: ["en", "mr", "hi"] }).notNull().default("en"),
  createdAt: at("created_at"),
});

export const otpChallenges = pgTable("otp_challenges", {
  id: id(),
  phone: text("phone").notNull(),
  codeHash: text("code_hash").notNull(),
  salt: text("salt").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  attempts: integer("attempts").notNull().default(0),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  ip: text("ip"),
  createdAt: at("created_at"),
}, (t) => [index("otp_phone_created").on(t.phone, t.createdAt)]);

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(), // = JWT jti, so logout works server-side
  userId: uuid("user_id").notNull().references(() => users.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: at("created_at"),
});

export const leads = pgTable("leads", {
  id: id(),
  humanId: text("human_id").notNull().unique(),
  ownerUserId: uuid("owner_user_id").notNull().references(() => users.id),
  ownerType: text("owner_type", { enum: ["owner", "tenant"] }).notNull(),
  roofType: text("roof_type", { enum: ["rcc_flat", "sloped_tin", "sloped_tile", "other"] }).notNull(),
  roofAreaSqft: integer("roof_area_sqft").notNull(),
  monthlyBillPaise: integer("monthly_bill_paise").notNull(),
  unitsPerMonth: integer("units_per_month"),
  pincode: text("pincode").notNull(),
  customerType: text("customer_type", { enum: ["residential", "commercial"] }).notNull().default("residential"),
  consentAt: timestamp("consent_at", { withTimezone: true }).notNull(),
  consentTextVersion: text("consent_text_version").notNull(),
  status: text("status", { enum: ["new", "bill_review", "scored", "contacted", "surveyed", "quoted", "won", "closed"] }).notNull().default("new"),
  score: integer("score"),
  scoreBand: text("score_band", { enum: ["high", "medium", "low"] }),
  scoreReasons: jsonb("score_reasons").$type<string[]>(),
  nextStep: text("next_step", { enum: ["survey", "call"] }),
  recommendedKw: numeric("recommended_kw", { precision: 4, scale: 1 }),
  needsHumanCheck: boolean("needs_human_check").notNull().default(false),
  idempotencyKey: text("idempotency_key").unique(),
  createdAt: at("created_at"),
}, (t) => [
  index("leads_owner").on(t.ownerUserId),
  index("leads_status_band").on(t.status, t.scoreBand),
  index("leads_pincode").on(t.pincode),
]);

export const billUploads = pgTable("bill_uploads", {
  id: id(),
  leadId: uuid("lead_id").notNull().references(() => leads.id),
  storageKey: text("storage_key").notNull().unique(), // random; never a public path (A16)
  data: bytea("bytes_data").notNull(),
  mime: text("mime").notNull(),
  bytes: integer("bytes").notNull(),
  sha256: text("sha256").notNull(),
  qualityFlag: text("quality_flag", { enum: ["good", "poor", "unknown"] }).notNull(),
  attemptNo: integer("attempt_no").notNull().default(1),
  uploadedAt: at("uploaded_at"),
}, (t) => [index("uploads_lead").on(t.leadId)]);

export const billExtractions = pgTable("bill_extractions", {
  id: id(),
  uploadId: uuid("upload_id").notNull().references(() => billUploads.id),
  backend: text("backend").notNull().default("simulated"),
  rawJson: jsonb("raw_json"),
  consumerNo: text("consumer_no"),
  tariff: text("tariff"),
  sanctionedLoadKw: numeric("sanctioned_load_kw", { precision: 6, scale: 1 }),
  avgUnitsMonth: integer("avg_units_month"),
  confidenceJson: jsonb("confidence_json").$type<Record<string, number>>(),
  // extracted vs confirmed kept separately so accuracy can be measured later
  confirmedJson: jsonb("confirmed_json"),
  status: text("status", { enum: ["pending", "confirmed", "edited", "rejected_photo"] }).notNull().default("pending"),
  confirmedBy: uuid("confirmed_by").references(() => users.id),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
});

export const surveys = pgTable("surveys", {
  leadId: uuid("lead_id").primaryKey().references(() => leads.id),
  roofOk: boolean("roof_ok").notNull(),
  usableAreaSqft: integer("usable_area_sqft"),
  shading: text("shading", { enum: ["none", "some", "heavy"] }).notNull().default("none"),
  notes: text("notes"),
  surveyedBy: uuid("surveyed_by").notNull().references(() => users.id),
  at: at("at"),
});

export const priceRules = pgTable("price_rules", {
  id: id(),
  kw: integer("kw").notNull(),
  tier: text("tier", { enum: ["standard", "premium"] }).notNull(),
  pricePaise: integer("price_paise").notNull(),
  effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull(),
  effectiveTo: timestamp("effective_to", { withTimezone: true }),
}, (t) => [index("price_rules_lookup").on(t.kw, t.tier, t.effectiveFrom)]);

export const subsidyRules = pgTable("subsidy_rules", {
  id: id(),
  scheme: text("scheme").notNull(),
  customerType: text("customer_type", { enum: ["residential", "commercial"] }).notNull(),
  perKwPaise: integer("per_kw_paise").notNull(),
  firstKwLimit: integer("first_kw_limit").notNull(),
  extraKwPaise: integer("extra_kw_paise").notNull(),
  capPaise: integer("cap_paise").notNull(),
  effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull(),
  effectiveTo: timestamp("effective_to", { withTimezone: true }),
  verified: boolean("verified").notNull().default(false),
  sourceNote: text("source_note").notNull(),
}, (t) => [index("subsidy_rules_lookup").on(t.customerType, t.effectiveFrom)]);

export const appSettings = pgTable("app_settings", {
  key: text("key").notNull(),
  value: text("value").notNull(),
  effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull(),
}, (t) => [primaryKey({ columns: [t.key, t.effectiveFrom] })]);

export const quotes = pgTable("quotes", {
  id: id(),
  leadId: uuid("lead_id").notNull().references(() => leads.id),
  version: integer("version").notNull().default(1),
  status: text("status", { enum: ["draft", "sent", "accepted", "expired"] }).notNull().default("draft"),
  inputsSnapshot: jsonb("inputs_snapshot").notNull(),
  outputsSnapshot: jsonb("outputs_snapshot").notNull(),
  ruleIdsUsed: jsonb("rule_ids_used").$type<string[]>().notNull(),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  validUntil: timestamp("valid_until", { withTimezone: true }),
  selectedOption: integer("selected_option"), // index into outputs.options, set on accept
  createdAt: at("created_at"),
}, (t) => [index("quotes_lead").on(t.leadId)]);

export const projectStages = pgTable("project_stages", {
  code: text("code").primaryKey(),
  labelEn: text("label_en").notNull(),
  labelMr: text("label_mr").notNull(),
  labelHi: text("label_hi").notNull(),
  nextEn: text("next_en").notNull(),
  nextMr: text("next_mr").notNull(),
  nextHi: text("next_hi").notNull(),
  order: integer("order").notNull().unique(),
  stuckAfterDays: integer("stuck_after_days"),
});

export const projects = pgTable("projects", {
  id: id(),
  humanId: text("human_id").notNull().unique(),
  quoteId: uuid("quote_id").notNull().unique().references(() => quotes.id),
  stageCode: text("stage_code").notNull().references(() => projectStages.code),
  statusTokenHash: text("status_token_hash"),
  tokenRevokedAt: timestamp("token_revoked_at", { withTimezone: true }),
  startedAt: at("started_at"),
  stageEnteredAt: at("stage_entered_at"),
}, (t) => [
  index("projects_stage").on(t.stageCode, t.stageEnteredAt),
  uniqueIndex("projects_token").on(t.statusTokenHash),
]);

export const projectEvents = pgTable("project_events", {
  id: id(),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  stageCode: text("stage_code").notNull().references(() => projectStages.code),
  note: text("note"),
  actorUserId: uuid("actor_user_id").references(() => users.id),
  at: at("at"),
}, (t) => [index("events_project").on(t.projectId)]);

export const documents = pgTable("documents", {
  id: id(),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  kind: text("kind").notNull(),
  filename: text("filename").notNull(),
  storageKey: text("storage_key").notNull().unique(),
  data: bytea("bytes_data").notNull(),
  mime: text("mime").notNull(),
  uploadedBy: uuid("uploaded_by").notNull().references(() => users.id),
  at: at("at"),
});

export const messages = pgTable("messages", {
  id: id(),
  toPhone: text("to_phone").notNull(),
  channel: text("channel", { enum: ["whatsapp", "sms"] }).notNull(),
  template: text("template").notNull(),
  body: text("body").notNull(),
  lang: text("lang", { enum: ["en", "mr", "hi"] }).notNull(),
  status: text("status", { enum: ["queued", "mock_sent"] }).notNull(),
  createdAt: at("created_at"),
});

export const auditLog = pgTable("audit_log", {
  id: id(),
  actorUserId: uuid("actor_user_id").references(() => users.id),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id").notNull(),
  at: at("at"),
  meta: jsonb("meta"), // never PII
});

export const payments = pgTable("payments", {
  id: id(),
  quoteId: uuid("quote_id").notNull().references(() => quotes.id),
  amountPaise: integer("amount_paise").notNull(),
  mode: text("mode", { enum: ["mock"] }).notNull().default("mock"),
  ref: text("ref").notNull(),
  status: text("status", { enum: ["paid"] }).notNull().default("paid"),
  idempotencyKey: text("idempotency_key").unique(),
  createdAt: at("created_at"),
});

export const rateLimits = pgTable("rate_limits", {
  key: text("key").notNull(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  count: integer("count").notNull().default(0),
}, (t) => [primaryKey({ columns: [t.key, t.windowStart] })]);
