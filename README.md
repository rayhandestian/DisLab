# DisLab - Discord Tools

A modern web application for scheduling and sending Discord webhooks with user authentication and recurring schedules.

## ✨ Features

- 🔐 **Discord OAuth Authentication** - Secure login with Discord
- 📅 **One-Time Schedules** - Schedule webhooks for specific dates and times
- 🔄 **Recurring Schedules** - Daily, weekly, monthly, or custom cron patterns
- 💬 **Natural Language** - Type "every Monday at 9 AM" and it just works
- 📎 **File Attachments** - Send files with your webhooks
- 🎨 **Rich Embeds** - Full Discord embed support
- 📊 **Execution Tracking** - Monitor schedule execution history
- 🎯 **Max Executions** - Limit recurring schedules to run N times

## Setup Instructions

### 1. Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Authentication > Providers and enable Discord
3. Add your Discord application credentials:
   - Create a Discord app at [discord.com/developers](https://discord.com/developers)
   - Copy Client ID and Client Secret to Supabase
   - Set redirect URI to: `https://your-supabase-project.supabase.co/auth/v1/callback` (Supabase's internal callback URL - replace `your-supabase-project` with your actual Supabase project ID)
4. In Supabase **Authentication → URL Configuration**:
   - Set **Site URL** to `https://your-domain.com`
   - Add `https://your-domain.com/auth/callback` to **Additional Redirect URLs**
   - Keep `http://localhost:3000/auth/callback` for local development
5. Copy your Supabase URL and anon key from Project Settings > API

### 2. Environment Variables

Update `.env.local` with your Supabase credentials and the canonical site URL you want users redirected to after OAuth:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

> **Notes**
> - `NEXT_PUBLIC_SITE_URL` must include the protocol (`https://`) and should not end with a trailing slash. This value is used for Supabase OAuth redirects in production.
> - When running locally you can omit `NEXT_PUBLIC_SITE_URL`; the app will fall back to `http://localhost:3000`.
> - On Vercel you can alternatively rely on the automatically provided `VERCEL_URL`, but setting `NEXT_PUBLIC_SITE_URL` explicitly is recommended to avoid surprises with preview URLs.

### 3. Database Schema

**IMPORTANT**: For recurring schedules support, use the migration SQL from [`docs/DATABASE_MIGRATION.md`](docs/DATABASE_MIGRATION.md) instead of the basic schema below.

<details>
<summary>Basic Schema (One-Time Schedules Only - Click to expand)</summary>

Run the following SQL in Supabase SQL Editor for basic one-time schedules:

```sql
-- Users table (extends auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'paid')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Schedules table
CREATE TABLE public.schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  webhook_url TEXT NOT NULL,
  message_data JSONB NOT NULL,
  schedule_time TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own schedules" ON public.schedules
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own schedules" ON public.schedules
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own schedules" ON public.schedules
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own schedules" ON public.schedules
  FOR DELETE USING (auth.uid() = user_id);

-- Function to handle new user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, tier)
  VALUES (NEW.id, 'free');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

</details>

**For Full Recurring Schedules Support:**

See [`docs/DATABASE_MIGRATION.md`](docs/DATABASE_MIGRATION.md) for the complete migration that adds:
- Recurring schedule fields (`is_recurring`, `recurrence_pattern`, `recurrence_config`)
- Execution tracking (`execution_count`, `last_executed_at`, `next_execution_at`)
- File attachment support (`builder_state`, `files`)
- Performance indexes

### 4. Supabase Edge Functions

**Option A: Use the New Edge Function (Recommended)**

The project includes a complete Edge Function at [`supabase/functions/execute-schedules/index.ts`](supabase/functions/execute-schedules/index.ts) that supports:
- One-time and recurring schedules
- Automatic next execution calculation
- Execution count tracking
- Max executions limit

Deploy it using Supabase CLI:

```bash
# Install Supabase CLI
npm install -g supabase

# Login and link project
supabase login
supabase link --project-ref your-project-ref

# Deploy the function
supabase functions deploy execute-schedules
```

**Option B: Basic Edge Function (One-Time Only)**

<details>
<summary>Click to expand basic Edge Function code</summary>

Create an Edge Function for sending webhooks:

1. In Supabase Dashboard, go to Edge Functions
2. Create a new function called `send-webhook`
3. Use this code:

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Check for schedules due to send
  const now = new Date().toISOString()
  const { data: schedules, error } = await supabase
    .from('schedules')
    .select('*')
    .eq('is_active', true)
    .lte('schedule_time', now)

  if (error) {
    console.error('Error fetching schedules:', error)
    return new Response('Error', { status: 500 })
  }

  for (const schedule of schedules || []) {
    try {
      // Send webhook
      const response = await fetch(schedule.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(schedule.message_data)
      })

      if (response.ok) {
        // Mark as sent
        await supabase
          .from('schedules')
          .update({ is_active: false })
          .eq('id', schedule.id)
      } else {
        console.error(`Failed to send webhook for schedule ${schedule.id}:`, response.status)
      }
    } catch (error) {
      console.error(`Error sending webhook for schedule ${schedule.id}:`, error)
    }
  }

  return new Response('OK')
})
```

</details>

### 5. Supabase Cron

Set up a cron job in Supabase Dashboard > Cron to run the `send-webhook` function every minute:

- Name: `execute-scheduled-webhooks`
- Schedule: `* * * * *` (every minute)
- Command: Select your `execute-schedules` Edge Function
- HTTP Method: POST
- No payload needed

## 📖 Documentation

Comprehensive documentation is available in the [`docs/`](docs/) folder:

- **[Quick Start Guide](docs/QUICK_START.md)** - Get started in minutes
- **[System Architecture](docs/SCHEDULE_SYSTEM_ARCHITECTURE.md)** - Complete system design
- **[Database Migration](docs/DATABASE_MIGRATION.md)** - SQL migration for recurring schedules
- **[Implementation Guide](docs/IMPLEMENTATION_GUIDE.md)** - Code examples and patterns
- **[Testing & Deployment](docs/TESTING_AND_DEPLOYMENT.md)** - QA and production deployment

## 🔄 Recurring Schedules

### Supported Patterns

| Pattern | Description | Example |
|---------|-------------|---------|
| **One-Time** | Execute once at specified time | Tomorrow at 3 PM |
| **Daily** | Every day at specified time | Every day at 9 AM |
| **Weekly** | Specific days of week | Mon, Wed, Fri at 2 PM |
| **Monthly** | Specific day of month | 15th of each month at noon |
| **Custom** | Full cron expression | `0 9 * * 1-5` (weekdays at 9 AM) |

### Natural Language Examples

```
"every Monday at 9 AM"           → Weekly on Mondays at 09:00
"daily at 2:30 PM"               → Daily at 14:30
"every weekday at 8 AM"          → Mon-Fri at 08:00
"monthly on the 1st at noon"     → 1st of each month at 12:00
"every 6 hours"                  → Custom cron: 0 */6 * * *
```

### Usage

1. **Login** with Discord
2. **Create a webhook** with your message content
3. **Toggle "Recurring Schedule"** checkbox
4. **Choose pattern** or use natural language input
5. **Set start time** and optional max executions
6. **Create schedule** - it will execute automatically!

## 🚀 Quick Start

### For Immediate Fix (Existing Users)

If you're experiencing "Failed to save schedule" errors:

1. Run the database migration from [`docs/DATABASE_MIGRATION.md`](docs/DATABASE_MIGRATION.md)
2. Deploy the Edge Function from [`supabase/functions/execute-schedules/`](supabase/functions/execute-schedules/)
3. Configure the cron job (see step 5 above)

The updated code uses the proper service layer and will work immediately.

### For New Implementations

Follow the [Quick Start Guide](docs/QUICK_START.md) for a complete step-by-step implementation (8-11 hours total).

## Development

```bash
npm run dev
```

## Deployment

### Vercel Deployment

1. Push your code to GitHub
2. Connect your GitHub repo to Vercel
3. Set environment variables in Vercel dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SITE_URL` (e.g. `https://your-domain.com`)
4. Deploy

### Supabase Cron Setup

In Supabase Dashboard > Cron, create a new cron job:
- Name: `send-scheduled-webhooks`
- Schedule: `* * * * *` (every minute)
- HTTP Method: POST
- URL: `https://your-supabase-url.supabase.co/functions/v1/execute-schedules`
- No headers or body needed

## 🧪 Testing

### One-Time Schedule
1. Login with Discord
2. Create a webhook with message content
3. Set a schedule time 2-3 minutes in the future
4. Click "Create Schedule"
5. Wait for execution
6. Verify webhook was sent to Discord
7. Check schedule is marked as "Completed"

### Recurring Schedule
1. Create a webhook
2. Toggle "Recurring Schedule"
3. Select "Daily" and set time
4. Create schedule
5. Wait for first execution
6. Verify webhook sent
7. Check schedule remains "Active"
8. Verify `next_execution_at` is updated to tomorrow

See [Testing & Deployment Guide](docs/TESTING_AND_DEPLOYMENT.md) for comprehensive test cases.

## 🛠️ Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Edge Functions, Storage, Auth)
- **Scheduling**: pg_cron (runs every minute)
- **Authentication**: Discord OAuth via Supabase Auth

## 📝 Project Structure

```
Discord-Lab/
├── app/                          # Next.js app directory
├── components/                   # React components
│   ├── RecurrenceSelector.tsx   # Recurring schedule UI
│   ├── ScheduleForm.tsx         # Schedule creation form
│   └── webhook/
│       └── ScheduleManager.tsx  # Advanced schedule manager
├── lib/                         # Utilities and services
│   ├── types/
│   │   └── schedule.ts         # TypeScript types
│   ├── cronParser.ts           # Natural language parser
│   ├── scheduleService.ts      # Schedule CRUD operations
│   └── webhookSerializer.ts    # Webhook data serialization
├── supabase/
│   └── functions/
│       └── execute-schedules/  # Edge Function for execution
└── docs/                        # Comprehensive documentation
    ├── QUICK_START.md
    ├── SCHEDULE_SYSTEM_ARCHITECTURE.md
    ├── DATABASE_MIGRATION.md
    ├── IMPLEMENTATION_GUIDE.md
    └── TESTING_AND_DEPLOYMENT.md
```

## 🤝 Contributing

Contributions are welcome! Please read the documentation in [`docs/`](docs/) to understand the system architecture.

## 📄 License

MIT License - feel free to use this project for your own purposes.

## 🆘 Troubleshooting

### "Failed to save schedule" Error
- **Cause**: Database schema mismatch
- **Solution**: Run the migration from [`docs/DATABASE_MIGRATION.md`](docs/DATABASE_MIGRATION.md)

### Schedules Not Executing
- **Cause**: Edge Function not deployed or cron not configured
- **Solution**: Deploy Edge Function and configure cron job (see steps 4-5 above)

### Wrong Execution Time
- **Cause**: Timezone mismatch
- **Solution**: Times are stored in UTC, displayed in local timezone. Verify your browser timezone.

For more troubleshooting, see [Testing & Deployment Guide](docs/TESTING_AND_DEPLOYMENT.md#monitoring--troubleshooting).

## 🎯 Roadmap

- [ ] Schedule templates
- [ ] Bulk schedule operations
- [ ] Email notifications for failures
- [ ] Schedule execution history viewer
- [ ] Advanced cron expression builder UI
- [ ] Schedule sharing between users
- [ ] Webhook response logging

---

**Need help?** Check the [documentation](docs/) or open an issue!
