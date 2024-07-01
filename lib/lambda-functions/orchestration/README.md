# Orchestration Lambda

## Introduction

The primary objective of this AWS Lambda is to generate summary of multiple relevant answers received for a given question. This AWS Lambda uses Large Language Models from Amazon Bedrock service to generate the summary.

## Component Details

#### Prerequisites

- [Python 3.12](https://www.python.org/downloads/release/python-3120/) or later
- [AWS Lambda Powertools 2.35.1](https://docs.powertools.aws.dev/lambda/python/2.35.1/)

#### Technology stack

- [AWS Lambda](https://aws.amazon.com/lambda/)
- [Amazon Bedrock](https://aws.amazon.com/bedrock/)
- [Amazon S3](https://aws.amazon.com/s3/)

#### Package Details

| Files                                          | Description                                                                                                |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| [connections.py](connections.py)               | Python file with `Connections` class for establishing connections with external dependencies of the lambda |
| [exceptions.py](exceptions.py)                 | Python file containing custom exception classes `CodeError` and `ConnectionError`                          |
| [document_generator.py](document_generator.py) | Python file containing the helper functions that convert HTML to PDF files                                 |
| [generate.py](generate.py)                     | Python file containing the helper functions that generate PDF files and upload them to S3 bucket           |
| [prompt_templates.py](prompt_templates.py)     | Python variables with input Prompts for the LLM to operate                                                 |
| [summarization.py](summarization.py)           | Python utility class for performing answer summary using Amazon Bedrock service                            |
| [summarize_generate.py](summarize_generate.py) | Python file containing `lambda_handler`                                                                    |
| [utils.py](utils.py)                           | Python utility file containing reusable methods                                                            |
| [requirements.txt](requirements.txt)           | A text file containing all dependencies for this lambda                                                    |

#### Input

```json
{
  "documentName": "test-live-knowledge-capture",
  "questionText": "What is Amazon SageMaker?",
  "documentText": "**Amazon SageMaker** is a fully managed machine learning service that enables developers and data scientists to quickly build, train, and deploy machine learning models at scale.",
  "audioFiles": ["base64string...", "..."]
}
```

| Field          | Description                                                    | Data Type |
| -------------- | -------------------------------------------------------------- | --------- |
| `documentName` | User input document name                                       | String    |
| `questionText` | User's question to be answered                                 | String    |
| `documentText` | The answer to users question capture by Amazon Transcribe Live | String    |
| `audioFiles  ` | The recorded audio clips as base64 encoded strings             | String[]  |

#### Output

```json
{
  "statusCode": int,
  "pdfFileS3Uri": str,
  "audioS3Uris": str[],
  "documentName": str,
  "serviceName": "genai-knowledge-capture-transcribe-live"
}
```

| Field          | Description                                                                                                            | Data Type |
| -------------- | ---------------------------------------------------------------------------------------------------------------------- | --------- |
| `statusCode`   | A HTTP status code that denotes the output status of validation. A `200` value means validation completed successfully | Number    |
| `pdfFileS3Uri` | S3 uri of the generated PDF file                                                                                       | String    |
| `audioS3Uris`  | S3 uris of the saved audio files                                                                                       | String[]  |
| `documentName` | User input document name                                                                                               | String    |
| `serviceName`  | The name of the AWS Lambda as configured through AWS Powertools across log statements                                  | String    |

#### Environmental Variables

| Field                          | Description                                                     | Data Type |
| ------------------------------ | --------------------------------------------------------------- | --------- |
| `POWERTOOLS_LOG_LEVEL`         | Sets how verbose Logger should be (INFO, by default)            | String    |
| `DATA_SOURCE_BUCKET_NAME`      | S3 bucket where the final PDF file is stored                    | String    |
| `POWERTOOLS_SERVICE_NAME`      | Sets service key that will be present across all log statements | String    |
| `POWERTOOLS_METRICS_NAMESPACE` | Sets namespace key that will be present across metrics log      | String    |
| `AWS_REGION`                   | AWS Region where the solution is deployed                       | String    |
