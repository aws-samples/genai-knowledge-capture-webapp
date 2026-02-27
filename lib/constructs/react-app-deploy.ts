import { Construct } from "constructs";
import { Aws, CfnOutput, Duration, RemovalPolicy } from "aws-cdk-lib";
import { IBucket } from "aws-cdk-lib/aws-s3";
import {
  Distribution,
  GeoRestriction,
  ViewerProtocolPolicy,
  CachePolicy,
  OriginRequestPolicy,
} from "aws-cdk-lib/aws-cloudfront";
import { S3BucketOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
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
    cloudfrontACL.applyRemovalPolicy(RemovalPolicy.DESTROY);

    // Create the CloudFront distribution with native OAC
    const distribution = this.createCloudFrontDistribution(
      props.reactAppBucket,
      cloudfrontACL
    );

    // Update the KMS key policy to allow use by CloudFront distribution
    this.updateKmsKeyPolicy(props.kmsKey, distribution);

    // Update the S3 bucket policy to allow access to CloudFront distribution
    this.updateS3BucketPolicy(props.reactAppBucket, distribution);

    // Create the CloudFormation output for the CloudFront URL
    this.createCloudFrontDistributionOutput(distribution);
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
  ): Distribution {
    const distribution = new Distribution(this, "CloudFrontDistribution", {
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessControl(reactAppBucket, {
          originPath: "/dist",
        }),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: new CachePolicy(this, "CachePolicy", {
          minTtl: Duration.seconds(0),
          defaultTtl: Duration.seconds(120),
          maxTtl: Duration.seconds(300),
        }),
        originRequestPolicy: OriginRequestPolicy.CORS_S3_ORIGIN,
      },
      errorResponses: [
        {
          httpStatus: 404,
          ttl: Duration.seconds(0),
          responseHttpStatus: 200,
          responsePagePath: "/",
        },
      ],
      logBucket: reactAppBucket,
      logFilePrefix: "access-logs/",
      webAclId: cloudfrontACL.attrArn,
      geoRestriction: GeoRestriction.allowlist("US", "CA"),
      defaultRootObject: "index.html",
    });

    NagSuppressions.addResourceSuppressions(distribution, [
      {
        id: "AwsSolutions-CFR4",
        reason: "SSL version not enforced since this is a demo application",
      },
    ]);

    return distribution;
  }

  private updateKmsKeyPolicy(
    kmsKey: Key,
    distribution: Distribution
  ): void {
    kmsKey.addToResourcePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        principals: [new ServicePrincipal("cloudfront.amazonaws.com")],
        actions: ["kms:Decrypt", "kms:Encrypt", "kms:GenerateDataKey*"],
        resources: ["*"],
        conditions: {
          StringEquals: {
            "aws:SourceArn": `arn:aws:cloudfront::${Aws.ACCOUNT_ID}:distribution/${distribution.distributionId}`,
          },
        },
      })
    );
  }

  private updateS3BucketPolicy(
    reactAppBucket: IBucket,
    distribution: Distribution
  ): void {
    const bucketPolicy = new PolicyStatement({
      effect: Effect.ALLOW,
      principals: [new ServicePrincipal("cloudfront.amazonaws.com")],
      actions: ["s3:GetObject"],
      resources: [`${reactAppBucket.bucketArn}/*`],
      conditions: {
        StringEquals: {
          "AWS:SourceArn": `arn:aws:cloudfront::${Aws.ACCOUNT_ID}:distribution/${distribution.distributionId}`,
        },
      },
    });
    reactAppBucket.addToResourcePolicy(bucketPolicy);
  }

  private createCloudFrontDistributionOutput(
    distribution: Distribution
  ): void {
    new CfnOutput(this, "CloudFrontDistributionUrl", {
      key: "ReactAppUrl",
      value: `https://${distribution.distributionDomainName}`,
      description: "The CloudFront URL for the React App",
    });
  }
}
