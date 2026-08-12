# Orchestration Lambda

## Overview

Docker-based AWS Lambda function that summarizes transcribed text using Amazon Bedrock (Claude Sonnet 5 by default, Claude Haiku 4.5 / Opus 5 available) and generates styled PDF documents. The function receives transcribed text and audio recordings, invokes an LLM for summarization via LangChain, renders the summary as a PDF using WeasyPrint, and uploads all artifacts to S3 with pre-signed download URLs.

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
| defusedxml | 0.7.1 | Required at runtime by `XMLOutputParser` |
| Boto3 | 1.43+ | AWS SDK |

> `defusedxml` is not imported by this package's code and is not declared by
> `langchain-core`, but `langchain_core.output_parsers.XMLOutputParser` imports it
> when using its default `parser="defusedxml"` mode, which
> [summarization.py](summarization.py) relies on. It has to stay pinned here or
> summarization fails with an `ImportError` at parse time.

> The `langchain` meta-package is intentionally not a dependency. Only
> `langchain-core` and `langchain-aws` are imported, and omitting the meta-package
> removes the code paths covered by CVE-2026-55443.

## Function configuration

| Setting | Value | Notes |
|---------|-------|-------|
| Architecture | `arm64` | |
| Memory | 3008 MB | Drives CPU allocation; max memory used is ~250 MB |
| Timeout | 60 s | API Gateway still caps the request at 29 s |
| Package type | Container image | `public.ecr.aws/lambda/python:3.13` base |

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
  Bedrock, so the layer fetch is paid at deploy time. Steady-state requests were
  measured at 5–8 s cold and ~4 s warm with Claude Haiku 4.5; Claude Sonnet 5 is
  larger and thinks on every request, so expect higher figures.

To warm the function manually:

```bash
aws lambda invoke --function-name transcribe-orchestration-function \
  --payload '{"warmup": true}' --cli-binary-format raw-in-base64-out /dev/stdout
```

If a request ever does exceed 29 s, API Gateway returns `504` while the function
keeps running to completion, so the document still lands in S3 even though the
client saw an error. For more headroom, the account's
`Maximum integration timeout in milliseconds` quota (`L-E5AE38E3`, default 29000)
is adjustable; raising it allows the integration timeout to be set closer to the
function's 60 s timeout.

## AI Models

Uses Amazon Bedrock US geo cross-Region inference profiles:

| Model | Inference Profile ID | Sampling params | Use Case |
|-------|---------------------|-----------------|----------|
| Claude Sonnet 5 | `us.anthropic.claude-sonnet-5` | No | Default — high-quality summarization |
| Claude Haiku 4.5 | `us.anthropic.claude-haiku-4-5-20251001-v1:0` | Yes | Fast, low-cost summarization |
| Claude Opus 5 | `us.anthropic.claude-opus-5` | No | Complex analysis (available) |

`temperature`, `top_p`, and `top_k` were
[dropped starting with Claude Opus 4.7](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-opus-4-7.html);
the recommended migration path is to omit them and steer the model through the
prompt. `MODEL_CONFIG` in [connections.py](connections.py) carries a
`supports_sampling_params` flag per model, and `get_bedrock_llm` sends
`temperature`/`top_k` only for Claude Haiku 4.5.

### Thinking

Claude Sonnet 5 runs with
[adaptive thinking](https://docs.aws.amazon.com/bedrock/latest/userguide/claude-messages-adaptive-thinking.html)
always on — it cannot be disabled — and Claude Opus 5 has it on by default. Two
consequences for this function:

- Thinking tokens come out of the same `max_tokens` allowance as the answer, so
  [summarization.py](summarization.py) requests 8192 tokens instead of 4096.
- `MODEL_CONFIG` sets `output_config.effort` to `low` for both Claude 5 models, the
  level documented for when "speed matters most", since the call has to finish inside
  API Gateway's 29 s integration timeout.

Thinking blocks do not break XML parsing. On the non-streaming path used here,
`langchain_aws` joins only `text` content blocks into the message text and returns
thinking separately, so `XMLOutputParser` sees just the `<Output>` document.

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

The handler also accepts a warmup event, which loads the heavy imports and returns
without calling Bedrock or writing to S3:

```json
{ "warmup": true }
```

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

CDK builds the image automatically via `DockerImageCode.fromImageAsset()`. The image
is based on `public.ecr.aws/lambda/python:3.13` and:

- installs the `pango` system library that WeasyPrint needs for PDF rendering
- installs the Python dependencies from [requirements.txt](requirements.txt)
- precompiles bytecode with `compileall` so the cold start does not pay `.pyc`
  compilation for the import graph
- runs as a non-root user (UID 993)

To build and exercise it locally:

```bash
docker build --platform linux/arm64 -t orchestration:local .

docker run --rm --platform linux/arm64 \
  -e POWERTOOLS_METRICS_NAMESPACE=local -e POWERTOOLS_SERVICE_NAME=local \
  -e AWS_REGION=us-east-1 -e S3_BUCKET_NAME=example -e XDG_CACHE_HOME=/tmp \
  --entrypoint python orchestration:local -c "
import sys; sys.path.insert(0, '/var/task')
import document_generator as dg
dg.html_to_pdf(dg.generate_html(dg.markdown_to_html('# Title')), '/tmp/out.pdf')
import os; print('pdf bytes:', os.path.getsize('/tmp/out.pdf'))"
```

`XDG_CACHE_HOME=/tmp` is required — without a writable cache directory, fontconfig
fails and PDF rendering errors out.

## License

This project is licensed under the MIT-0 License.
