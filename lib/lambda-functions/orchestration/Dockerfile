#checkov:skip=CKV_DOCKER_2:Using AWS Lambda container image
#checkov:skip=CKV_DOCKER_3:Base image from AWS already uses limited user
FROM public.ecr.aws/lambda/python:3.13
RUN dnf install -y pango-1.48.10 && dnf clean all
COPY . ${LAMBDA_TASK_ROOT}
RUN pip install -r requirements.txt --no-cache-dir
# Precompile bytecode so the cold start does not pay .pyc compilation for the
# langchain / weasyprint import graph.
RUN python -m compileall -q ${LAMBDA_TASK_ROOT} /var/lang/lib/python3.13/site-packages || true
# nosemgrep: dockerfile.security.missing-user.missing-user
USER 993
CMD ["summarize_generate.lambda_handler"]
