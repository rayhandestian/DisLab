# DisLab - Discord Tools

A modern web application for scheduling and sending Discord webhooks with user authentication.

## Setup Instructions

### 1. Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Authentication > Providers and enable Discord
3. Add your Discord application credentials:
   - Create a Discord app at [discord.com/developers](https://discord.com/developers)
   - Copy Client ID and Client Secret to Supabase
   - Set redirect URI to: `https://your-domain.com/auth/callback`
4. In Supabase **Authentication → URL Configuration**:
   - Set **Site URL** to `https://your-domain.com`
   - Add `https://your-domain.com/auth/callback` (and any preview URLs you use) to **Additional Redirect URLs**
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

Run the following SQL in Supabase SQL Editor:

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

### 4. Supabase Edge Functions

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

### 5. Supabase Cron

Set up a cron job in Supabase Dashboard > Cron to run the `send-webhook` function every minute:

- Name: `send-scheduled-webhooks`
- Schedule: `* * * * *` (every minute)
- Command: Select your `send-webhook` Edge Function
- HTTP Method: POST
- No payload needed

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
- URL: `https://your-supabase-url.supabase.co/functions/v1/send-webhook`
- No headers or body needed

## Testing

1. Login with Discord
2. Create a schedule
3. Wait for the scheduled time or manually trigger the cron
4. Check if webhook was sent
