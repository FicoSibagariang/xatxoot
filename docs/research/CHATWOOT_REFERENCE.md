# Referensi Riset Codebase Chatwoot — Xatxoot

> **Chatwoot v4.18.0 Reverse-Engineering Reference**  
> Dokumen ini mencatat hasil audit arsitektur, daftar tabel, dan pemetaan file dari codebase Chatwoot v4.18.0 sebagai bahan studi perilaku untuk membangun Xatxoot.

---

## 1. Daftar Tabel Database Chatwoot (104 Tabel)

Tabel-tabel di bawah ini diekstrak dari `db/schema.rb` Chatwoot v4.18.0:

```text
access_tokens, account_saml_settings, account_users, accounts, 
action_mailbox_inbound_emails, active_storage_*, agent_bot_inboxes, 
agent_bots, agent_capacity_policies, agent_sessions, applied_slas, 
article_embeddings, articles, assignment_policies, attachments, audits, 
automation_rule_pending_executions, automation_rules, calls, 
campaign_recipients, campaigns, canned_responses, 
captain_assistant_responses, captain_assistants, captain_custom_tools, 
captain_documents, captain_faq_observations, captain_faq_suggestions, 
captain_inboxes, captain_message_reports, captain_scenarios, categories, 
channel_api, channel_email, channel_facebook_pages, channel_instagram, 
channel_line, channel_sms, channel_telegram, channel_tiktok, 
channel_twilio_sms, channel_twitter_profiles, channel_web_widgets, 
channel_whatsapp, companies, contact_inboxes, contacts, 
conversation_monitor_*, conversation_monitors, conversation_outcomes, 
conversation_participants, conversations, copilot_messages, 
copilot_threads, csat_survey_responses, custom_attribute_definitions, 
custom_filters, custom_roles, dashboard_apps, data_import_errors, 
data_import_items, data_import_mappings, data_imports, email_templates, 
folders, inbox_assignment_policies, inbox_capacity_limits, inbox_members, 
inboxes, installation_configs, integrations_hooks, labels, leaves, macros, 
mentions, messages, notes, notification_settings, notification_subscriptions, 
notifications, platform_app_permissibles, platform_apps, platform_banners, 
portals, portals_members, related_categories, reporting_events, 
reporting_events_rollups, sla_events, sla_policies, taggings, tags, 
team_members, teams, user_sessions, users, webhooks, working_hours
```

---

## 2. Lokasi Modul Penting di Codebase Chatwoot

| Area Fitur | Path di Chatwoot | Catatan Teknis |
|---|---|---|
| **Feature Flags** | `config/features.yml` | Bitmask permission per akun. |
| **Domain Models** | `app/models/`, `app/models/channel/` | Model ActiveRecord Ruby on Rails. |
| **Enterprise Overlay** | `enterprise/app/models/` | Modul berbayar yang di-prepend ke modul open source. |
| **API Endpoints** | `app/controllers/api/`, `config/routes.rb` | REST API v1/v2 Chatwoot. |
| **Platform API** | `app/controllers/platform/` | Multi-tenant SaaS provisioning endpoints. |
| **Public API** | `app/controllers/public/` | Endpoint live chat widget. |
| **Dashboard UI** | `app/javascript/dashboard/` | SPA Vue 3 + Vuex/Pinia. |
| **Chat Widget** | `app/javascript/widget/`, `app/javascript/sdk/` | Widget terpisah iframe/JS bundle. |
| **Database Schema** | `db/schema.rb` | Definisi skema PostgreSQL ActiveRecord. |

---

## 3. Perbedaan Kunci Desain: Chatwoot vs Xatxoot

| Dimensi | Chatwoot (v4.18.0) | Xatxoot |
|---|---|---|
| **Pola Kode** | Monolit Ruby on Rails 7.2 | Modular Monorepo Hono on Bun |
| **ORM / Data Access** | ActiveRecord ORM | **Native Bun SQL (No ORM, Raw SQL murni)** |
| **Tenancy** | Multi-tenant SaaS (semua tabel punya `account_id`) | **Single Organization** (tanpa `account_id`) |
| **Frontend** | Vue 3 + Tailwind CSS | React 19 + Vite + Tailwind + **Astryx by Meta** |
| **UI Design** | Tampilan antarmuka Helpdesk generik | Tampilan khas **WhatsApp Web (3.5 kolom)** |
| **Unit Kasus** | `Conversation` merangkap tiket penanganan | **Pemisahan tegas: `Conversation` (chat stream) vs `Ticket` (unit kerja)** |
| **Catatan Internal** | Pesan bubble privat di dalam chat (`private: true`) | **1:1 Sticky Note** di kartu samping (anti salah kirim ke pelanggan) |
| **WhatsApp Gateway** | Bergantung pada Twilio atau Cloud API resmi | **Dual-Provider**: Cloud API resmi + Gateway Baileys Unofficial terisolasi |
