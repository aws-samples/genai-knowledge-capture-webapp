import { Construct } from "constructs";
import { Aws, CfnOutput, RemovalPolicy } from "aws-cdk-lib";
import {
  Bucket,
  BucketEncryption,
  BlockPublicAccess,
  ObjectOwnership,
  BucketProps,
} from "aws-cdk-lib/aws-s3";
import { PolicyStatement, Effect, AnyPrincipal } from "aws-cdk-lib/aws-iam";
import { NagSuppressions } from "cdk-nag";

export class S3Buckets extends Construct {
  public readonly documentBucket: Bucket;
  public readonly reactAppBucket: Bucket;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // Create a bucket for PDF document output
    this.documentBucket = this.createS3Bucket(
      "DocumentBucket",
      `transcribe-documents-${Aws.ACCOUNT_ID}`,
      {
        objectOwnership: undefined,
      }
    );

    // Enforce HTTPS on the document bucket
    this.addDocumentBucketPolicy(this.documentBucket);

    // Create a bucket for the React user interface
    this.reactAppBucket = this.createS3Bucket(
      "ReactAppBucket",
      `transcribe-react-app-${Aws.ACCOUNT_ID}`,
      {
        objectOwnership: ObjectOwnership.BUCKET_OWNER_PREFERRED,
      }
    );

    // Create CloudFormation outputs for the bucket names
    this.createOutputs();
  }

  private createS3Bucket(
    id: string,
    bucketName: string,
    overrides: Partial<BucketProps>
  ): Bucket {
    const bucket = new Bucket(this, id, {
      bucketName,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      ...overrides,
    });

    NagSuppressions.addResourceSuppressions(bucket, [
      {
        id: "AwsSolutions-S1",
        reason: "Server access logs not required for demo application",
      },
    ]);

    return bucket;
  }

  private addDocumentBucketPolicy(bucket: Bucket): void {
    const policy = new PolicyStatement({
      effect: Effect.DENY,
      actions: ["s3:*"],
      resources: [bucket.bucketArn, `${bucket.bucketArn}/*`],
      conditions: {
        Bool: { "aws:SecureTransport": "false" },
      },
      principals: [new AnyPrincipal()],
    });
    bucket.addToResourcePolicy(policy);
  }

  private createOutputs(): void {
    new CfnOutput(this, "DocumentBucketName", {
      key: "DocumentsS3Bucket",
      value: this.documentBucket.bucketName,
      description: "The name of the documents S3 bucket",
    });
  }
}
