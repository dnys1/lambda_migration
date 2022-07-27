# Lambda Migration

Configures two user pools to allow the following migration flow: A user signs up with email in the old user pool. They can continue to log into the new user pool with their email, and the migration happens automatically. New users must sign up with their phone number in the new user pool.

1. User Pool 1 (`OldUserPool`):

    **Username:** Email
    **Required Attributes**: Email
    **MFA:** Off

2. User Pool 2 (`NewUserPool`):
   
   **Username:** Email or Phone Number
   **Required Attributes**: Email
   **MFA:** Optional (SMS)

To migrate a user, initiate a forgot password flow in the new user pool with the user's email address. The user migration lambda will look up the user in the old user pool and migrate their information to the new user pool - the user will continue to log in with their email.

To sign up a new user, initiate a normal sign-in with the user's phone number. The sign up API will allow users to sign up with email, but this can be prevented either on the frontend or in a pre-signup trigger.
