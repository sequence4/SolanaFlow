# Database Hardening

## Waitlist Writer Role

The `waitlist_writer` role has been created with least-privilege access:
- LOGIN permission
- CONNECTION LIMIT of 15
- Only INSERT permissions on the waitlist table
- USAGE on the public schema

## Wallet Address Constraint

A CHECK constraint has been added to the waitlist table to validate wallet addresses:
- Ensures wallet_address is either NULL or matches the Solana address format
- Pattern: `^[1-9A-HJ-NP-Za-km-z]{32,44}$`

## Rotating Password

To rotate the `waitlist_writer` password:

1. Connect as the database master user:
   ```
   psql "postgres://dbmasteruser@<RDS-ENDPOINT>:5432/solanaflow"
   ```

2. Execute the ALTER ROLE command:
   ```sql
   ALTER ROLE waitlist_writer PASSWORD '<NEW-STRONG-32CHAR-PW>';
   ```

3. Update the `DATABASE_URL` in `.env.production`:
   ```
   DATABASE_URL=postgres://waitlist_writer:<NEW-STRONG-32CHAR-PW>@<RDS-ENDPOINT>:5432/solanaflow
   ```

4. Restart the application.

## Recovery Procedure

If access via the `waitlist_writer` role is lost:

1. Connect as the database master user.
2. Verify the role exists:
   ```sql
   SELECT * FROM pg_roles WHERE rolname = 'waitlist_writer';
   ```
3. Reset the password using the ALTER ROLE command above.
4. If the role needs to be recreated, execute the script in `landing/ops/sql/hardening/waitlist_writer.sql`.

## Automated dependency security

| Tool            | Frequency | Location                          |
|-----------------|-----------|-----------------------------------|
| Dependabot PRs  | Weekly    | .github/dependabot.yml            |
| pnpm audit      | Each CI   | landing-ci.yml > security-audit   |
| gitleaks        | Each CI   | landing-ci.yml > gitleaks scan    | 