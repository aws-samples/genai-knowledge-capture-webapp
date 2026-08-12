import os
import boto3
from aws_lambda_powertools import Logger, Tracer, Metrics
from botocore.client import Config

tracer = Tracer()
logger = Logger(log_uncaught_exceptions=True, serialize_stacktrace=True)
metrics = Metrics()

# US geo cross-Region inference profile IDs, plus per-model request details.
#
# supports_sampling_params: starting with Claude Opus 4.7, `temperature`, `top_p`,
#   and `top_k` are no longer supported and must be omitted from the request.
#   https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-opus-4-7.html
# extra_body: additional top-level fields merged into the InvokeModel request body.
#   Claude Sonnet 5 has adaptive thinking always on (it cannot be disabled), and
#   Claude Opus 5 has it on by default, so both spend part of the `max_tokens`
#   allowance on thinking. Summarization is a single-shot call behind API Gateway's
#   29 s timeout, so ask for the minimum thinking with `effort: low`.
#   https://docs.aws.amazon.com/bedrock/latest/userguide/claude-messages-adaptive-thinking.html
MODEL_CONFIG = {
    "ClaudeSonnet5": {
        "model_id": "us.anthropic.claude-sonnet-5",
        "supports_sampling_params": False,
        "extra_body": {"output_config": {"effort": "low"}},
    },
    "ClaudeHaiku4_5": {
        "model_id": "us.anthropic.claude-haiku-4-5-20251001-v1:0",
        "supports_sampling_params": True,
        "extra_body": {},
    },
    "ClaudeOpus5": {
        "model_id": "us.anthropic.claude-opus-5",
        "supports_sampling_params": False,
        "extra_body": {"output_config": {"effort": "low"}},
    },
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
    def get_bedrock_llm(max_tokens=8192, model_name="ClaudeSonnet5"):
        """
        Create and return the Bedrock LLM instance.

        Args:
            max_tokens: Maximum tokens for the response (default 8192). On models
                with thinking enabled, this budget covers thinking plus the answer.
            model_name: Model key from MODEL_CONFIG.

        Returns:
            ChatBedrock instance configured with the specified model.
        """
        # Imported lazily to keep the Lambda init phase within its 10s limit.
        from langchain_aws import ChatBedrock

        model = MODEL_CONFIG[model_name]

        model_kwargs = {"max_tokens": max_tokens, **model["extra_body"]}
        # Claude Opus 4.7 and later reject temperature/top_p/top_k, so they are
        # only sent for models that still accept them.
        if model["supports_sampling_params"]:
            model_kwargs["temperature"] = 0
            model_kwargs["top_k"] = 50

        return ChatBedrock(
            client=Connections.bedrock_runtime_client,
            model_id=model["model_id"],
            model_kwargs=model_kwargs,
        )
