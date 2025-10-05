import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function createBucket() {
  try {
    console.log('Creating webhook-files bucket...')
    const { data, error } = await supabase.storage.createBucket('webhook-files', {
      public: false,
      allowedMimeTypes: ['*/*'],
      fileSizeLimit: 25 * 1024 * 1024, // 25MB
    })

    if (error) {
      if (error.message.includes('already exists')) {
        console.log('Bucket already exists')
      } else {
        throw error
      }
    } else {
      console.log('Bucket created successfully:', data)
    }

    console.log('Note: You may need to set up RLS policies manually in the Supabase dashboard or via SQL migration')

  } catch (error) {
    console.error('Error creating bucket:', error)
    process.exit(1)
  }
}

createBucket()