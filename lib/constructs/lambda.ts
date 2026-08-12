import * as path from "path";
import { Aws, Duration } from "aws-cdk-lib";
import { Construct } from "constructs";
import {
  Architecture,
  Code,
  DockerImageCode,
  DockerImageFunction,
  Function,
  Runtime,
} from "aws-cdk-lib/aws-lambda";
import {
  Effect,
  PolicyDocument,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from "aws-cdk-lib/aws-iam";
import {
  AwsCustomResource,
  AwsCustomResourcePolicy,
  PhysicalResourceId,
} from "aws-cdk-lib/custom-resources";
import { IBucket } from "aws-cdk-lib/aws-s3";
import { NagSuppressions } from "cdk-nag";

interface LambdaFunctionsProps {
  documentBucket: IBucket;
}

export class LambdaFunctions extends Construct {
  public readonly getCredentialsLambdaFunction: Function;
  public readonly orchestrationFunction: Function;

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

    // Create the Lambda execution role for the orchestration Lambda function
    const orchestrationLambdaExecutionRole =
      this.createOrchestrationLambdaExecutionRole(props.documentBucket);

    // Create the orchestration Lambda function
    this.orchestrationFunction =
      this.createOrchestrationLambdaFunction(
        orchestrationLambdaExecutionRole,
        props.documentBucket
      );

    // Warm the orchestration function once per deployment
    this.warmOrchestrationFunction(this.orchestrationFunction);
  }

  /**
   * The first invocation of a newly pushed container image has to fetch the image
   * layers, which has been observed to exceed API Gateway's 29s integration
   * timeout and surface in the UI as a failed request. Invoking the function once
   * at the end of each deployment absorbs that cost before any user request.
   */
  private warmOrchestrationFunction(orchestrationFunction: Function): void {
    const warmer = new AwsCustomResource(this, "OrchestrationWarmup", {
      onUpdate: {
        service: "Lambda",
        action: "invoke",
        parameters: {
          FunctionName: orchestrationFunction.functionName,
          InvocationType: "RequestResponse",
          Payload: JSON.stringify({ warmup: true }),
        },
        // A new physical id on every deployment ensures the warmup runs each time
        // a new image is deployed, not only on stack creation.
        physicalResourceId: PhysicalResourceId.of(Date.now().toString()),
      },
      policy: AwsCustomResourcePolicy.fromStatements([
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ["lambda:InvokeFunction"],
          resources: [orchestrationFunction.functionArn],
        }),
      ]),
      timeout: Duration.minutes(3),
      installLatestAwsSdk: false,
    });
    warmer.node.addDependency(orchestrationFunction);

    NagSuppressions.addResourceSuppressions(
      warmer,
      [
        {
          id: "AwsSolutions-IAM4",
          reason: "Managed policy applied by the AwsCustomResource provider",
        },
        {
          id: "AwsSolutions-IAM5",
          reason:
            "AwsCustomResource provider requires log permissions on a wildcard resource",
        },
        {
          id: "AwsSolutions-L1",
          reason: "Runtime managed by the AwsCustomResource L3 construct",
        },
      ],
      true
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
      runtime: Runtime.PYTHON_3_13,
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

  private createOrchestrationLambdaExecutionRole(
    documentBucket: IBucket
  ): Role {
    const role = new Role(this, "OrchestrationLambdaExecutionRole", {
      roleName: "transcribe-orchestration-lambda-role",
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
              actions: ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
              resources: [
                `arn:aws:bedrock:*::foundation-model/*`,
                `arn:aws:bedrock:*:${Aws.ACCOUNT_ID}:inference-profile/*`,
                `arn:aws:bedrock:us:${Aws.ACCOUNT_ID}:inference-profile/*`,
              ],
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

  private createOrchestrationLambdaFunction(
    orchestrationLambdaExecutionRole: Role,
    documentBucket: IBucket
  ): DockerImageFunction {
    const orchestrationFunction = new DockerImageFunction(this, "OrchestrationFunction", {
      functionName: "transcribe-orchestration-function",
      code: DockerImageCode.fromImageAsset(
        path.join(__dirname, "../lambda-functions/orchestration")
      ),
      role: orchestrationLambdaExecutionRole,
      architecture: Architecture.ARM_64,
      timeout: Duration.seconds(60),
      // Memory drives CPU allocation. Max memory used is ~250 MB, but the cold
      // start has to import langchain and weasyprint: at 1024 MB the init phase
      // exceeded Lambda's 10s init limit, so the imports were re-run inside the
      // first invocation (~22s) and API Gateway's 29s integration timeout fired.
      memorySize: 3008,
      environment: {
        S3_BUCKET_NAME: documentBucket.bucketName,
        POWERTOOLS_LOG_LEVEL: "DEBUG",
        POWERTOOLS_METRICS_NAMESPACE: "knowledge-capture-dev",
        POWERTOOLS_SERVICE_NAME: "knowledge-capture-dev",
        XDG_CACHE_HOME: "/tmp",   // Required for PDF font cache
      },
    });
    return orchestrationFunction;
  }
}
