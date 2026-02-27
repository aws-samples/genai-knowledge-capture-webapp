import os
import boto3
from aws_lambda_powertools import Logger, Tracer, Metrics
from langchain_aws import ChatBedrock
from botocore.client import Config

tracer = Tracer()
logger = Logger(log_uncaught_exceptions=True, serialize_stacktrace=True)
metrics = Metrics()

MODEL_ID_MAPPING = {
    "ClaudeSonnet4_6": "us.anthropic.claude-sonnet-4-6",
    "ClaudeHaiku4_5": "us.anthropic.claude-haiku-4-5-20251001-v1:0",
    "ClaudeOpus4_6": "us.anthropic.claude-opus-4-6-v1",
}


class Connections:
    """
    A class to maintain connections to external dependencies.

    Attributes
    ----------
    region_name : str
        The AWS Region name where the AWS Lambda function is running.
    s3_bucket_name : str
        Name of the S3 bucket for storing generated documents.
    service_name : str
        Name of the service configured through AWS Powertools.
    s3_client : boto3.client
        Boto3 client to interact with AWS S3.
    bedrock_runtime_client : boto3.client
        Boto3 client to interact with AWS Bedrock Runtime.
    """

    namespace = os.environ["POWERTOOLS_METRICS_NAMESPACE"]
    service_name = os.environ["POWERTOOLS_SERVICE_NAME"]
    region_name = os.environ["AWS_REGION"]
    s3_bucket_name = os.environ["S3_BUCKET_NAME"]

    s3_client = boto3.client("s3", region_name=region_name)

    config = Config(read_timeout=1000)
    bedrock_runtime_client = boto3.client(
        "bedrock-runtime", region_name=region_name, config=config
    )

    @staticmethod
    def get_bedrock_llm(max_tokens=4096, model_name="ClaudeSonnet4_6"):
        """
        Create and return the Bedrock LLM instance.

        Args:
            max_tokens: Maximum tokens for the response (default 4096).
            model_name: Model key from MODEL_ID_MAPPING.

        Returns:
            ChatBedrock instance configured with the specified model.
        """
        return ChatBedrock(
            client=Connections.bedrock_runtime_client,
            model_id=MODEL_ID_MAPPING[model_name],
            model_kwargs={
                "max_tokens": max_tokens,
                "temperature": 0,
                "top_k": 50,
            },
        )
