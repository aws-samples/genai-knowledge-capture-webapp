from connections import logger


def parse_summary(summary):
    """
    Parse the output summary from XMLParser.

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
    """
    Generate a pre-signed URL for an S3 object.

    Args:
        s3_client (boto3.client): An S3 client instance.
        bucket (str): The name of the S3 bucket.
        key (str): The key (filename) of the S3 object.

    Returns:
        str: The pre-signed URL for the S3 object.
    """
    url = s3_client.generate_presigned_url(
        ClientMethod="get_object",
        Params={"Bucket": bucket, "Key": key},
        ExpiresIn=86400,
    )
    return url
