CREATE TABLE IF NOT EXISTS "newsletter_subscribers" (
  "id" serial PRIMARY KEY NOT NULL,
  "email" varchar(255) UNIQUE NOT NULL,
  "unsubscribe_token" varchar(64) NOT NULL,
  "confirmed" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
