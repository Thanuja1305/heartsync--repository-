# HeartSync Firestore Security Specification

## Data Invariants
1. **User Integrity**: A user profile (`users/{userId}`) can only be created by the authenticated user with matching UID.
2. **Role Immutability**: Once a role is set, it cannot be changed by the user (Tier 2 access).
3. **Clinical Isolation**: Patients can only read their own `patients/{userId}` record and their own health data.
4. **Professional Access**: Doctors can read patient records if they are assigned (relational check) or if it's an emergency alert they are authorized to manage.
5. **System Immutability**: `createdAt` timestamps cannot be modified after creation.

## The Dirty Dozen (Attack Vectors to Block)
1. **Identity Spoofing**: Attempt to create a profile with another user's UID.
2. **Role Escalation**: Attempt to update `role` from 'patient' to 'doctor'.
3. **Shadow Field Injection**: Attempt to add `admin: true` to a user profile.
4. **Data Scraping**: Attempt to list all users as a signed-in patient.
5. **Timestamp Poisoning**: Attempt to set a back-dated `createdAt` field.
6. **Relational Bypass**: Patient attempting to read `doctors/{someDocId}` data.
7. **Resource Exhaustion**: Sending 1MB string to a short name field.
8. **ID Poisoning**: Creating a document with a junk-character 1024-byte ID.
9. **Status Short-circuit**: Doctor attempting to set `verified: true` on their own profile.
10. **Emergency Snooping**: Patient attempting to read `emergencyAlerts` for other patients.
11. **Account Takeover via Metadata**: Attempting to update `email` in Firestore to a different one than Auth record.
12. **PII Leakage**: Unauthorized access to private health metrics via blanket reads.

## Conflict Evaluation Report

| Collection | Identity Spoofing | State Shortcutting | Resource Poisoning | PII Protection |
|------------|-------------------|--------------------|--------------------|----------------|
| users | BLOCKED | BLOCKED | BLOCKED | FULL |
| patients | BLOCKED | BLOCKED | BLOCKED | FULL |
| doctors | BLOCKED | BLOCKED | BLOCKED | CRITICAL |
| emergencyAlerts | BLOCKED | BLOCKED | BLOCKED | SECURE |
