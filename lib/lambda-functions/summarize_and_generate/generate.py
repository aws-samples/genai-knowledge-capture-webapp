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
import uuid

s3_client = Connections.s3_client


@dataclass
class Response:
    """A class for representing the Output format."""

    statusCode: int
    pdfFileS3Uri: str
    documentName: str
    serviceName: str = Connections.service_name


class Request(BaseModel):
    """A class for representing the Input format."""

    documentName: str
    documentText: str


def generate_document(
    document_name: str, document_title: str, document_text: str
) -> Response:
    """Generate a document and upload it to S3."""
    try:
        html_body = render_html_body(document_title, document_text)
        html_content = generate_html(html_body)
        pdf_file_path = generate_pdf(document_name, html_content)

        pdf_s3_url = upload_to_s3(pdf_file_path, document_name)

        return Response(
            statusCode=200,
            pdfFileS3Uri=pdf_s3_url,
            documentName=document_name,
            serviceName=Connections.service_name,
        )
    except Exception as e:
        logger.warning(f"Error generating document: {e}")
        raise CodeError(f"Error generating document: {e}")


def generate_pdf(document_name: str, html_content: str) -> str:
    """Generate PDF from HTML content."""
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as temp_pdf:
        # nosem: tempfile-without-flush
        temp_pdf_name = temp_pdf.name
        temp_pdf.write(html_content.encode('utf-8'))
        temp_pdf.flush()  # Ensure all data is written to the file
        temp_pdf.close()  # Close the file to ensure it's fully written and released

    html_to_pdf(html_content, temp_pdf_name)

    return temp_pdf_name


def upload_to_s3(file_path: str, document_name: str) -> str:
    """Upload a file to S3 and return its S3 URL."""
    bucket = Connections.s3_bucket_name
    key = f"{uuid.uuid4()}/{document_name}.pdf"

    s3_client.upload_file(
        file_path, bucket, key, ExtraArgs={"ContentType": "application/pdf"}
    )
    s3_url = f"s3://{bucket}/{key}"
    presigned_url = generate_presigned_url(s3_client, bucket, key)

    logger.info(f"Uploaded PDF to S3: {s3_url}")

    return presigned_url


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
        raise CodeError(f"Error while generating HTML body: {exception}")

    return document_body
