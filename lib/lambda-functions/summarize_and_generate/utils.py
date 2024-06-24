from connections import logger


def format_inputs(input_texts):
    """
    To format a list of input texts into the format that fit into the prompt for Claude models

    Args:
        input_texts: a list of input_texts

    Returns:
        a str

    """

    input_text_list = []
    for (
        i,
        text,
    ) in enumerate(input_texts):
        prefix = f"<input_text_{i + 1}>"
        suffix = f"</input_text_{i + 1}>"
        input_text = prefix + text + suffix + "\n\n"
        input_text_list.append(input_text)

    return " ".join(input_text_list)


def parse_summary(summary):
    """
    Parse the output summary from XMLParser

    Args:
        summary: a JSON file from XMLParser output

    Returns:
        summary_text (str)
    """
    try:
        summary_text = summary["Output"][0]["Summary"]
    except Exception as e:
        logger.debug("An error occurred when parse summary:", e)
    return summary_text


def generate_presigned_url(s3_client, bucket, key):
    url = s3_client.generate_presigned_url(
        ClientMethod="get_object",
        Params={"Bucket": bucket, "Key": key},
        ExpiresIn=86400,
    )
    return url
