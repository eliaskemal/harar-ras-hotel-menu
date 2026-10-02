# Free Render Storage Setup

The Render free service has ephemeral local storage, so production menu data and uploaded images use Supabase. Local development continues to use `data/db.json` and `data/uploads/`.

## Supabase

1. Create a Supabase project on its free plan.
2. Open **SQL Editor**, paste the contents of `supabase/schema.sql`, and run it.
3. Open **Storage**, create a bucket named `menu-images`, and mark it **Public** so menu images can be displayed without signing in.
4. In **Project Settings → API Keys**, copy the Project URL and the server-side `service_role`/secret key. Never use the `anon`/publishable key for the service-role variable, and never put the secret key in frontend code.

## Render

On the web service, open **Environment** and add:

| Key                         | Value                           |
| --------------------------- | ------------------------------- |
| `SUPABASE_URL`              | The Supabase Project URL        |
| `SUPABASE_SERVICE_ROLE_KEY` | The server-side secret key      |
| `SUPABASE_STORAGE_BUCKET`   | `menu-images`                   |
| `NODE_ENV`                  | `production`                    |
| `HARAR_ADMIN_PASSWORD`      | A strong, unique admin password |

Save the variables and deploy the latest commit. Leave the service on the Free compute plan and do not attach a disk. The app imports `data/db.json` and migrates any referenced local upload images into Supabase on its first start if the `menu_state` table is empty; later starts load the Supabase copy. The Free service can sleep when idle, so its first request afterward may take longer. Supabase free-plan quotas and availability limits apply.
