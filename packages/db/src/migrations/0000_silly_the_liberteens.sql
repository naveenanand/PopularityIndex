CREATE TABLE "people" (
	"id" serial PRIMARY KEY NOT NULL,
	"wikidata_qid" varchar(20) NOT NULL,
	"display_name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"date_of_birth" text,
	"occupation_summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "people_wikidata_qid_unique" UNIQUE("wikidata_qid")
);
--> statement-breakpoint
CREATE TABLE "person_aliases" (
	"id" serial PRIMARY KEY NOT NULL,
	"person_id" integer NOT NULL,
	"alias" text NOT NULL,
	"alias_type" varchar(50) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"person_id" integer NOT NULL,
	"platform" varchar(50) NOT NULL,
	"handle" text,
	"platform_account_id" text,
	"verified" boolean DEFAULT false NOT NULL,
	"match_confidence" real,
	"match_method" varchar(100),
	"source_url" text,
	"status" varchar(20) DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wikipedia_pages" (
	"id" serial PRIMARY KEY NOT NULL,
	"person_id" integer NOT NULL,
	"language_code" varchar(10) NOT NULL,
	"page_title" text NOT NULL,
	"page_id" integer,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "news_mention_clusters" (
	"id" serial PRIMARY KEY NOT NULL,
	"person_id" integer NOT NULL,
	"cluster_id" text NOT NULL,
	"article_count" integer NOT NULL,
	"sources_json" jsonb,
	"observed_at" timestamp with time zone NOT NULL,
	"payload_json" jsonb
);
--> statement-breakpoint
CREATE TABLE "pageview_observations" (
	"id" serial PRIMARY KEY NOT NULL,
	"person_id" integer NOT NULL,
	"wikipedia_page_id" integer,
	"date" date NOT NULL,
	"views" integer NOT NULL,
	"language_code" varchar(10) NOT NULL,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pageview_unique_per_day" UNIQUE("person_id","date","language_code")
);
--> statement-breakpoint
CREATE TABLE "search_interest_observations" (
	"id" serial PRIMARY KEY NOT NULL,
	"person_id" integer NOT NULL,
	"provider" varchar(100) NOT NULL,
	"date" date NOT NULL,
	"interest_score" real NOT NULL,
	"geo" varchar(10),
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"payload_json" jsonb
);
--> statement-breakpoint
CREATE TABLE "sentiment_observations" (
	"id" serial PRIMARY KEY NOT NULL,
	"person_id" integer NOT NULL,
	"provider" varchar(100) NOT NULL,
	"sentiment_score" real NOT NULL,
	"positive_share" real,
	"neutral_share" real,
	"negative_share" real,
	"controversy_score" real,
	"sentiment_confidence" real,
	"observed_at" timestamp with time zone NOT NULL,
	"payload_json" jsonb
);
--> statement-breakpoint
CREATE TABLE "social_metric_observations" (
	"id" serial PRIMARY KEY NOT NULL,
	"person_id" integer NOT NULL,
	"platform" varchar(50) NOT NULL,
	"metric_type" varchar(100) NOT NULL,
	"value" real NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"payload_json" jsonb
);
--> statement-breakpoint
CREATE TABLE "source_observations" (
	"id" serial PRIMARY KEY NOT NULL,
	"person_id" integer NOT NULL,
	"provider" varchar(100) NOT NULL,
	"metric_type" varchar(100) NOT NULL,
	"metric_value" real NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"payload_json" jsonb,
	"reliability_score" real
);
--> statement-breakpoint
CREATE TABLE "feature_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"person_id" integer NOT NULL,
	"snapshot_date" date NOT NULL,
	"features_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "score_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"person_id" integer NOT NULL,
	"calculated_at" timestamp with time zone NOT NULL,
	"score_model_version" varchar(20) NOT NULL,
	"popularity_score" real NOT NULL,
	"heat_score" real NOT NULL,
	"sentiment_score" real,
	"controversy_score" real,
	"coverage_score" real NOT NULL,
	"confidence_score" real NOT NULL,
	"explanation_json" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_match_reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"person_id" integer NOT NULL,
	"candidate_entity" text NOT NULL,
	"platform" varchar(50) NOT NULL,
	"reason" text,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_type" varchar(100) NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"status" varchar(20) NOT NULL,
	"records_processed" integer DEFAULT 0,
	"error_message" text,
	"metadata_json" jsonb
);
--> statement-breakpoint
CREATE TABLE "source_providers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" varchar(20) NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"config_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "source_providers_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "person_aliases" ADD CONSTRAINT "person_aliases_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wikipedia_pages" ADD CONSTRAINT "wikipedia_pages_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_mention_clusters" ADD CONSTRAINT "news_mention_clusters_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pageview_observations" ADD CONSTRAINT "pageview_observations_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pageview_observations" ADD CONSTRAINT "pageview_observations_wikipedia_page_id_wikipedia_pages_id_fk" FOREIGN KEY ("wikipedia_page_id") REFERENCES "public"."wikipedia_pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_interest_observations" ADD CONSTRAINT "search_interest_observations_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sentiment_observations" ADD CONSTRAINT "sentiment_observations_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_metric_observations" ADD CONSTRAINT "social_metric_observations_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_observations" ADD CONSTRAINT "source_observations_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_snapshots" ADD CONSTRAINT "feature_snapshots_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_snapshots" ADD CONSTRAINT "score_snapshots_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_match_reviews" ADD CONSTRAINT "entity_match_reviews_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;