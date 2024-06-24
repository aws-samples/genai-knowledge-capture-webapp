import {
  AppLayout,
  Container,
  ContentLayout,
  Header,
} from "@cloudscape-design/components";
import { Theme, applyTheme } from '@cloudscape-design/components/theming';
import { AwsCredentialsProvider } from "./context/AwsCredentialsContext";
import { SystemAudioProvider } from "./context/SystemAudioContext";
import TranscribeForm from "./components/TranscribeForm";

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
                <TranscribeForm />
              </Container>
            </ContentLayout>
          }
        />
      </SystemAudioProvider>
    </AwsCredentialsProvider>
  );
}
