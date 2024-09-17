import os
import boto3
from aws_lambda_powertools import Logger, Tracer, Metrics
from langchain_aws import ChatBedrock
from botocore.client import Config

tracer = Tracer()
logger = Logger(log_uncaught_exceptions=True, serialize_stacktrace=True)
metrics = Metrics()

MODEL_ID_MAPPING = {
    "Titan": "amazon.titan-tg1-large",
    "Claude2": "anthropic.claude-v2",
    "ClaudeInstant": "anthropic.claude-instant-v1",
    "Claude3Sonnet": "anthropic.claude-3-sonnet-20240229-v1:0",
    "Claude3Haiku": "anthropic.claude-3-haiku-20240307-v1:0",
}


class Connections:
    """
    A class to maintain connections to external dependencies

    Attributes
    ----------
    region_name : str
        The AWS Region name where the AWS Lambda function is running.
        Depends on the environmental variable 'AWS_REGION'
    s3_bucket_name : str
        Name of the S3 bucket to use for storing the generated documents.
    service_name: str
        Name of the service assigned and configured through AWS Powertools for
        logging. Depends on the environmental variable 'POWERTOOLS_SERVICE_NAME'
    region_name : str
        The AWS Region name where the AWS Lambda function is running.
        Depends on the environmental variable 'AWS_REGION'
    s3_client : boto3.client
        Boto3 client to interact with AWS S3 bucket
    bedrock_runtime_client : boto3.client
        Boto3 client to interact with AWS Bedrock Runtime

    Methods
    -------
    get_bedrock_llm(max_tokens=256, model_id="ClaudeX")
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
    def get_bedrock_llm(max_tokens=256, model_name="Claude3Sonnet"):
        """
        Create and return the bedrock instance with the llm model to use.

        Args: None.

        Returns:
            Bedrock instance with the llm model to use.
        """
        model_kwargs_mapping = {
            "Titan": {
                "maxTokenCount": max_tokens,
                "temperature": 0,
                "topP": 1,
            },
            "Claude2": {
                "max_tokens": max_tokens,
                "temperature": 0,
                "top_p": 1,
                "top_k": 50,
                "stop_sequences": ["\n\nHuman"],
            },
            "ClaudeInstant": {
                "max_tokens": max_tokens,
                "temperature": 0,
                "top_p": 1,
                "top_k": 50,
                "stop_sequences": ["\n\nHuman"],
            },
            "Claude3Sonnet": {
                "max_tokens": max_tokens,
                "temperature": 0,
                "top_p": 1,
                "top_k": 50,
                "stop_sequences": ["\n\nHuman"],
            },
            "Claude3Haiku": {
                "max_tokens": max_tokens,
                "temperature": 0,
                "top_p": 1,
                "top_k": 50,
                "stop_sequences": ["\n\nHuman"],
            },
        }

        return ChatBedrock(
            client=Connections.bedrock_runtime_client,
            model_id=MODEL_ID_MAPPING[model_name],
            model_kwargs=model_kwargs_mapping[model_name],
        )
