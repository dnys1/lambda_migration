import { CfnOutput, RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda-nodejs";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as iam from "aws-cdk-lib/aws-iam";

export class LambdaMigrationStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const oldUserPool = new cognito.UserPool(this, "OldUserPool", {
      userPoolName: "lambdaMigration_old",
      removalPolicy: RemovalPolicy.DESTROY,
      selfSignUpEnabled: true,
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      autoVerify: {
        email: true,
      },
      // Only allow email sign-in
      signInAliases: {
        username: false,
        email: true,
      },
      standardAttributes: {
        email: {
          mutable: true,
          required: true,
        },
      },
      mfa: cognito.Mfa.OFF,
    });

    const oldAppClient = oldUserPool.addClient("OldUserPoolClient", {
      authFlows: {
        userSrp: true,
      },
      disableOAuth: true,
    });

    const userMigrationHandler = new lambda.NodejsFunction(
      this,
      "user-migration",
      {
        environment: {
          OLD_USER_POOL_ID: oldUserPool.userPoolId,
        }
      }
    );

    const postConfirmationHandler = new lambda.NodejsFunction(
      this,
      "post-confirmation",
      {
        environment: {
          OLD_USER_POOL_ID: oldUserPool.userPoolId,
        }
      }
    );

    const newUserPool = new cognito.UserPool(this, "NewUserPool", {
      userPoolName: "lambdaMigration_new",
      removalPolicy: RemovalPolicy.DESTROY,
      selfSignUpEnabled: true,
      accountRecovery: cognito.AccountRecovery.PHONE_WITHOUT_MFA_AND_EMAIL,
      autoVerify: {
        email: true,
        phone: true,
      },
      signInAliases: {
        email: true,
        phone: true,
      },
      enableSmsRole: true,
      standardAttributes: {
        email: {
          mutable: true,
          required: true,
        },
        phoneNumber: {
          mutable: true,
          required: false,
        },
      },
      // Recommended settings for updating attributes.
      keepOriginal: {
        email: true,
        phone: true,
      },
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: {
        sms: true,
        otp: false,
      },
      lambdaTriggers: {
        userMigration: userMigrationHandler,
        postConfirmation: postConfirmationHandler,
      },
    });

    const newAppClient = newUserPool.addClient("NewUserPoolClient", {
      authFlows: {
        userSrp: true,
      },
      disableOAuth: true,
    });

    // Grant user pool permissions to lambdas using `attachInlinePolicy`.
    // This is a workaround to avoid creating a circular reference between the
    // user pool and lambdas:
    // https://github.com/aws/aws-cdk/issues/7016#issuecomment-618325287
    const createUserPoolPolicy = (name: string, ...actions: string[]) =>
      new iam.Policy(this, name, {
        statements: [
          new iam.PolicyStatement({
            actions: actions,
            resources: [newUserPool.userPoolArn, oldUserPool.userPoolArn],
          }),
        ],
      });
    userMigrationHandler.role!.attachInlinePolicy(
      createUserPoolPolicy("UserMigrationPolicy", "cognito-idp:AdminGetUser")
    );
    postConfirmationHandler.role!.attachInlinePolicy(
      createUserPoolPolicy(
        "PostConfirmationPolicy",
        "cognito-idp:AdminSetUserMFAPreference"
      )
    );

    new CfnOutput(this, "OldUserPoolId", {
      value: oldUserPool.userPoolId,
    });

    new CfnOutput(this, "OldAppClientId", {
      value: oldAppClient.userPoolClientId,
    });

    new CfnOutput(this, "NewUserPoolId", {
      value: newUserPool.userPoolId,
    });

    new CfnOutput(this, "NewAppClientId", {
      value: newAppClient.userPoolClientId,
    });
  }
}
