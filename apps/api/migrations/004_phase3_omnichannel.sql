-- Phase 3: Omnichannel Communication Channels Migration (Task 3.1)
-- Channels for Email, Telegram, Facebook Messenger, Instagram Direct, and SMS

-- 1. channels_email (IMAP Inbound & SMTP Outbound)
CREATE TABLE IF NOT EXISTS channels_email (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    imap_host VARCHAR(255) NOT NULL,
    imap_port INT NOT NULL DEFAULT 993,
    imap_username VARCHAR(255) NOT NULL,
    imap_password_encrypted TEXT NOT NULL,
    smtp_host VARCHAR(255) NOT NULL,
    smtp_port INT NOT NULL DEFAULT 587,
    smtp_username VARCHAR(255) NOT NULL,
    smtp_password_encrypted TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. channels_telegram (Telegram Bot API)
CREATE TABLE IF NOT EXISTS channels_telegram (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_token_encrypted TEXT NOT NULL,
    bot_username VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. channels_facebook (Meta Graph API - Facebook Messenger)
CREATE TABLE IF NOT EXISTS channels_facebook (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id VARCHAR(255) NOT NULL UNIQUE,
    page_access_token_encrypted TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. channels_instagram (Meta Graph API - Instagram Messaging)
CREATE TABLE IF NOT EXISTS channels_instagram (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ig_user_id VARCHAR(255) NOT NULL UNIQUE,
    ig_access_token_encrypted TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. channels_sms (SMS Gateways: Twilio / Custom HTTP SMS)
CREATE TABLE IF NOT EXISTS channels_sms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_name VARCHAR(100) NOT NULL DEFAULT 'twilio',
    account_sid VARCHAR(255) NOT NULL,
    auth_token_encrypted TEXT NOT NULL,
    from_phone_number VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance indexes for channel lookup and webhook matching
CREATE INDEX IF NOT EXISTS idx_channels_email_imap_username ON channels_email(imap_username);
CREATE INDEX IF NOT EXISTS idx_channels_email_smtp_username ON channels_email(smtp_username);
CREATE INDEX IF NOT EXISTS idx_channels_telegram_bot_username ON channels_telegram(bot_username);
CREATE INDEX IF NOT EXISTS idx_channels_facebook_page_id ON channels_facebook(page_id);
CREATE INDEX IF NOT EXISTS idx_channels_instagram_ig_user_id ON channels_instagram(ig_user_id);
CREATE INDEX IF NOT EXISTS idx_channels_sms_from_phone_number ON channels_sms(from_phone_number);

-- 6. business_hours (Inbox Operational Schedule & Out-of-Office Auto Reply) (Task 3.2)
CREATE TABLE IF NOT EXISTS business_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inbox_id UUID NOT NULL REFERENCES inboxes(id) ON DELETE CASCADE UNIQUE,
    timezone VARCHAR(100) NOT NULL DEFAULT 'Asia/Jakarta',
    weekly_schedule JSONB NOT NULL DEFAULT '[]'::jsonb,
    out_of_office_message TEXT NOT NULL DEFAULT 'Halo, terima kasih telah menghubungi kami. Saat ini kami sedang di luar jam operasional kerja.',
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance index for business_hours inbox lookup
CREATE INDEX IF NOT EXISTS idx_business_hours_inbox_id ON business_hours(inbox_id);

-- 7. csat_surveys (Customer Satisfaction Surveys & Rating Responses) (Task 3.3)
CREATE TABLE IF NOT EXISTS csat_surveys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE UNIQUE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    feedback_text TEXT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance indexes for csat_surveys query lookups and aggregation
CREATE INDEX IF NOT EXISTS idx_csat_surveys_ticket_id ON csat_surveys(ticket_id);
CREATE INDEX IF NOT EXISTS idx_csat_surveys_contact_id ON csat_surveys(contact_id);
CREATE INDEX IF NOT EXISTS idx_csat_surveys_rating ON csat_surveys(rating);


