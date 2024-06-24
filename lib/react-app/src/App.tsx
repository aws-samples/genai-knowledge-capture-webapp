import {
  AppLayout,
  Container,
  ContentLayout,
  Header,
  SpaceBetween,
} from "@cloudscape-design/components";
import { Theme, applyTheme } from '@cloudscape-design/components/theming';
import { AwsCredentialsProvider } from "./context/AwsCredentialsContext";
import { SystemAudioProvider } from "./context/SystemAudioContext";
import TranscribeForm from "./components/TranscribeForm";
import TestAudioRecording from "./components/TestAudioRecording";
import TestAudioTranscription from "./components/TestAudioTranscription";
import TestAudioRecordingAndTranscription from "./components/TestAudioRecordingAndTranscription";

const testAudio = import.meta.env.VITE_TEST_AUDIO === 'true';

const theme: Theme = {
  tokens: {
    colorBackgroundLayoutMain: '#232F3E',
    colorTextHeadingDefault: '#ffffff'
  }
};
applyTheme({ theme });

/**
 * The main entry point of the application. It sets up the necessary context providers,
 * applies a custom theme, and renders the main application layout with its content.
 *
 * The layout includes either the `TranscribeForm` component or a set of test components
 * (`TestAudioTranscription`, `TestAudioRecording`, and `TestAudioRecordingAndTranscription`)
 * based on the value of the `VITE_TEST_AUDIO` environment variable.
 *
 * @example
 * import App from './App';
 *
 * const root = ReactDOM.createRoot(document.getElementById('root'));
 * root.render(
 *   <React.StrictMode>
 *     <App />
 *   </React.StrictMode>
 * );
 */
export default function App() {
  return (
    <AwsCredentialsProvider>
      <SystemAudioProvider>
        <AppLayout
          navigationHide
          toolsHide
          maxContentWidth={Number.MAX_VALUE}
          content={
            <ContentLayout
              header={
                <Header variant="h1">
                  Knowledge Capture Demo with GenAI and Live Transcribe
                </Header>
              }
            >
              <Container fitHeight>
                {testAudio && (
                  <SpaceBetween direction="vertical" size="l">
                    <TestAudioTranscription />
                    <TestAudioRecording />
                    <TestAudioRecordingAndTranscription />
                  </SpaceBetween>
                )}
                {!testAudio && <TranscribeForm />}
              </Container>
            </ContentLayout>
          }
        />
      </SystemAudioProvider>
    </AwsCredentialsProvider>
  );
}
