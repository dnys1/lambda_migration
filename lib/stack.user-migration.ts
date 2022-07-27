import * as lambda from "aws-lambda";
import * as cognito from "@aws-sdk/client-cognito-identity-provider";

// Adapted from:
// - https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-migrate-user.html
// - https://aws.amazon.com/blogs/mobile/migrating-users-to-amazon-cognito-user-pools/

const OLD_USER_POOL_ID = process.env["OLD_USER_POOL_ID"]!;
const REGION = process.env["REGION"]!;
const CLIENT = new cognito.CognitoIdentityProviderClient({ region: REGION });

const lookupUser = async (params: {
  userName: string;
  userPoolId: string;
}): Promise<cognito.AdminGetUserResponse | null> => {
  const { userName, userPoolId } = params;
  try {
    const resp = await CLIENT.send(
      new cognito.AdminGetUserCommand({
        Username: userName,
        UserPoolId: userPoolId,
      })
    );
    console.log(
      `Found user for "${userName}" in user pool "${userPoolId}":` +
        `${JSON.stringify(resp)}`
    );
    return resp;
  } catch (err) {
    console.warn(
      `Error looking up user "${userName}" in user pool "${userPoolId}": ${err}`
    );
    return null;
  }
};

export const handler: lambda.UserMigrationTriggerHandler = async (
  event: lambda.UserMigrationTriggerEvent,
  context: lambda.Context
): Promise<lambda.UserMigrationTriggerEvent> => {
  console.log(`Event: ${JSON.stringify(event)}`);
  console.log(`Context: ${JSON.stringify(context)}`);

  const { userName, userPoolId } = event;

  // Check if a user already exists with that username in current user pool.
  const existingUser = await lookupUser({
    userName,
    userPoolId,
  });
  if (existingUser) {
    throw new Error("User already exists");
  }

  // Lookup the user in the old user pool.
  const user = await lookupUser({
    userName,
    userPoolId: OLD_USER_POOL_ID,
  });
  if (!user) {
    throw new Error("User not found");
  }
  let emailVerified = false;
  for (const userAttribute of user.UserAttributes ?? []) {
    if (userAttribute.Name === 'email_verified' && userAttribute.Value === 'true') {
      emailVerified = true;
    }
  }
  if (!emailVerified) {
    throw new Error("Cannot migrate user with unverified email");
  }

  event.response.messageAction = "SUPPRESS";
  event.response.finalUserStatus = "CONFIRMED";
  event.response.userAttributes = {
    email: userName,
    email_verified: "true",
  };

  console.log(`Responding with: ${JSON.stringify(event.response)}`);

  return event;
};
