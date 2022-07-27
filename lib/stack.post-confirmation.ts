import * as lambda from "aws-lambda";
import * as cognito from "@aws-sdk/client-cognito-identity-provider";

// Adapted from:
// - https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-post-confirmation.html

const REGION = process.env["REGION"];
const CLIENT = new cognito.CognitoIdentityProviderClient({ region: REGION });

const enableSmsMfa = async (params: {
  userPoolId: string;
  userName: string;
}): Promise<void> => {
  await CLIENT.send(
    new cognito.AdminSetUserMFAPreferenceCommand({
      Username: params.userName,
      UserPoolId: params.userPoolId,
      SMSMfaSettings: {
        Enabled: true,
        PreferredMfa: true,
      },
    })
  );
};

export const handler: lambda.PostConfirmationTriggerHandler = async (
  event: lambda.PostConfirmationTriggerEvent,
  context: lambda.Context
): Promise<lambda.PostConfirmationTriggerEvent> => {
  console.log(`Event: ${JSON.stringify(event)}`);
  console.log(`Context: ${JSON.stringify(context)}`);

  const {
    userName,
    userPoolId,
    request: { userAttributes },
  } = event;

  const phoneNumber = userAttributes["phone_number"];
  const phoneNumberVerified = userAttributes["phone_number_verified"];
  if (!phoneNumber || !phoneNumberVerified) {
    console.log(
      `No verified phone number for (phoneNumber: ${phoneNumber}, verified: ${phoneNumberVerified})`
    );
    return event;
  }

  // Enable SMS MFA for the user
  await enableSmsMfa({
    userPoolId: userPoolId,
    userName: userName,
  });

  console.log(`Successfully enabled MFA for user: ${userName}`);

  return event;
};
