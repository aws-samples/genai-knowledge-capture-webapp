import { Construct } from "constructs";
import { S3Buckets } from "./constructs/s3";
import { LambdaFunctions } from "./constructs/lambda";
import { ApiGateway } from "./constructs/api-gateway";
import { ReactAppBuild } from "./constructs/react-app-build";
import { ReactAppDeploy } from "./constructs/react-app-deploy";
import { AwsSolutionsChecks } from "cdk-nag";
import { Key } from "aws-cdk-lib/aws-kms";
import { Aspects, RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import { NagSuppressions } from "cdk-nag";

export class CdkReactAppStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Apply AwsSolutionsChecks
    Aspects.of(this).add(new AwsSolutionsChecks({ verbose: true }));

    // Create the KMS key
    const kmsKey = new Key(this, "SSEKmsKey", {
      alias: "transcribe-kms-key",
      description: "Customer-managed KMS key for SSE-KMS encryption",
      removalPolicy: RemovalPolicy.DESTROY,
      enableKeyRotation: true,
    });

    // Create the S3 buckets
    const s3Buckets = new S3Buckets(this, "S3Buckets");

    // Create the Lambda functions
    const lambdaFunctions = new LambdaFunctions(this, "LambdaFunctions", {
      documentBucket: s3Buckets.documentBucket,
    });

    // Create the API Gateway
    const api = new ApiGateway(this, "ApiGateway", {
      getCredentialsLambdaFunction:
        lambdaFunctions.getCredentialsLambdaFunction,
      summarizeNGenerateFunction: lambdaFunctions.summarizeNGenerateFunction,
    });

    // Create the React app build
    new ReactAppBuild(this, "ReactAppBuild", {
      kmsKey: kmsKey,
      reactAppBucket: s3Buckets.reactAppBucket,
      apiUrl: api.apiUrl,
      apiKeyParameterName: api.apiKeyParameterName,
    });

    // Create the React app hosting
    new ReactAppDeploy(this, "ReactAppDeploy", {
      kmsKey: kmsKey,
      reactAppBucket: s3Buckets.reactAppBucket,
    });

    NagSuppressions.addStackSuppressions(this, [
      {
        id: "AwsSolutions-IAM4",
        reason:
          "Suppressing L3 IAM policies since it is not managed by the application",
      },
      {
        id: "AwsSolutions-IAM5",
        reason:
          "Suppressing L3 IAM policies since it is not managed by the application",
      },
      {
        id: "AwsSolutions-L1",
        reason: "Lambda managed by L3 construct",
      },
    ]);
  }
}
