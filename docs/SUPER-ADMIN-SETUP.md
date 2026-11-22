# Super Admin account setup

BUILDWITHELI MEDIA uses Supabase Auth. Every new account is created with the `CREATOR` role and a `PENDING` creator approval status. A user cannot publish until a Super Admin approves the account.

## Bootstrap the first Super Admin

1. Register on the public website using the email address that should own the platform.
2. Open the verification email and confirm the address.
3. In Supabase Dashboard, open **SQL Editor** for the Nova project.
4. Replace the email placeholder below with the exact email used to register, then run the statement.

```sql
update public.bwm_profiles p
set role = 'OWNER',
    approval_status = 'APPROVED',
    status = 'ACTIVE',
    updated_at = now()
from auth.users u
where u.id = p.id
  and lower(u.email) = lower('YOUR_OWNER_EMAIL@example.com')
  and u.email_confirmed_at is not null;
```

5. Sign out of BUILDWITHELI MEDIA and sign back in. The **Super Admin** navigation item will appear.

The first owner role must be assigned from the Supabase SQL Editor by a project administrator. It cannot be self-assigned through the public website. Never expose a Supabase service-role/secret key in frontend code or GitHub.

## Operational rules

- Email verification is required before the account appears in the creator approval queue.
- Super Admin approves or rejects creator applications.
- Only approved, active creators can submit content.
- Every submitted story remains pending until editorial approval.
- Only published stories appear in public discovery.
- Payments and subscriptions remain disabled during free early access.
