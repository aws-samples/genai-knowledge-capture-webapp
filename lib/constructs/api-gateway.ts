import { CfnOutput, Stack } from "aws-cdk-lib";
import { Construct } from "constructs";
import {
  AuthorizationType,
  CorsOptions,
  LambdaIntegration,
  LogGroupLogDestination,
  MethodLoggingLevel,
  AccessLogFormat,
  Deployment,
  RestApi,
  Stage,
  Method,
  Cors,
} from "aws-cdk-lib/aws-apigateway";
import { IFunction } from "aws-cdk-lib/aws-lambda";
import { LogGroup } from "aws-cdk-lib/aws-logs";
import { CfnWebACL, CfnWebACLAssociation } from "aws-cdk-lib/aws-wafv2";
import { ParameterTier, StringParameter } from "aws-cdk-lib/aws-ssm";
import { NagSuppressions } from "cdk-nag";

interface ApiGatewayProps {
  getCredentialsLambdaFunction: IFunction;
  summarizeNGenerateFunction: IFunction;
}

export class ApiGateway extends Construct {
  public readonly apiUrl: string;
  public readonly apiKeyParameterName: string;

  constructor(scope: Construct, id: string, props: ApiGatewayProps) {
    super(scope, id);

    // Create the REST API
    const restApi = this.createRestApi();

    // Create the WebACL
    const restApiACL = this.createWebACL();

    // Create the API's deployment and stage
    const devStage = this.createDeploymentAndStage(restApi);

    // Associate the WebACL with the API stage
    this.associateWebACLWithDevStage(devStage, restApiACL);

    // Create the API's "get-credentials" resource and method
    const getCredentialsMethod = this.createResourceAndMethod(
      restApi,
      "get-credentials",
      "GET",
      props.getCredentialsLambdaFunction
    );

    // Create the API's "summarize-and-generate" resource and method
    const summarizeAndGenerateMethod = this.createResourceAndMethod(
      restApi,
      "summarize-and-generate",
      "POST",
      props.summarizeNGenerateFunction
    );

    // Store the API key in Parameter Store and associate it with the stage
    const { apiKeyParameter, apiKey } =
      this.createApiKeyInParameterStore(devStage);

    // Create an usage plan and associate it with the API key and stage
    this.createUsagePlanAndAssociateWithApiKeyAndStage(
      restApi,
      devStage,
      apiKey,
      getCredentialsMethod,
      summarizeAndGenerateMethod
    );

    this.apiUrl = restApi.url;
    this.apiKeyParameterName = apiKeyParameter.parameterName;

    // Create CloudFormation outputs for the API
    this.createOutputs();
  }

  private createRestApi(): RestApi {
    const corsOptions: CorsOptions = {
      allowOrigins: ["*"],
      allowMethods: ["OPTIONS", "GET", "POST", "PUT", "DELETE"],
      allowHeaders: [
        "Content-Type",
        "X-Amz-Date",
        "Authorization",
        "X-Api-Key",
        "X-Amz-Security-Token",
        "X-Amz-User-Agent",
      ],
    };

    const restApi = new RestApi(this, "TranscribeApi", {
      restApiName: "Transcribe Service",
      description: "This service provides Transcribe capabilities.",
      cloudWatchRole: true,
      deploy: false,
      defaultCorsPreflightOptions: corsOptions,
      defaultMethodOptions: { authorizationType: AuthorizationType.NONE },
    });
    NagSuppressions.addResourceSuppressions(
      restApi,
      [
        {
          id: "AwsSolutions-APIG2",
          reason: "Request validation implemented within AWS Lambda code",
        },
        {
          id: "AwsSolutions-APIG4",
          reason: "API Key enforced for authorization",
        },
        {
          id: "AwsSolutions-COG4",
          reason: "Cognito pool not required as it is a demo application",
        },
        {
          id: "AwsSolutions-IAM4",
          reason: "Managed policy implemented by RestApi construct",
        },
      ],
      true
    );

    return restApi;
  }

