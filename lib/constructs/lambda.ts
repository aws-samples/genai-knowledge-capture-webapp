import * as path from "path";
import { Aws, Duration } from "aws-cdk-lib";
import { Construct } from "constructs";
import {
  Code,
  Function,
  Runtime,
  DockerImageCode,
  DockerImageFunction,
  Architecture,
} from "aws-cdk-lib/aws-lambda";
import {
  Effect,
  PolicyDocument,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from "aws-cdk-lib/aws-iam";
import { IBucket } from "aws-cdk-lib/aws-s3";
import { NagSuppressions } from "cdk-nag";

interface LambdaFunctionsProps {
  documentBucket: IBucket;
}

export class LambdaFunctions extends Construct {
  public readonly getCredentialsLambdaFunction: Function;
  public readonly summarizeNGenerateFunction: Function;

  constructor(scope: Construct, id: string, props: LambdaFunctionsProps) {
    super(scope, id);

    // Create the Lambda execution role for the get-credentials Lambda function
    const getCredentialsLambdaExecutionRole =
      this.createGetCredentialsLambdaExecutionRole();

    // Create the Transcribe role for the credentials that will be
    // returned by the getCredentials Lambda function
    const transcribeRole = this.createTranscribeRole(
      getCredentialsLambdaExecutionRole
    );

    // Create the get-credentials lambda function
    this.getCredentialsLambdaFunction = this.createGetCredentialsLambdaFunction(
      getCredentialsLambdaExecutionRole,
      transcribeRole
    );

    // Create the Lambda execution role for the summarize-and-generate Lambda function
    const summarizeNGenerateLambdaExecutionRole =
      this.createSummarizeNGenerateLambdaExecutionRole(props.documentBucket);

    // Create the summarize-and-generate Lambda function
    this.summarizeNGenerateFunction =
      this.createSummarizeNGenerateLambdaFunction(
        summarizeNGenerateLambdaExecutionRole,
        props.documentBucket
      );
  }

  private createGetCredentialsLambdaExecutionRole(): Role {
    const role = new Role(this, "GetCredentialsLambdaExecutionRole", {
      roleName: "transcribe-get-credentials-lambda-role",
      assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
      inlinePolicies: {
        LambdaExecutionPolicy: new PolicyDocument({
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents",
              ],
              resources: ["arn:aws:logs:*:*:*"],
            }),
          ],
        }),
      },
    });
    NagSuppressions.addResourceSuppressions(role, [
      {
        id: "AwsSolutions-IAM5",
        reason: "Wild card resource used for creating log group and log stream",
      },
    ]);
    role.addToPolicy(
      new PolicyStatement({
        actions: ["sts:AssumeRole"],
        resources: [role.roleArn],
      })
    );

    return role;
  }

  private createTranscribeRole(getCredentialsLambdaExecutionRole: Role): Role {
    const role = new Role(this, "TranscribeRole", {
      roleName: "transcribe-credentials-role",
      assumedBy: getCredentialsLambdaExecutionRole.grantPrincipal,
      inlinePolicies: {
        TranscribePolicy: new PolicyDocument({
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: [
                "transcribe:StartStreamTranscription",
                "transcribe:StartStreamTranscriptionWebSocket",
                "transcribe:GetTranscriptionJob",
                "transcribe:ListTranscriptionJobs",
                "transcribe:GetTranscriptionResult",
              ],
              resources: ["*"],
            }),
          ],
        }),
      },
    });
    NagSuppressions.addResourceSuppressions(role, [
      {
        id: "AwsSolutions-IAM5",
        reason: "Wild card used for AWS Transcribe service",
      },
    ]);

    return role;
  }

  private createGetCredentialsLambdaFunction(
    getCredentialsLambdaExecutionRole: Role,
    transcribeRole: Role
  ): Function {
    return new Function(this, "GetCredentialsLambdaFunction", {
      functionName: "transcribe-get-credentials-function",
      runtime: Runtime.PYTHON_3_12,
      code: Code.fromAsset(
        path.join(__dirname, "../lambda-functions/get_credentials")
      ),
      handler: "lambda_handler.lambda_handler",
      role: getCredentialsLambdaExecutionRole,
      timeout: Duration.minutes(1),
      memorySize: 128,
      environment: {
        ROLE_ARN: transcribeRole.roleArn,
      },
    });
  }

  private createSummarizeNGenerateLambdaExecutionRole(
    documentBucket: IBucket
  ): Role {
    const role = new Role(this, "SummarizeNGenerateLambdaExecutionRole", {
      roleName: "transcribe-summarize-and-generate-lambda-role",
      assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
      inlinePolicies: {
        LambdaExecutionPolicy: new PolicyDocument({
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents",
              ],
              resources: ["arn:aws:logs:*:*:*"],
            }),
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: [
                "s3:GeneratePresignedUrl",
                "s3:GetObject",
                "s3:PutObject",
              ],
              resources: [
                documentBucket.bucketArn,
                `${documentBucket.bucketArn}/*`,
              ],
            }),
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ["bedrock:*"],
              resources: [`arn:aws:bedrock:${Aws.REGION}::foundation-model/*`],
            }),
          ],
        }),
      },
    });
    NagSuppressions.addResourceSuppressions(role, [
      {
        id: "AwsSolutions-IAM5",
        reason:
          "Wild card resources used for creating log group and log stream and S3 bucket path.",
      },
    ]);

    return role;
  }

  private createSummarizeNGenerateLambdaFunction(
    summarizeNGenerateLambdaExecutionRole: Role,
    documentBucket: IBucket
  ): DockerImageFunction {
    return new DockerImageFunction(this, "SummarizeNGenerateFunction", {
      functionName: "transcribe-summarize-and-generate-function",
      code: DockerImageCode.fromImageAsset(
        path.join(__dirname, "../lambda-functions/summarize_and_generate")
      ),
      role: summarizeNGenerateLambdaExecutionRole,
      architecture: Architecture.ARM_64,
      timeout: Duration.minutes(5),
      memorySize: 1024,
      environment: {
        S3_BUCKET_NAME: documentBucket.bucketName,
        POWERTOOLS_LOG_LEVEL: "DEBUG",
        POWERTOOLS_METRICS_NAMESPACE: "knowledge-capture-dev",
        POWERTOOLS_SERVICE_NAME: "knowledge-capture-dev",
      },
    });
  }
}
