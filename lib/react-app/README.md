# React Frontend — Knowledge Capture UI

Browser-based voice transcription and document generation interface built with React, Vite, and AWS Cloudscape Design Components.

## Technology Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 18.3 | UI framework |
| Vite | 7.3 | Build tool and dev server |
| TypeScript | 5.9 | Type safety |
| Cloudscape Design Components | 3.x | AWS-native UI component library |
| AWS SDK (Transcribe Streaming) | 3.1108+ | Real-time speech-to-text via WebSocket |

## Project Structure

```
src/
├── App.tsx                        # Root component with Cloudscape theming
├── main.tsx                       # React entry point
├── components/
│   ├── TranscribeForm.tsx         # Main form: transcription, editing, document generation
│   └── AudioPlayer.tsx            # Playback component for recorded audio clips
├── context/
│   ├── AwsCredentialsContext.tsx   # Fetches temporary STS credentials from API
│   └── SystemAudioContext.tsx      # Audio device and AudioWorklet management
├── hooks/
│   ├── useAudioTranscription.ts   # Amazon Transcribe streaming WebSocket hook
│   ├── useAudioRecorder.ts        # MediaRecorder hook for audio capture
│   └── useAudioProcessing.ts      # AudioWorklet processing hook
├── services/
│   └── documentApi.ts             # API client for orchestration endpoint
└── assets/
    └── favicon.ico
public/
└── worklets/
    └── audio-processor.js         # AudioWorklet processor for real-time audio
```

## Environment Variables

The app uses Vite environment variables (prefixed with `VITE_`), injected at build time by CodeBuild:

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | API Gateway endpoint URL |
| `VITE_API_KEY` | API key for authenticating requests |

See `.env.template` for the expected format.

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Lint
npm run lint
```

`npm run lint` uses the legacy `.eslintrc.cjs` format, which ESLint 9 no longer reads
by default, so it currently fails with "couldn't find an eslint.config.js file". Until
the config is migrated to `eslint.config.js`, run it in compatibility mode:

```bash
ESLINT_USE_FLAT_CONFIG=false npm run lint
```

That reports three pre-existing findings: an unused `err` binding in
`context/AwsCredentialsContext.tsx`, and two `react-refresh/only-export-components`
warnings from the context files exporting both a provider and a hook.

## Error handling

`src/services/documentApi.ts` returns `null` when the orchestration request fails and
logs the HTTP status to the console. `TranscribeForm` then renders the "There was an
error with your request" banner. When diagnosing a failure, check the console for the
status:

| Status | Meaning |
|--------|---------|
| `403` | Missing or invalid API key — check `VITE_API_KEY` in the build |
| `504` | Request exceeded API Gateway's 29 second integration timeout |
| `502` | The orchestration Lambda raised an error — check its CloudWatch logs |

## Build & Deployment

The React app is built and deployed automatically:

1. CDK deploys the source code to S3 via `BucketDeployment`
2. An EventBridge rule triggers a CodeBuild project on stack create/update
3. CodeBuild runs `npm ci && npm run build`, injecting environment variables from SSM Parameter Store
4. Built artifacts are output to the `dist/` prefix in the S3 bucket
5. CloudFront serves the built app from S3 with Origin Access Control (OAC)

CodeBuild uses the `standard:7.0` image with the Node.js 22 runtime. Vite 7 requires
Node.js `^20.19.0 || >=22.12.0`, and the Node.js 22 runtime is not available on
`standard:6.0`, so both the image and the runtime version must stay in step with the
Vite major version. See
[available runtimes](https://docs.aws.amazon.com/codebuild/latest/userguide/available-runtimes.html).

## License

This project is licensed under the MIT-0 License.