  private createWebACL(): CfnWebACL {
    return new CfnWebACL(this, "APIAcl", {
      defaultAction: {
        allow: {},
      },
      scope: "REGIONAL",
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: "MetricForWebACL",
        sampledRequestsEnabled: true,
      },
      name: "RestApiACL",
      rules: [
        {
          name: "CRSRule",
          priority: 0,
          statement: {
            managedRuleGroupStatement: {
              name: "AWSManagedRulesCommonRuleSet",
              vendorName: "AWS",
              ruleActionOverrides: [
                // Allow API payload greater than 8K
                {
                  actionToUse: {
                    allow: {},
                  },
                  name: "SizeRestrictions_BODY",
                },
              ],
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: "MetricForWebACLCDK-CRS",
            sampledRequestsEnabled: true,
          },
          overrideAction: {
            none: {},
          },
        },
      ],
    });
  }

  private createDeploymentAndStage(restApi: RestApi): Stage {
    const devLogGroup = new LogGroup(this, "DevLogs");
    const deployment = new Deployment(this, "Deployment", { api: restApi });
    const devStage = new Stage(this, "dev", {
      deployment,
      stageName: "dev",
      accessLogDestination: new LogGroupLogDestination(devLogGroup),
      accessLogFormat: AccessLogFormat.jsonWithStandardFields(),
      loggingLevel: MethodLoggingLevel.INFO,
      dataTraceEnabled: true,
    });
    restApi.deploymentStage = devStage;

    return devStage;
  }

  private associateWebACLWithDevStage(
    devStage: Stage,
    restApiACL: CfnWebACL
  ): void {
    new CfnWebACLAssociation(this, "DevStageApiACLAssociation", {
      resourceArn: devStage.stageArn,
      webAclArn: restApiACL.attrArn,
    });
  }

  private createResourceAndMethod(
    restApi: RestApi,
    resourceName: string,
    methodType: string,
    lambdaFunction: IFunction
  ): Method {
    const integration = new LambdaIntegration(lambdaFunction);
    const resource = restApi.root.addResource(resourceName, {
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
        allowHeaders: Cors.DEFAULT_HEADERS,
        allowMethods: Cors.ALL_METHODS,
      }
    });
    const method = resource.addMethod(methodType, integration, {
      apiKeyRequired: true,
    });
    NagSuppressions.addResourceSuppressions(
      resource,
      [
        {
          id: "AwsSolutions-APIG4",
          reason: "API Key enforced for authorization",
        },
        {
          id: "AwsSolutions-COG4",
          reason: "Cognito pool not required as it is a demo application",
        },
      ],
      true
    );

    return method;
  }

  private createApiKeyInParameterStore(devStage: Stage): {
    apiKeyParameter: StringParameter;
    apiKey: any;
  } {
    const apiKeyParameter = new StringParameter(this, "ApiKeyParameter", {
      parameterName: "transcribe-api-key",
      stringValue: Stack.of(this).node.addr,
      description: "The API key for the Transcribe application",
      tier: ParameterTier.STANDARD,
    });

    const apiKey = devStage.addApiKey("ApiKey", {
      value: apiKeyParameter.stringValue,
    });

    return { apiKeyParameter, apiKey };
  }

  private createUsagePlanAndAssociateWithApiKeyAndStage(
    restApi: RestApi,
    devStage: Stage,
    apiKey: any,
    getCredentialsMethod: Method,
    summarizeAndGenerateMethod: Method
  ): void {
    const usagePlan = restApi.addUsagePlan("UsagePlan", {
      name: "Easy",
      throttle: {
        rateLimit: 100,
        burstLimit: 200,
      },
    });

    usagePlan.addApiKey(apiKey);
    usagePlan.addApiStage({
      stage: restApi.deploymentStage,
      throttle: [
        {
          method: getCredentialsMethod,
          throttle: {
            rateLimit: 100,
            burstLimit: 200,
          },
        },
        {
          method: summarizeAndGenerateMethod,
          throttle: {
            rateLimit: 100,
            burstLimit: 200,
          },
        },
      ],
    });
  }

  private createOutputs(): void {
    new CfnOutput(this, "ApiUrlOutput", {
      key: "ApiUrl",
      value: this.apiUrl,
      description: "The URL of the API Gateway endpoint",
    });

    new CfnOutput(this, "ApiKeyParameterOutput", {
      key: "ApiKeyParameterName",
      value: this.apiKeyParameterName,
      description: "The API Key parameter in Systems Manager Parameter Store",
    });
  }
}
