import { Construct } from "constructs";
import { Aws, Stack } from "aws-cdk-lib";
import { IBucket } from "aws-cdk-lib/aws-s3";
import {
  BucketDeployment,
  Source as S3Source,
} from "aws-cdk-lib/aws-s3-deployment";
import {
  BuildSpec,
  Source,
  LinuxBuildImage,
  Project,
  Artifacts,
} from "aws-cdk-lib/aws-codebuild";
import { PolicyStatement, Effect, Policy } from "aws-cdk-lib/aws-iam";
import { Rule } from "aws-cdk-lib/aws-events";
import { CodeBuildProject } from "aws-cdk-lib/aws-events-targets";
import { Key } from "aws-cdk-lib/aws-kms";

export interface ReactAppProps {
  readonly kmsKey: Key;
  readonly reactAppBucket: IBucket;
  readonly apiUrl: string;
  readonly apiKeyParameterName: string;
}

export class ReactAppBuild extends Construct {
  constructor(scope: Construct, id: string, props: ReactAppProps) {
    super(scope, id);

    // Define the environment variables to be passed into the React app
    const reactEnvironmentVariables: Record<string, string> = {
      VITE_API_URL: props.apiUrl,
      VITE_API_KEY: props.apiKeyParameterName, // CodeBuild will inject the value from Parameter Store
    };

    // Deploy the React source code to S3
    this.deployReactSourceCode(props.reactAppBucket);

    // Create the shell commands to create the React .env file during the build
    const commands = this.createEnvFileCommands(reactEnvironmentVariables);

    // Create a CodeBuild project to build the React application
    const codebuildProject = this.createCodeBuildProject(
      props.reactAppBucket,
      props.kmsKey,
      reactEnvironmentVariables,
      commands
    );

    // Grant the CodeBuild project permission to access S3 and SSM (for API key)
    this.grantCodeBuildAccess(codebuildProject, props);

    // Create an EventBridge rule to trigger CodeBuild on stack deployment
    this.createCodeBuildTriggerRule(codebuildProject, props.reactAppBucket);
  }

  private deployReactSourceCode(reactAppBucket: IBucket): void {
    new BucketDeployment(this, "DeployReactSourceCode", {
      destinationBucket: reactAppBucket,
      destinationKeyPrefix: "source",
      sources: [
        S3Source.asset("./lib/react-app", {
          exclude: ["dist", "node_modules", ".env.*"],
        }),
      ],
    }).node.addDependency(reactAppBucket);
  }

  private createEnvFileCommands(
    environmentVariables: Record<string, string>
  ): string[] {
    const commands = [];
    for (const [key, value] of Object.entries(environmentVariables)) {
      if (key === "VITE_API_KEY") {
        commands.push(
          `${key}=$(aws ssm get-parameter --name ${value} --query Parameter.Value --output text)`
        );
      }
      commands.push(`echo "${key}=$${key}" >> .env`);
    }
    return commands;
  }

  private createCodeBuildProject(
    reactAppBucket: IBucket,
    kmsKey: Key,
    environmentVariables: Record<string, string>,
    commands: string[]
  ): Project {
    const project = new Project(this, "ReactBuildProject", {
      projectName: "transcribe-react-build",
      encryptionKey: kmsKey,
      source: Source.s3({
        bucket: reactAppBucket,
        path: "source/",
      }),
      artifacts: Artifacts.s3({
        bucket: reactAppBucket,
        includeBuildId: false,
        packageZip: false,
        name: "dist",
        encryption: true,
      }),
      buildSpec: BuildSpec.fromObject({
        version: "0.2",
        env: {
          shell: "bash",
          variables: environmentVariables,
        },
        phases: {
          install: {
            "runtime-versions": {
              nodejs: 20,
            },
          },
          pre_build: {
            commands,
          },
          build: {
            commands: ["npm ci", "npm run build"],
          },
        },
        artifacts: {
          files: "**/*",
          "base-directory": "dist",
        },
      }),
      environment: {
        buildImage: LinuxBuildImage.STANDARD_6_0,
      },
    });
    project.node.addDependency(reactAppBucket);

    return project;
  }

  private grantCodeBuildAccess(
    codebuildProject: Project,
    props: ReactAppProps
  ): void {
    if (codebuildProject.role) {
      props.reactAppBucket.grantRead(codebuildProject.role);
      codebuildProject.addToRolePolicy(
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ["ssm:GetParameter"],
          resources: [
            `arn:aws:ssm:${Aws.REGION}:${Aws.ACCOUNT_ID}:parameter/${props.apiKeyParameterName}`,
          ],
        })
      );
    } else {
      console.error("CodeBuild project role is undefined");
    }
  }

  private createCodeBuildTriggerRule(
    codebuildProject: Project,
    reactAppBucket: IBucket
  ): void {
    const rule = new Rule(this, "ReactBuildTriggerRule", {
      ruleName: "transcribe-react-build-on-stack-create",
      eventPattern: {
        source: ["aws.cloudformation"],
        detailType: ["CloudFormation Stack Status Change"],
        detail: {
          "stack-id": [Stack.of(this).stackId],
          "status-details": {
            status: ["CREATE_COMPLETE", "UPDATE_COMPLETE"],
          },
        },
      },
      targets: [new CodeBuildProject(codebuildProject)],
      description: "Trigger CodeBuild Lambda when React source code is updated",
      enabled: true,
    });
    rule.node.addDependency(reactAppBucket);

    if (codebuildProject.role) {
      const policyStatement = new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["codebuild:StartBuild"],
        resources: [codebuildProject.projectArn],
      });
      codebuildProject.role.attachInlinePolicy(
        new Policy(this, "CodeBuildStartBuildPolicy", {
          statements: [policyStatement],
        })
      );
    }
  }
}
