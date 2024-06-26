import time
import json
from typing import Literal
from dataclasses import dataclass, field
from summarization import summarization
from generate import generate_document
from connections import Connections, tracer, logger, metrics
from aws_lambda_powertools.metrics import MetricUnit
from aws_lambda_powertools.utilities.typing import LambdaContext
from aws_lambda_powertools.utilities.parser import BaseModel


@dataclass
class Response:
    statusCode: int
    body: str
    headers: dict = field(
        default_factory=lambda: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
            "Content-Type": "application/json",
        }
    )


class Request(BaseModel):
    documentName: str
    questionText: str
    documentText: str
    audioFiles: list[str]
    serviceName: str = Connections.service_name


@logger.inject_lambda_context(log_event=True, clear_state=True)
@tracer.capture_lambda_handler
@metrics.log_metrics(capture_cold_start_metric=True)
def lambda_handler(event: Request, _context: LambdaContext) -> str:
    metrics.add_metric(
        name="TotalSummarizationInvocation", unit=MetricUnit.Count, value=1
    )
    logger.info(f"Summarization event: {event}")

    if "body" in event:
        payload = json.loads(event["body"])
    else:
        payload = event
    request = Request(**payload)
    document_name = request.documentName
    document_text = request.documentText
    question = request.questionText
    audio_files = request.audioFiles

    # Summarizing answers
    if document_text:
        # Start timer
        start_time = time.time()

        # Calling LLM to summarize the answers for the given question
        summary_text = summarization(
            question, [document_text], model_name="Claude3Haiku"
        )
        logger.debug(f"Summarized answer: \n {summary_text}")

        # End timer
        end_time = time.time()

        # Calculate response time in seconds
        response_time = end_time - start_time

        # Add metrics
        metrics.add_metric(
            name="SummarizationLLMResponseTime",
            unit=MetricUnit.Seconds,
            value=response_time,
        )

        # Generate Document
        doc_response = generate_document(
            document_name, question, summary_text, audio_files)

        statusCode: Literal[200] | Literal[400] = (
            200 if doc_response.statusCode == 200 else 400
        )
        pdfFileS3Uri: str = doc_response.pdfFileS3Uri
        audioS3Uris: list[str] = doc_response.audioS3Uris

    else:
        logger.info("No valid answers retrieved for question")
        statusCode = 400
        pdfFileS3Uri = None
        audioS3Uris = None

    response_body = {
        "pdfFileS3Uri": pdfFileS3Uri,
        "audioS3Uris": audioS3Uris,
        "documentName": document_name
    }

    response = Response(
        statusCode=statusCode,
        body=json.dumps(response_body),
    ).__dict__

    logger.info(f"Lambda Output: {response}")

    return response
