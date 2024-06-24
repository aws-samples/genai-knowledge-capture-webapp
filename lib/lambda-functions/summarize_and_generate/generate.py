import base64
import datetime
from aws_lambda_powertools.utilities.parser import BaseModel
from document_generator import (
    markdown_to_html,
    generate_html,
    html_to_pdf,
    add_document_title,
)
from utils import generate_presigned_url
from connections import Connections, tracer, logger
from dataclasses import dataclass
from exceptions import CodeError
import tempfile

s3_client = Connections.s3_client


@dataclass
class Response:
    """A class for representing the Output format."""

    statusCode: int
    pdfFileS3Uri: str
    audioS3Uris: list[str]
    documentName: str
    serviceName: str = Connections.service_name


class Request(BaseModel):
    """A class for representing the Input format."""

    documentName: str
    documentText: str
    audioFiles: int


def generate_document(
    document_name: str, document_title: str, document_text: str, audio_files: list[str]
) -> Response:
    """Generate a document and upload it to S3."""
    try:
        html_body = render_html_body(document_title, document_text)
        html_content = generate_html(html_body)
        pdf_file_path = generate_pdf(html_content)

        session_id = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d_%H-%M-%S_%f")
        pdf_s3_url = upload_pdf_to_s3(session_id, pdf_file_path, document_name)
        audio_s3_urls = upload_audio_to_s3(session_id, document_name, audio_files)

        return Response(
            statusCode=200,
            pdfFileS3Uri=pdf_s3_url,
            audioS3Uris=audio_s3_urls,
            documentName=document_name,
            serviceName=Connections.service_name,
        )
    except Exception as e:
        logger.warning(f"Error generating document: {e}")
        raise CodeError(f'Error generating document: {e}') from e


def generate_pdf(html_content: str) -> str:
    """Generate PDF from HTML content."""
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as temp_pdf:
        # nosem: tempfile-without-flush
        temp_pdf_name = temp_pdf.name
        temp_pdf.write(html_content.encode('utf-8'))
        temp_pdf.flush()  # Ensure all data is written to the file
        temp_pdf.close()  # Close the file to ensure it's fully written and released

    html_to_pdf(html_content, temp_pdf_name)

    return temp_pdf_name


def upload_pdf_to_s3(session_id: str, file_path: str, document_name: str) -> str:
    """Upload a file to S3 and return its S3 URL."""
    bucket = Connections.s3_bucket_name
    key = f"{session_id}/{document_name}.pdf"

    s3_client.upload_file(
        file_path, bucket, key, ExtraArgs={"ContentType": "application/pdf"}
    )
    s3_url = f"s3://{bucket}/{key}"
    presigned_url = generate_presigned_url(s3_client, bucket, key)

    logger.info(f"Uploaded PDF to S3: {s3_url}")

    return presigned_url


def upload_audio_to_s3(session_id: str, document_name: str, audio_files: list[str]) -> list[str]:
    """Upload a file to S3 and return its S3 URL."""
    bucket = Connections.s3_bucket_name
    presigned_urls = []
    for index, audio_file in enumerate(audio_files):
        key = f"{session_id}/{document_name}_audio_{index}.webm"

        # Decode the base64-encoded audio data
        audio_data = base64.b64decode(audio_file)

        # Upload the audio data to S3
        s3_client.put_object(
            Bucket=bucket,
            Key=key,
            Body=audio_data,
            ContentType='audio/webm'
        )
        s3_url = f"s3://{bucket}/{key}"
        presigned_url = generate_presigned_url(s3_client, bucket, key)
        presigned_urls.append(presigned_url)

        logger.info(f"Uploaded audio file to S3: {s3_url}")

    return presigned_urls


@tracer.capture_method
def render_html_body(document_title: str, document_text: str) -> str:
    """Generate HTML body from the document text."""
    document_body = "" + add_document_title(document_title)
    try:
        logger.info("Building document section with text summary")
        text = bytes(document_text, "utf-8").decode("unicode_escape")
        if text.startswith('"') and text.endswith('"'):
            text = text[1:-1]
        document_body += markdown_to_html(text.strip())
    except Exception as exception:
        logger.warning(f"Error while generating HTML body: {exception}")
        raise CodeError(f'Error while generating HTML body: {exception}') from exception

    return document_body
