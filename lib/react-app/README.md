# React Frontend — Knowledge Capture UI

Browser-based voice transcription and document generation interface built with React, Vite, and AWS Cloudscape Design Components.

## Technology Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 18.3 | UI framework |
| Vite | 6.4 | Build tool and dev server |
| TypeScript | 5.7 | Type safety |
| Cloudscape Design Components | 3.x | AWS-native UI component library |
| AWS SDK (Transcribe Streaming) | 3.750+ | Real-time speech-to-text via WebSocket |

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

## Build & Deployment

The React app is built and deployed automatically:

1. CDK deploys the source code to S3 via `BucketDeployment`
2. An EventBridge rule triggers a CodeBuild project on stack create/update
3. CodeBuild runs `npm ci && npm run build`, injecting environment variables from SSM Parameter Store
4. Built artifacts are output to the `dist/` prefix in the S3 bucket
5. CloudFront serves the built app from S3 with Origin Access Control (OAC)

## License

This project is licensed under the MIT-0 License.
