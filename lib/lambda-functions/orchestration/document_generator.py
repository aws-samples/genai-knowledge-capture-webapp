from weasyprint import HTML
from exceptions import CodeError
from dominate.util import raw
from dominate.tags import html, head, style, body, h1, h2, u
from connections import logger
import markdown
import os
from time import localtime, strftime

# Stylesheet to use for rendering the final PDF document
STYLE_CSS = """
        h1 {{
            position: center;
        }}
        header {{
            position: running(header);
        }}
        @page {{
            size: Letter portrait;
            margin-top: 3cm;

            @top-right {{
                content: '{0}';
                font-size: 10px;
            }}
            @bottom-center {{
                content: counter(page);
            }}
            @bottom-right {{
                content: 'Document generated using AWS Bedrock Service';
                font-size: 10px;
            }}
        }}
    """


def markdown_to_html(markdown_text: str) -> str:
    """
    Converts Markdown text to HTML

    Arguments:
    ----------
    markdown_text: str
        Markdown text to be converted to HTML

    Returns:
    --------
    html: str
        HTML document generated from the Markdown text
    """
    logger.debug(f"Markdown document generated for body {markdown_text}")
    html = markdown.markdown(markdown_text)
    logger.debug(f"HTML document generated for body {html}")
    return html


def generate_html(html_body: str) -> str:
    """
    Generates a new HTML document based in the HTML Body data passed.
    This function is used to generate the HTML document for the PDF generation.

    Arguments:
    -----------
    html_body: str
        HTML body data to be used to generate the HTML document

    Returns:
    --------
    str:
        HTML document generated from the HTML body data passed.
        This document will be used to generate the PDF file. The
        document is rendered in string encoding
    """
    logger.debug(f"HTML document generated for body {html_body}")

    current_time = strftime("%m-%d-%Y %H:%M:%S", localtime())
    html_doc = html()
    html_doc.add(head(style(STYLE_CSS.format(current_time))))
    html_doc.add(body(raw(html_body)))

    return html_doc.render()


def html_to_pdf(html_document: str, pdf_path: str) -> None:
    """
    Converts given HTML document to PDF file.

    Arguments:
    -----------
    html_document: str
        HTML document, in string encoded format, to be converted to PDF file
    pdf_path: str
        Path where the PDF file will be generated.
    """
    try:
        HTML(string=html_document, base_url=os.getcwd()).write_pdf(pdf_path)
        logger.debug(f"PDF file generated at: {pdf_path}")
    except Exception as exception:
        raise CodeError(f"Error while generating PDF file: {exception}")
    return None


def add_header(header_name: str) -> str:
    """
    Adds a header to the HTML document.

    Arguments:
    -----------
    header_name: str
        Name of the header to be added to the HTML document.

    Returns:
    --------
    str:
        HTML document encoded as string with the header added as H2 tag.
    """
    return h2(header_name).render()


def add_document_title(title_text: str) -> str:
    """
    Adds document title to the HTML document.

    Arguments:
    ----------
    title_text: str
        Name of the title to be added to the HTML document.

    Returns:
    --------
    str:
        HTML document encoded as string with the title text added as H1 tag.
    """
    return h1(u(title_text), style="text-align: center;").render()
