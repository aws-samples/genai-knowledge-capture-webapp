import os
import json
import boto3

sts_client = boto3.client("sts")


def lambda_handler(_event, _context):
    role_arn = os.environ["ROLE_ARN"]

    try:
        # Assume the role
        response = sts_client.assume_role(
            RoleArn=role_arn, RoleSessionName="TranscribeSession"
        )

        # Extract the temporary credentials
        credentials = response["Credentials"]
        credentials["Expiration"] = credentials["Expiration"].isoformat()

        # Return the temporary credentials
        return {
            "statusCode": 200,
            "body": json.dumps(
                {
                    "AccessKeyId": credentials["AccessKeyId"],
                    "SecretAccessKey": credentials["SecretAccessKey"],
                    "SessionToken": credentials["SessionToken"],
                    "Expiration": credentials["Expiration"],
                    "Region": os.environ["AWS_REGION"],
                }
            ),
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
            },
        }
    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps(
                {
                    "message": "Error assuming role",
                    "error": str(e),
                }
            ),
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
            },
        }
