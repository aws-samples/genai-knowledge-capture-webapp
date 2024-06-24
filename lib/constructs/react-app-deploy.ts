import { Construct } from "constructs";
import { Aws, CfnOutput, Duration } from "aws-cdk-lib";
import { IBucket } from "aws-cdk-lib/aws-s3";
import {
  CloudFrontWebDistribution,
  GeoRestriction,
  CfnOriginAccessControl,
  CfnDistribution,
} from "aws-cdk-lib/aws-cloudfront";
import { PolicyStatement, Effect, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { CfnWebACL } from "aws-cdk-lib/aws-wafv2";
import { Key } from "aws-cdk-lib/aws-kms";
import { NagSuppressions } from "cdk-nag";

export interface ReactAppProps {
  readonly kmsKey: Key;
  readonly reactAppBucket: IBucket;
}

export class ReactAppDeploy extends Construct {
  constructor(scope: Construct, id: string, props: ReactAppProps) {
    super(scope, id);

    // Create the CloudFront web application firewall (WAF)
    const cloudfrontACL = this.createCloudFrontWaf();

    // Create the CloudFront distribution
    const cloudFrontDistribution = this.createCloudFrontDistribution(
      props.reactAppBucket,
      cloudfrontACL
    );

    // Add the CloudFront Origin Access Control (OAC)
    this.addCloudFrontOriginAccessControl(cloudFrontDistribution);

    // Update the KMS key policy to allow use by CloudFront distribution
    this.updateKmsKeyPolicy(props.kmsKey, cloudFrontDistribution);

    // Update the S3 bucket policy to allow access to CloudFront distribution
    this.updateS3BucketPolicy(props.reactAppBucket, cloudFrontDistribution);

    // Create the CloudFormation output for the CloudFront URL
    this.createCloudFrontDistributionOutput(cloudFrontDistribution);
  }

  private createCloudFrontWaf(): CfnWebACL {
    return new CfnWebACL(this, "APIAcl", {
      defaultAction: {
        allow: {},
      },
      scope: "CLOUDFRONT",
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: "MetricForWebACL",
        sampledRequestsEnabled: true,
      },
      name: "CloudfrontACL",
      rules: [
        {
          name: "CRSRule",
          priority: 0,
          statement: {
            managedRuleGroupStatement: {
              name: "AWSManagedRulesCommonRuleSet",
              vendorName: "AWS",
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

  private createCloudFrontDistribution(
    reactAppBucket: IBucket,
    cloudfrontACL: CfnWebACL
  ): CloudFrontWebDistribution {
    const distribution = new CloudFrontWebDistribution(
      this,
      "CloudFrontDistribution",
      {
        originConfigs: [
          {
            s3OriginSource: {
              s3BucketSource: reactAppBucket,
              originPath: "/dist",
            },
            behaviors: [
              {
                isDefaultBehavior: true,
                minTtl: Duration.seconds(0),
                defaultTtl: Duration.seconds(120),
                maxTtl: Duration.seconds(300),
                forwardedValues: {
                  queryString: false,
                  cookies: {
                    forward: "none",
                  },
                  headers: [
                    "Origin",
                    "Access-Control-Request-Headers",
                    "Access-Control-Request-Method",
                    "Cache-Control",
                  ],
                },
              },
            ],
          },
        ],
        errorConfigurations: [
          {
            errorCode: 404,
            errorCachingMinTtl: 0,
            responseCode: 200,
            responsePagePath: "/",
          },
        ],
        loggingConfig: {
          bucket: reactAppBucket,
          prefix: "access-logs/",
        },
        webACLId: cloudfrontACL.attrArn,
        geoRestriction: GeoRestriction.allowlist("US", "CA"),
      }
    );

    NagSuppressions.addResourceSuppressions(distribution, [
      {
        id: "AwsSolutions-CFR4",
        reason: "SSL version not enforced since this is a demo application",
      },
    ]);

    return distribution;
  }

  private addCloudFrontOriginAccessControl(
    cloudFrontDistribution: CloudFrontWebDistribution
  ): void {
    const oac = new CfnOriginAccessControl(this, "OriginAccessControl", {
      originAccessControlConfig: {
        name: "transcribe-oac",
        originAccessControlOriginType: "s3",
        signingBehavior: "always",
        signingProtocol: "sigv4",
      },
    });
    const cfnDistribution = cloudFrontDistribution.node
      .defaultChild as CfnDistribution;
    cfnDistribution.addPropertyOverride(
      "DistributionConfig.Origins.0.OriginAccessControlId",
      oac.getAtt("Id")
    );
  }

  private updateKmsKeyPolicy(
    kmsKey: Key,
    cloudFrontDistribution: CloudFrontWebDistribution
  ): void {
    kmsKey.addToResourcePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        principals: [new ServicePrincipal("cloudfront.amazonaws.com")],
        actions: ["kms:Decrypt", "kms:Encrypt", "kms:GenerateDataKey*"],
        resources: ["*"],
        conditions: {
          StringEquals: {
            "aws:SourceArn": `arn:aws:cloudfront::${Aws.ACCOUNT_ID}:distribution/${cloudFrontDistribution.distributionId}`,
          },
        },
      })
    );
  }

  private updateS3BucketPolicy(
    reactAppBucket: IBucket,
    cloudFrontDistribution: CloudFrontWebDistribution
  ): void {
    const bucketPolicy = new PolicyStatement({
      effect: Effect.ALLOW,
      principals: [new ServicePrincipal("cloudfront.amazonaws.com")],
      actions: ["s3:GetObject"],
      resources: [`${reactAppBucket.bucketArn}/*`],
      conditions: {
        StringEquals: {
          "AWS:SourceArn": `arn:aws:cloudfront::${Aws.ACCOUNT_ID}:distribution/${cloudFrontDistribution.distributionId}`,
        },
      },
    });
    reactAppBucket.addToResourcePolicy(bucketPolicy);
  }

  private createCloudFrontDistributionOutput(
    cloudFrontDistribution: CloudFrontWebDistribution
  ): void {
    new CfnOutput(this, "CloudFrontDistributionUrl", {
      key: "ReactAppUrl",
      value: `https://${cloudFrontDistribution.distributionDomainName}`,
      description: "The CloudFront URL for the React App",
    });
  }
}
