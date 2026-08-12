# Orchestration Lambda

## Overview

Docker-based AWS Lambda function that summarizes transcribed text using Amazon Bedrock (Claude 4.5/4.6) and generates styled PDF documents. The function receives transcribed text and audio recordings, invokes an LLM for summarization via LangChain, renders the summary as a PDF using WeasyPrint, and uploads all artifacts to S3 with pre-signed download URLs.

## Technology Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| Python | 3.13 | Runtime |
| AWS Lambda Powertools | 3.34.0 | Structured logging, tracing, metrics |
| LangChain AWS | 1.7.0 | Amazon Bedrock integration for LangChain |
| LangChain Core | 1.5.4 | Prompt templates and output parsers |
| WeasyPrint | 69.0 | HTML-to-PDF rendering |
| Markdown | 3.10+ | Markdown-to-HTML conversion |
| Dominate | 2.9.1 | HTML document generation |
| Boto3 | 1.43+ | AWS SDK |

> The `langchain` meta-package is intentionally not a dependency. Only
> `langchain-core` and `langchain-aws` are imported, and omitting the meta-package
> removes the code paths covered by CVE-2026-55443.

### Cold start

The image is ~1.2 GB, and the first invocation after a new image is pushed has to
fetch the image layers, which has been measured at 22–28 s — beyond API Gateway's
29 s integration timeout. Three things keep that off the user path:

- `weasyprint` and `langchain_aws` are imported lazily, inside the functions that
  use them, keeping module-scope import work small.
- The function runs at 3008 MB. Memory drives CPU allocation; max memory used is
  ~250 MB, so the setting is for CPU, not footprint.
- A custom resource sends `{"warmup": true}` to the function at the end of every
  deployment. The handler imports the heavy modules and returns without calling
  Bedrock, so the layer fetch is paid at deploy time. Steady-state requests take
  5–8 s cold and ~4 s warm.

## AI Models

Uses Amazon Bedrock cross-region inference profiles:

| Model | Inference Profile ID | Use Case |
|-------|---------------------|----------|
| Claude Haiku 4.5 | `us.anthropic.claude-haiku-4-5-20251001-v1:0` | Default — fast summarization |
| Claude Sonnet 4.6 | `us.anthropic.claude-sonnet-4-6` | High-quality summarization |
| Claude Opus 4.6 | `us.anthropic.claude-opus-4-6-v1` | Complex analysis (available) |

## File Reference

| File | Description |
|------|-------------|
| [summarize_generate.py](summarize_generate.py) | Lambda handler — orchestrates summarization and document generation |
| [summarization.py](summarization.py) | LangChain chain: prompt → LLM → XML parser for summarization |
| [connections.py](connections.py) | Bedrock and S3 client connections, model configuration |
| [prompt_templates.py](prompt_templates.py) | System and human prompt templates for the LLM |
| [generate.py](generate.py) | PDF generation and S3 upload logic |
| [document_generator.py](document_generator.py) | HTML rendering and WeasyPrint PDF conversion |
| [utils.py](utils.py) | Utility functions (XML parsing, S3 pre-signed URLs) |
| [exceptions.py](exceptions.py) | Custom exception classes |
| [requirements.txt](requirements.txt) | Python dependencies |
| [Dockerfile](Dockerfile) | Container image definition (based on `public.ecr.aws/lambda/python:3.13`) |

## Input

```json
{
  "documentName": "test-live-knowledge-capture",
  "questionText": "What is Amazon SageMaker?",
  "documentText": "Amazon SageMaker is a fully managed machine learning service...",
  "audioFiles": ["base64string...", "..."]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `documentName` | String | User-provided document name |
| `questionText` | String | The question being answered |
| `documentText` | String | Transcribed answer text from Amazon Transcribe |
| `audioFiles` | String[] | Base64-encoded audio recordings |

## Output

```json
{
  "statusCode": 200,
  "body": "{\"pdfFileS3Uri\": \"https://...\", \"audioS3Uris\": [\"https://...\"], \"documentName\": \"...\"}"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `statusCode` | Number | HTTP status code (200 = success, 400 = error) |
| `pdfFileS3Uri` | String | Pre-signed S3 URL for the generated PDF |
| `audioS3Uris` | String[] | Pre-signed S3 URLs for saved audio files |
| `documentName` | String | Echo of the input document name |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `S3_BUCKET_NAME` | S3 bucket for storing generated documents and audio |
| `POWERTOOLS_LOG_LEVEL` | Logger verbosity (DEBUG, INFO, WARNING, ERROR) |
| `POWERTOOLS_SERVICE_NAME` | Service name for structured logging |
| `POWERTOOLS_METRICS_NAMESPACE` | CloudWatch metrics namespace |
| `AWS_REGION` | AWS Region (set automatically by Lambda) |
| `XDG_CACHE_HOME` | Set to `/tmp` for WeasyPrint font cache |

## Docker Build

The Lambda runs as a Docker container image based on `public.ecr.aws/lambda/python:3.13`. The image includes the `pango` system library required by WeasyPrint for PDF rendering. CDK builds the image automatically via `DockerImageCode.fromImageAsset()`.

## License

This project is licensed under the MIT-0 License.
